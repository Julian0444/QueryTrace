"""
workspaces.py — Central resolver for multi-workspace corpora (Fase 2).

A workspace is a self-contained corpus directory under corpora/<slug>/ with:
  workspace.json   manifest (name, description, doc_types, scenarios, …)
  documents/*.txt  document bodies
  metadata.json    per-document metadata (min_role, superseded_by, …)
  roles.json       role definitions with access_rank
  users.json       demo personas for product-mode login (Fase P)
  evals.json       benchmark queries for the evaluator

Index artifacts live in a sibling tree: artifacts/<slug>/{querytrace.index,
index_documents.json, bm25_corpus.json}.

Slugs are user input (request bodies, query params, URL segments) and are
interpolated into filesystem paths — they are validated against SLUG_RE
before any path is built. Never join a slug into a path without going
through validate_slug()/get_workspace().
"""

import hashlib
import json
import os
import re
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

CORPORA_DIR = os.path.join(os.path.dirname(__file__), "..", "corpora")
ARTIFACTS_ROOT = os.path.join(os.path.dirname(__file__), "..", "artifacts")

# Lowercase alphanumerics and hyphens only, 1-40 chars. Rejects path
# separators, dots (traversal), uppercase, and empty strings by construction.
SLUG_RE = re.compile(r"^[a-z0-9-]{1,40}$")

MANIFEST_FILE = "workspace.json"


def default_workspace() -> str:
    """The workspace used when a request does not name one (env-overrideable)."""
    return os.getenv("QUERYTRACE_DEFAULT_WORKSPACE", "pe-deal").strip() or "pe-deal"


class WorkspaceError(ValueError):
    """Base class for workspace resolution failures."""


class InvalidWorkspaceSlug(WorkspaceError):
    """Slug failed validation — the filesystem was never touched (→ 400)."""


class WorkspaceConfigurationError(WorkspaceError):
    """A workspace exists but its configuration is invalid."""


class WorkspaceNotFound(WorkspaceError):
    """Slug is well-formed but no such workspace exists (→ 404)."""


@dataclass(frozen=True)
class Workspace:
    """Resolved paths + loaded data for one workspace. Cached by slug."""

    slug: str
    root: str
    documents_dir: str
    metadata_path: str
    roles_path: str
    users_path: str
    evals_path: str
    artifacts_dir: str
    index_path: str
    index_docs_path: str
    bm25_path: str
    manifest: Dict
    roles: Dict
    metadata: Dict
    users: Dict  # username -> user dict (includes password_sha256; server-side only)


_cache: Dict[str, Workspace] = {}
_cache_signatures = {}
_cache_lock = threading.Lock()


def validate_slug(slug: str) -> str:
    """Return the slug if it is safe to use in paths; raise otherwise.

    This is the anti-path-traversal gate: it runs before any filesystem
    access, so '../evil', 'PE-DEAL', '' or 'a/b' never reach os.path.join.
    """
    if not isinstance(slug, str) or not SLUG_RE.match(slug):
        raise InvalidWorkspaceSlug(
            f"Invalid workspace slug: {slug!r}. "
            "Expected 1-40 lowercase letters, digits, or hyphens."
        )
    return slug


def _load_json(path: str) -> Dict:
    try:
        with open(path, "r") as f:
            value = json.load(f)
        if not isinstance(value, dict):
            raise ValueError("expected a JSON object")
        return value
    except (OSError, ValueError) as exc:
        raise WorkspaceConfigurationError(
            f"Invalid workspace configuration at {path}: {exc}"
        ) from exc


def corpus_version(ws: Workspace) -> str:
    """Content/config fingerprint; changes after publication or offline edits."""
    paths = [os.path.join(ws.documents_dir, d["file_name"]) for d in ws.metadata["documents"]]
    files = [(p, os.stat(p).st_mtime_ns, os.stat(p).st_size) for p in paths if os.path.exists(p)]
    value = {"metadata": ws.metadata, "roles": ws.roles, "manifest": ws.manifest, "files": files}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:16]


def validate_startup() -> None:
    """Fail early with an actionable error for an invalid default workspace."""
    try:
        get_workspace(default_workspace())
    except WorkspaceError as exc:
        raise WorkspaceConfigurationError(
            f"QUERYTRACE_DEFAULT_WORKSPACE={default_workspace()!r} cannot be loaded: {exc}"
        ) from exc


