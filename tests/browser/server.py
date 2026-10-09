"""Isolated browser-test server. Never import this module in production.

Real routes, retrieval, indices and ingestion; only the paid answer provider is
replaced. Corpus files are disposable copies in a temporary directory. Test
control routes exist only in this harness, bound to loopback by Playwright.
"""
import atexit
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

# A developer's exported API key must never cause a paid call during tests.
os.environ.pop("ANTHROPIC_API_KEY", None)
os.environ["QUERYTRACE_SECRET_KEY"] = "browser-tests-only-not-a-deployment-secret"
os.environ["ALLOW_INGEST"] = "true"
os.environ["ASK_MAX_PER_MINUTE"] = "1000"
os.environ["ASK_MAX_PER_MINUTE_GLOBAL"] = "1000"
os.environ["QUERYTRACE_DEFAULT_WORKSPACE"] = "pe-deal"

from src import workspaces  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
TMP = Path(tempfile.mkdtemp(prefix="querytrace-e2e-"))
atexit.register(shutil.rmtree, TMP, ignore_errors=True)
shutil.copytree(REPO / "corpora", TMP / "corpora")
shutil.copytree(REPO / "artifacts", TMP / "artifacts")
workspaces.CORPORA_DIR = str(TMP / "corpora")
workspaces.ARTIFACTS_ROOT = str(TMP / "artifacts")
workspaces.invalidate_workspace_cache()


def custom_corpus(slug, restricted=False, empty=False):
    root = TMP / "corpora" / slug
    (root / "documents").mkdir(parents=True)
    manifest = {"slug": slug, "name": slug, "description": "Browser-test custom corpus",
                "doc_types": ["document"], "blocked_disclosure": "count"}
    roles = {"viewer": {"name": "viewer", "access_rank": 1},
             "owner": {"name": "owner", "access_rank": 2}}
    docs = [] if empty else [{
        "id": "doc_001", "file_name": "manual.txt", "title": "Observatory telescope manual",
        "date": "2024-05-01", "min_role": "owner" if restricted else "viewer",
        "type": "document", "sensitivity": "low", "tags": ["telescope"],
        "superseded_by": None, "short_summary": "Telescope alignment and observation procedure",
    }]
    for name, data in [("workspace.json", manifest), ("roles.json", {"roles": roles}),
                       ("metadata.json", {"documents": docs})]:
        (root / name).write_text(json.dumps(data))
    if docs:
        (root / "documents" / "manual.txt").write_text(
            "Observatory telescope alignment manual. Before each observation, align the telescope "
            "using the north star and calibrate the optical sensor. The telescope tracking system "
            "requires calibration before recording observations of stars and distant galaxies.\n"
        )
    from src.indexer import build_and_save
    build_and_save(slug)


custom_corpus("custom-no-evals")
custom_corpus("restricted-test", restricted=True)
custom_corpus("empty-test", empty=True)

from src import ask, auth, pipeline  # noqa: E402
from src import main as main_module  # noqa: E402
from src.main import app  # noqa: E402

STATE = {"enabled": False, "provider_error": False, "calls": []}
ORIGINAL_PIPELINE = pipeline.run_pipeline
ask.ask_enabled = lambda: STATE["enabled"]


def simulated_provider(system, user):
    ids = re.findall(r'<doc id="([^"]+)"', user)
    STATE["calls"].append({"ids": ids, "prompt": user})
    if STATE["provider_error"]:
        raise ask.AskUpstreamError("Deterministic test provider unavailable")
    cited = ", ".join(ids[:2] + ["doc_999999"])
    return ask.ModelReply(
        text=(f"## Simulated answer\n\n**Test output** based on the supplied context. [{cited}]\n\n"
              "- This is a deterministic test provider.\n- No external API was called.\n\n"
              "<script>window.unsafeAnswer = true</script>"),
        model="deterministic-test-provider", input_tokens=123, output_tokens=45,
    )


ask.call_model = simulated_provider


@app.post("/__test/control")
def control(body: dict):
    auth.reset_rate_limiter()
    ask.reset_ask_state()
    main_module._evals_cache.clear()
    fail_mode = body.get("evaluation_failure")
    counter = [0]

    def faulted_evaluation(*args, **kwargs):
        counter[0] += 1
        if fail_mode == "all" or (fail_mode == "partial" and counter[0] == 1):
            raise pipeline.PipelineError("retrieve", "Injected evaluation retrieval failure")
        return ORIGINAL_PIPELINE(*args, **kwargs)

    pipeline.run_pipeline = faulted_evaluation if fail_mode else ORIGINAL_PIPELINE
    STATE.update({"enabled": body.get("enabled", False),
                  "provider_error": body.get("provider_error", False), "calls": []})
    os.environ["ASK_MAX_CONTEXT_TOKENS"] = str(body.get("context_cap", 4096))
    return {"ok": True, "corpus_root": str(TMP)}


@app.get("/__test/state")
def test_state():
    return STATE
