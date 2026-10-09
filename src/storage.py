"""Small, recoverable corpus transactions for the single-host deployment.

Readers and writers take the same reentrant, process + OS file lock. Before
mutating any live file, a durable journal records originals. A failed write,
interrupted worker, or later process restart restores the whole previous set.
The commit marker is written only after all new files have reached disk.
"""

import json
import os
import shutil
import threading
from contextlib import contextmanager
from pathlib import Path

import fcntl

_locks = {}
_registry_lock = threading.Lock()
_local = threading.local()


def _sync_file(path):
    with open(path, "rb") as stream:
        os.fsync(stream.fileno())


def _sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _restore(journal):
    manifest = json.loads((journal / "manifest.json").read_text())
    if manifest.get("committed"):
        shutil.rmtree(journal)
        return
    for item in manifest["files"]:
        target = Path(item["path"])
        if item["exists"]:
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + ".recovery")
            shutil.copyfile(journal / item["backup"], temporary)
            os.replace(temporary, target)
        else:
            target.unlink(missing_ok=True)
        target.with_name(target.name + ".tmp").unlink(missing_ok=True)
    shutil.rmtree(journal)


@contextmanager
def corpus_lock(root):
    """Serialize a corpus snapshot; recover unfinished publication before reads."""
    root = os.path.abspath(root)
    with _registry_lock:
        lock = _locks.setdefault(root, threading.RLock())
    with lock:
        depths = getattr(_local, "depths", {})
        _local.depths = depths
        if depths.get(root, 0):
            depths[root] += 1
            try:
                yield
            finally:
                depths[root] -= 1
            return
        os.makedirs(root, exist_ok=True)
        with open(os.path.join(root, ".querytrace.lock"), "a") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            depths[root] = 1
            try:
                staging = Path(root) / ".querytrace-transaction-preparing"
                if staging.exists():
                    shutil.rmtree(staging)
                journal = Path(root) / ".querytrace-transaction"
                if journal.exists():
                    _restore(journal)
                    # Local caches must not retain a snapshot from an interrupted write.
                    from src.workspaces import invalidate_workspace_cache

                    invalidate_workspace_cache()
                    from src.retriever import invalidate_caches

                    invalidate_caches()
                yield
            finally:
                depths.pop(root, None)
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


@contextmanager
def corpus_transaction(root, paths):
    """Rollback every listed file together; caller holds corpus_lock(root).

    The journal is staged before activation, so a crash while copying original
    files leaves live state untouched and no incomplete journal to recover.
    """
    active = getattr(_local, "transactions", set())
    _local.transactions = active
    root = os.path.abspath(root)
    if root in active:
        yield
        return
    active.add(root)
    journal = Path(root) / ".querytrace-transaction"
    staging = Path(root) / ".querytrace-transaction-preparing"
    files = []
    finished = False
    try:
        if staging.exists():
            shutil.rmtree(staging)
        staging.mkdir()
        for index, path in enumerate(dict.fromkeys(os.path.abspath(p) for p in paths)):
            exists = os.path.exists(path)
            backup = str(index)
            if exists:
                shutil.copyfile(path, staging / backup)
                _sync_file(staging / backup)
            files.append({"path": path, "exists": exists, "backup": backup})
        manifest = {"files": files, "committed": False}
        (staging / "manifest.json").write_text(json.dumps(manifest))
        _sync_file(staging / "manifest.json")
        os.replace(staging, journal)
        _sync_directory(root)
        yield
        for item in files:
            if os.path.exists(item["path"]):
                _sync_file(item["path"])
        for directory in {os.path.dirname(item["path"]) for item in files}:
            if os.path.isdir(directory):
                _sync_directory(directory)
        manifest["committed"] = True
        marker = journal / "commit.tmp"
        marker.write_text(json.dumps(manifest))
        _sync_file(marker)
        os.replace(marker, journal / "manifest.json")
        _sync_directory(journal)
        finished = True
    except BaseException:
        if journal.exists():
            _restore(journal)
        finished = True
        raise
    finally:
        active.discard(root)
        if finished and journal.exists():
            shutil.rmtree(journal)
        if staging.exists():
            shutil.rmtree(staging)