def _load(slug: str) -> Workspace:
    root = os.path.join(CORPORA_DIR, slug)
    manifest_path = os.path.join(root, MANIFEST_FILE)
    if not os.path.isdir(root) or not os.path.exists(manifest_path):
        raise WorkspaceNotFound(
            f"Workspace {slug!r} requires a {MANIFEST_FILE} manifest in {root}."
        )

    manifest = _load_json(manifest_path)
    roles = _load_json(os.path.join(root, "roles.json")).get("roles")
    metadata = _load_json(os.path.join(root, "metadata.json"))
    users_path = os.path.join(root, "users.json")
    users_raw = _load_json(users_path) if os.path.exists(users_path) else {"users": []}
    try:
        if not isinstance(roles, dict) or not roles:
            raise ValueError("roles.json must define at least one role")
        for name, role in roles.items():
            if not isinstance(role, dict) or not isinstance(role.get("access_rank"), int):
                raise ValueError(f"role {name!r} requires integer access_rank")
        documents = metadata["documents"]
        if not isinstance(documents, list):
            raise ValueError("metadata.documents must be a list")
        ids = set()
        for doc in documents:
            if doc["id"] in ids:
                raise ValueError(f"duplicate document id {doc['id']!r}")
            ids.add(doc["id"])
            if doc["min_role"] not in roles:
                raise ValueError(f"document {doc['id']!r} has unknown min_role")
            datetime.strptime(doc["date"], "%Y-%m-%d")
            filename = doc["file_name"]
            if not os.path.isfile(os.path.join(root, "documents", filename)):
                raise ValueError(
                    f"document {doc['id']!r} file {filename!r} is missing from documents/"
                )
            if os.path.basename(filename) != filename:
                raise ValueError(f"document {doc['id']!r} file_name must be a plain filename")
        users = {u["username"]: u for u in users_raw["users"]}
        for user in users.values():
            if user["role"] not in roles:
                raise ValueError(f"user {user['username']!r} has unknown role")
    except (KeyError, TypeError, ValueError) as exc:
        raise WorkspaceConfigurationError(f"Invalid workspace {slug!r}: {exc}") from exc

    artifacts_dir = os.path.join(ARTIFACTS_ROOT, slug)
    return Workspace(
        slug=slug,
        root=root,
        documents_dir=os.path.join(root, "documents"),
        metadata_path=os.path.join(root, "metadata.json"),
        roles_path=os.path.join(root, "roles.json"),
        users_path=os.path.join(root, "users.json"),
        evals_path=os.path.join(root, "evals.json"),
        artifacts_dir=artifacts_dir,
        index_path=os.path.join(artifacts_dir, "querytrace.index"),
        index_docs_path=os.path.join(artifacts_dir, "index_documents.json"),
        bm25_path=os.path.join(artifacts_dir, "bm25_corpus.json"),
        manifest=manifest,
        roles=roles,
        metadata=metadata,
        users=users,
    )


def get_workspace(slug: Optional[str] = None) -> Workspace:
    """Resolve a workspace by slug (None → the default workspace).

    Validates the slug before touching the filesystem, then serves from a
    process-wide cache. Call invalidate_workspace_cache(slug) after mutating
    a workspace's corpus (ingest) so the next resolution reloads from disk.
    """
    slug = validate_slug(slug if slug is not None else default_workspace())
    root = os.path.join(CORPORA_DIR, slug)
    if not os.path.isdir(root):
        raise WorkspaceNotFound(
            f"Unknown workspace: {slug!r}. Check corpora/ and the default workspace."
        )
    from src.storage import corpus_lock

    with corpus_lock(root):
        with _cache_lock:
            paths = [
                os.path.join(root, name)
                for name in (MANIFEST_FILE, "metadata.json", "roles.json", "users.json")
            ]
            signature = tuple(
                (os.stat(p).st_mtime_ns, os.stat(p).st_size) if os.path.exists(p) else None
                for p in paths
            )
            ws = _cache.get(slug)
            if ws is None or _cache_signatures.get(slug) != signature:
                ws = _load(slug)
                _cache[slug] = ws
                _cache_signatures[slug] = signature
            return ws


def list_workspaces() -> List[Dict]:
    """Scan corpora/*/workspace.json and return summary dicts.

    Each entry: {slug, name, description, doc_count}. Directories without a
    manifest (or with a non-conforming name) are skipped.
    """
    if not os.path.isdir(CORPORA_DIR):
        return []
    summaries = []
    for entry in sorted(os.listdir(CORPORA_DIR)):
        if not SLUG_RE.match(entry):
            continue
        manifest_path = os.path.join(CORPORA_DIR, entry, MANIFEST_FILE)
        if not os.path.exists(manifest_path):
            continue
        from src.storage import corpus_lock

        with corpus_lock(os.path.join(CORPORA_DIR, entry)):
            manifest = _load_json(manifest_path)
            metadata = _load_json(os.path.join(CORPORA_DIR, entry, "metadata.json"))
        summaries.append(
            {
                "slug": entry,
                "name": manifest.get("name", entry),
                "description": manifest.get("description", ""),
                "doc_count": len(metadata.get("documents", [])),
            }
        )
    return summaries


def invalidate_workspace_cache(slug: Optional[str] = None) -> None:
    """Drop one workspace (or all) from the cache — next access reloads."""
    with _cache_lock:
        if slug is None:
            _cache.clear()
            _cache_signatures.clear()
        else:
            _cache.pop(slug, None)
            _cache_signatures.pop(slug, None)
