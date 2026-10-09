"""
evaluator.py — Runs the QueryTrace pipeline against test queries and reports
retrieval quality metrics (precision@k, recall) and permission safety metrics.

Evaluates against the final assembled context produced by run_pipeline(), which
is exactly what the HTTP endpoint surfaces to users.  The token budget is owned
by the pipeline's policy preset (PolicyConfig.token_budget); it is not a
per-eval knob.

Usage:
    python3 -m src.evaluator
    python3 -m src.evaluator --workspace saas-internal
    python3 -m src.evaluator --evals corpora/pe-deal/evals.json --k 5 --top-k 8
"""

import argparse
import json
import os
import hashlib
import sys
import uuid
from datetime import date, datetime, timezone
from functools import partial
from typing import Callable, Optional

from src.workspaces import get_workspace

_RESULTS_DIR = os.path.join(os.path.dirname(__file__), "..", "evals", "results")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_test_queries(path: str) -> list:
    """Load evaluation queries from a JSON file.

    Expects a top-level 'queries' array. Each entry must have:
        id, query, role, expected_doc_ids
    and may optionally have:
        forbidden_doc_ids, notes
    """
    with open(path) as f:
        data = json.load(f)
    if "queries" not in data:
        raise ValueError(f"Expected a top-level 'queries' key in {path}")
    if not isinstance(data["queries"], list) or any(not isinstance(q, dict) for q in data["queries"]):
        raise ValueError(f"Expected 'queries' to be an array of query objects in {path}")
    return data["queries"]


def precision_at_k(retrieved_ids: list, expected_ids: list, k: int) -> float:
    """Precision@k: fraction of top-k assembled results that are expected.

    If fewer than k documents were assembled, k is clamped to the actual count
    so short results (due to role filtering or token budget) are not penalized
    for items the system could not have returned.
    """
    effective_k = min(k, len(retrieved_ids))
    if effective_k == 0:
        return 0.0
    top_k = retrieved_ids[:effective_k]
    hits = sum(1 for doc_id in top_k if doc_id in expected_ids)
    return hits / effective_k


def _recall(retrieved_ids: list, expected_ids: list) -> float:
    """Recall: fraction of expected docs found anywhere in the assembled context."""
    if not expected_ids:
        return 1.0  # nothing expected → nothing missed
    hits = sum(1 for doc_id in retrieved_ids if doc_id in expected_ids)
    return hits / len(expected_ids)


def evaluation_status(total: int, completed: int, failed: int, skipped: int = 0) -> str:
    """Completion describes execution coverage, never certification."""
    if not total or not (completed or failed):
        return "not_run"
    if failed and not completed:
        return "failed"
    return "complete" if completed == total and not skipped else "incomplete"


def _aggregate_evaluation(per_query: list, k: int) -> dict:
    valid = [r for r in per_query if r.get("status") == "complete"]
    n = len(valid)
    failed = sum(r.get("status") == "failed" for r in per_query)
    skipped = sum(r.get("status") == "skipped" for r in per_query)
    status = evaluation_status(len(per_query), n, failed, skipped)

    def mean(key, digits=4):
        return round(sum(r[key] for r in valid) / n, digits) if n else None

    violation_queries = sum(bool(r["permission_violations"]) for r in valid)
    violation_docs = sum(len(r["permission_violations"]) for r in valid)
    violation_chunks = sum(r["permission_violation_chunks"] for r in valid)
    returned_docs = sum(r["context_docs"] for r in valid)
    returned_chunks = sum(r["context_chunks"] for r in valid)
    return {
        "status": status,
        "queries_total": len(per_query),
        "queries_attempted": n + failed,
        "queries_run": n,  # legacy name now means successfully executed
        "queries_completed": n,
        "queries_failed": failed,
        "queries_skipped": skipped,
        "metric_denominator_queries": n,
        f"avg_precision_at_{k}": mean(f"precision_at_{k}"),
        "avg_recall": mean("recall"),
        "permission_violation_rate": violation_queries / n if n else None,
        "queries_with_permission_violations": violation_queries,
        "permission_violation_documents": violation_docs,
        "permission_violation_chunks": violation_chunks,
        "returned_documents": returned_docs,
        "returned_chunks": returned_chunks,
        "permission_document_violation_rate": violation_docs / returned_docs if returned_docs else None,
        "permission_chunk_violation_rate": violation_chunks / returned_chunks if returned_chunks else None,
        "avg_context_docs": mean("context_docs", 2),
        "avg_context_chunks": mean("context_chunks", 2),
        "avg_total_tokens": mean("total_tokens", 1),
        "total_selected_tokens": sum(r["total_tokens"] for r in valid),
        "avg_freshness_score": mean("avg_freshness_score", 8),
        "avg_blocked_count": mean("blocked_count", 2),
        "avg_stale_count": mean("stale_count", 2),
        "avg_stale_included_count": mean("stale_included_count", 2),
        "avg_dropped_count": mean("dropped_count", 2),
        "avg_budget_utilization": mean("budget_utilization"),
    }


def empty_evaluation(status: str = "unavailable", reason: str = "", workspace=None) -> dict:
    """Shape-compatible response for unconfigured or not-yet-run evaluations."""
    if status not in ("unavailable", "not_run"):
        raise ValueError("An empty evaluation must be unavailable or not_run")
    aggregate = _aggregate_evaluation([], 5)
    aggregate["status"] = status
    return {"status": status, "reason": reason, "workspace": workspace,
            "per_query": [], "aggregate": aggregate}


def run_evals(queries: list, k: int = 5, top_k: int = 8,
              policy_name: str = "default", workspace: Optional[str] = None) -> dict:
    """Hold one corpus generation for every query and the report fingerprint."""
    from src.storage import corpus_lock

    ws = get_workspace(workspace)
    with corpus_lock(ws.root):
        return _run_evals_snapshot(queries, k, top_k, policy_name, workspace)


def _run_evals_snapshot(
    queries: list,
    k: int = 5,
    top_k: int = 8,
    policy_name: str = "default",
    workspace: Optional[str] = None,
) -> dict:
    """Evaluate final context, with execution coverage and actual authorization.

    Precision and recall use unique parent documents in first-included order.
    Permission query rate = successful queries with >=1 unauthorized returned
    document / successful queries. Document and chunk rates use their respective
    returned occurrence counts across successful queries. Errors are reported,
    excluded from metric denominators, and make the report incomplete/failed.
    """
    from src.retriever import retrieve
    from src.pipeline import run_pipeline
    from src.models import QueryRequest
    from src.policies import document_is_authorized, resolve_policy

    if k < 1:
        raise ValueError("precision k must be at least 1")
    ws = get_workspace(workspace)
    roles, metadata = ws.roles, ws.metadata
    meta_by_id = {d["id"]: d for d in metadata["documents"]}
    retriever = partial(retrieve, workspace=ws.slug)
    per_query = []
    for index, q in enumerate(queries):
        row = {"id": q.get("id", f"query-{index + 1}"),
               "query": q.get("query", ""), "role": q.get("role", "")}
        if q.get("skip"):
            per_query.append({**row, "status": "skipped", "reason": str(q["skip"])})
            continue
        try:
            query_text, role = q["query"], q["role"]
            expected_ids = q.get("expected_doc_ids", [])
            request = QueryRequest(query=query_text, role=role, top_k=top_k,
                                   policy_name=policy_name, workspace=ws.slug)
            result = run_pipeline(request, retriever, roles, metadata)
            if result.trace is None:
                raise RuntimeError("pipeline returned PipelineResult with trace=None")
            assembled_ids = list(dict.fromkeys(d.doc_id for d in result.context))
            # Every result is checked against this workspace's complete metadata.
            # Missing documents and unknown roles fail closed.
            forbidden_ids = [did for did, doc in meta_by_id.items()
                             if not document_is_authorized(doc, role, roles)]
            violations = [did for did in assembled_ids
                          if not document_is_authorized(meta_by_id.get(did, {}), role, roles)]
            freshness_vals = [d.freshness_score for d in result.context]
            trace = result.trace
            per_query.append({
                **row, "status": "complete", "assembled_ids": assembled_ids,
                "expected_ids": expected_ids, "forbidden_ids": forbidden_ids,
                "annotated_forbidden_ids": q.get("forbidden_doc_ids", []),
                f"precision_at_{k}": round(precision_at_k(assembled_ids, expected_ids, k), 4),
                "recall": round(_recall(assembled_ids, expected_ids), 4),
                "permission_violations": violations,
                "permission_violation_chunks": sum(d.doc_id in violations for d in result.context),
                "context_docs": len(assembled_ids), "context_chunks": len(result.context),
                "context_chunk_ids": [d.chunk_id for d in result.context],
                "retrieved_docs": trace.metrics.retrieved_doc_count,
                "retrieved_chunks": trace.metrics.retrieved_count,
                "blocked_chunks": trace.metrics.blocked_count,
                "dropped_chunks": trace.metrics.dropped_count,
                "stale_candidate_chunks": trace.metrics.stale_candidate_count,
                "stale_included_chunks": trace.metrics.stale_included_count,
                "total_tokens": result.total_tokens,
                "avg_freshness_score": round(sum(freshness_vals) / len(freshness_vals), 8)
                if freshness_vals else 0.0,
                "blocked_count": trace.metrics.blocked_doc_count,
                "stale_count": trace.metrics.stale_doc_count,
                "stale_included_count": trace.metrics.stale_included_doc_count,
                "dropped_count": trace.metrics.dropped_doc_count,
                "budget_utilization": trace.metrics.budget_utilization,
                "result_status": trace.result_status,
                "evidence": trace.evidence.model_dump(),
            })
        except Exception as exc:
            per_query.append({**row, "status": "failed", "error": str(exc)})

    aggregate = _aggregate_evaluation(per_query, k)
    fingerprint = hashlib.sha256(json.dumps(metadata, sort_keys=True).encode())
    if os.path.isfile(ws.index_docs_path):
        with open(ws.index_docs_path, "rb") as source:
            fingerprint.update(source.read())
    return {
        "status": aggregate["status"], "run_id": str(uuid.uuid4()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "workspace": ws.slug, "corpus_fingerprint": fingerprint.hexdigest(),
        "policy_name": policy_name, "policy": resolve_policy(policy_name, top_k).model_dump(),
        "top_k": top_k, "precision_k": k,
        "metric_definitions": {
            "permission_violation_rate": "queries with unauthorized returned documents / completed queries",
            "permission_document_violation_rate": "unauthorized document occurrences / returned document occurrences; unique within each query",
            "permission_chunk_violation_rate": "unauthorized chunks / returned chunks",
            "precision": "expected documents among first min(k, returned document count) / min(k, returned document count)",
            "recall": "returned expected documents / expected documents",
            "token_count": "local cl100k_base estimate of selected chunk text; excludes prompt overhead",
            "stale_count": "superseded permitted candidate documents penalized before packing, not necessarily included",
        },
        "per_query": per_query, "aggregate": aggregate,
    }


# ---------------------------------------------------------------------------
# Ask-mode evals (Fase 4) — opt-in: every query spends model tokens
# ---------------------------------------------------------------------------

def _ask_once(ws, retriever, query: str, role: str, top_k: int, call: Callable) -> dict:
    """One query through pipeline → prompt → model → mechanical citation check.

    Shared by run_ask_evals and run_ask_goldens so both measure exactly the
    /ask code path (full_policy, same prompt builder, same validator).
    """
    from src import ask as ask_mod
    from src.models import QueryRequest
    from src.pipeline import run_pipeline

    request = QueryRequest(query=query, role=role, top_k=top_k, policy_name="full_policy")
    result = run_pipeline(request, retriever, ws.roles, ws.metadata)
    prompt_docs = ask_mod.trim_to_context_cap(result.context)
    if not prompt_docs:
        return {"answer": "No supporting context was selected; the answer provider was not called.",
                "model": None, "citations": [], "cited_valid_ids": [],
                "invalid_citations": [], "context_ids": [],
                "blocked_count": result.trace.metrics.blocked_doc_count if result.trace else 0,
                "input_tokens": 0, "output_tokens": 0}
    system, user = ask_mod.build_prompt(query, prompt_docs)
    reply = call(system, user)
    citations = ask_mod.extract_citations(reply.text, [d.doc_id for d in prompt_docs])
    return {
        "answer": reply.text,
        "model": reply.model,
        "citations": [{"doc_id": c.doc_id, "valid": c.valid} for c in citations],
        "cited_valid_ids": [c.doc_id for c in citations if c.valid],
        "invalid_citations": [c.doc_id for c in citations if not c.valid],
        "context_ids": list(dict.fromkeys(d.doc_id for d in prompt_docs)),
        "blocked_count": result.trace.metrics.blocked_doc_count if result.trace else 0,
        "input_tokens": reply.input_tokens,
        "output_tokens": reply.output_tokens,
    }


def run_ask_evals(
    queries: list,
    top_k: int = 8,
    workspace: Optional[str] = None,
    call: Optional[Callable] = None,
) -> dict:
    """Run the benchmark through the Ask path and measure citation fidelity.

    Purely mechanical metrics (no LLM judge):
      - citation_validity_rate: valid citations / all citations (target 1.0)
      - groundedness_rate: answers citing ≥1 in-context doc / all answers
      - expected_cited_rate: queries whose expected_doc_ids appear among the
        valid citations (over queries that define expected_doc_ids)

    `call` defaults to the real model client (spends tokens); tests inject a
    fake with the same (system, user) -> ModelReply signature.
    """
    from src import ask as ask_mod
    from src.retriever import retrieve

    if call is None:
        call = ask_mod.call_model

    ws = get_workspace(workspace)
    retriever = partial(retrieve, workspace=ws.slug)

    per_query = []
    for i, q in enumerate(queries):
        row = {"id": q.get("id", f"query-{i + 1}"), "role": q.get("role", ""),
               "query": q.get("query", "")}
        if q.get("skip"):
            per_query.append({**row, "status": "skipped", "reason": str(q["skip"])})
            continue
        try:
            outcome = _ask_once(ws, retriever, q["query"], q["role"], top_k, call)
            expected = set(q.get("expected_doc_ids", []))
            cited_valid = set(outcome["cited_valid_ids"])
            per_query.append({
                **row, "status": "complete",
                "citations_total": len(outcome["citations"]),
                "citations_valid": len(outcome["cited_valid_ids"]),
                "invalid_citations": outcome["invalid_citations"],
                "grounded": bool(cited_valid),  # legacy: mechanical citation presence only
                "expected_cited": bool(expected & cited_valid) if expected else None,
                "blocked_count": outcome["blocked_count"],
                "context_ids": outcome["context_ids"],
                "input_tokens": outcome["input_tokens"],
                "output_tokens": outcome["output_tokens"],
                "model": outcome["model"],
                "answer_preview": outcome["answer"][:160],
            })
        except Exception as exc:
            per_query.append({**row, "status": "failed", "error": str(exc)})

    valid = [r for r in per_query if r["status"] == "complete"]
    n = len(valid)
    failed = sum(r["status"] == "failed" for r in per_query)
    skipped = sum(r["status"] == "skipped" for r in per_query)
    total_citations = sum(r["citations_total"] for r in valid)
    total_valid = sum(r["citations_valid"] for r in valid)
    with_expected = [r for r in valid if r["expected_cited"] is not None]
    aggregate = {
        "status": evaluation_status(len(queries), n, failed, skipped),
        "queries_total": len(queries), "queries_attempted": n + failed,
        "queries_run": n, "queries_completed": n, "queries_failed": failed,
        "queries_skipped": skipped, "metric_denominator_queries": n,
        "queries_without_context": sum(not r["context_ids"] for r in valid),
        "citations_total": total_citations, "citations_valid": total_valid,
        "citation_validity_rate": round(total_valid / total_citations, 4) if total_citations else None,
        "groundedness_rate": round(sum(bool(r["grounded"]) for r in valid) / n, 4) if n else None,
        "expected_cited_rate": (
            round(sum(bool(r["expected_cited"]) for r in with_expected) / len(with_expected), 4)
            if with_expected else None
        ),
        "total_input_tokens": sum(r["input_tokens"] for r in valid),
        "total_output_tokens": sum(r["output_tokens"] for r in valid),
        "model": next((r["model"] for r in valid if r["model"]), None),
        "citation_validation": "identifier_membership_only; does not verify claim support",
    }
    return {"status": aggregate["status"], "per_query": per_query, "aggregate": aggregate}


def goldens_path_for(ws) -> str:
    """corpora/<slug>/ask_goldens.json (next to the workspace's evals.json)."""
    return os.path.join(os.path.dirname(ws.evals_path), "ask_goldens.json")


def run_ask_goldens(
    workspace: Optional[str] = None,
    top_k: int = 8,
    call: Optional[Callable] = None,
    write: bool = True,
) -> dict:
    """Fill the workspace's ask_goldens.json snapshots (measured, dated).

    Each golden case runs the SAME question under two roles; the interesting
    artifact is the answer pair diverging because RBAC changed the context.
    Returns the updated goldens dict; with write=True it is persisted back.
    """
    from src import ask as ask_mod
    from src.retriever import retrieve

    if call is None:
        call = ask_mod.call_model

    ws = get_workspace(workspace)
    path = goldens_path_for(ws)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"No ask_goldens.json for workspace {ws.slug!r} (expected {path})"
        )
    with open(path) as f:
        goldens = json.load(f)

    retriever = partial(retrieve, workspace=ws.slug)
    entries = []
    for case in goldens["cases"]:
        for role in case["roles"]:
            outcome = _ask_once(ws, retriever, case["query"], role, top_k, call)
            entries.append({
                "case_id": case["id"],
                "role": role,
                "model": outcome["model"],
                "answer": outcome["answer"],
                "citations": outcome["citations"],
                "blocked_count": outcome["blocked_count"],
                "input_tokens": outcome["input_tokens"],
                "output_tokens": outcome["output_tokens"],
            })

    goldens["snapshots"] = {
        "generated_at": date.today().isoformat(),
        "model": entries[0]["model"] if entries else None,
        "entries": entries,
    }
    if write:
        with open(path, "w") as f:
            json.dump(goldens, f, indent=2, ensure_ascii=False)
            f.write("\n")
    return goldens


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _print_results(results: dict, k: int) -> None:
    prec_key = f"precision_at_{k}"
    print()
    print("=" * 72)
    print("  QueryTrace — Evaluation Results")
    print("=" * 72)

    for r in results["per_query"]:
        if r.get("status") == "skipped":
            print(f"\n[{r['id']}] SKIPPED: {r['reason']}")
            continue
        if "error" in r:
            print(f"\n[{r['id']}] ERROR: {r['error']}")
            continue

        hit_marks = []
        for doc_id in r["assembled_ids"]:
            if doc_id in r["expected_ids"]:
                hit_marks.append(f"{doc_id}✓")
            elif doc_id in r["forbidden_ids"]:
                hit_marks.append(f"{doc_id}✗")
            else:
                hit_marks.append(doc_id)

        print(f"\n[{r['id']}] ({r['role']}) {r['query'][:65]}")
        print(f"  Assembled : {', '.join(hit_marks) if hit_marks else '(empty)'}")
        print(f"  Expected  : {r['expected_ids']}")
        print(
            f"  P@{k}={r[prec_key]:.2f}  Recall={r['recall']:.2f}"
            f"  Docs={r['context_docs']}  Tokens={r['total_tokens']}"
            f"  Blocked={r['blocked_count']}  Stale={r['stale_count']}"
            f"  Dropped={r['dropped_count']}  BudgetUtil={r['budget_utilization']:.0%}"
        )
        if r["permission_violations"]:
            print(f"  ⚠ PERMISSION VIOLATIONS: {r['permission_violations']}")

    agg = results["aggregate"]
    print()
    print("-" * 72)
    print("  Aggregate Summary")
    print("-" * 72)
    print(f"  Status               : {agg['status']}")
    print(f"  Completed / total    : {agg['queries_completed']} / {agg['queries_total']}")
    print(f"  Attempted / failed   : {agg['queries_attempted']} / {agg['queries_failed']}")
    print(f"  Skipped              : {agg['queries_skipped']}")
    print(f"  Metric denominator   : {agg['metric_denominator_queries']} completed queries")
    for key, value in agg.items():
        if key.startswith("avg_") or key == "permission_violation_rate":
            print(f"  {key:<30}: {value if value is not None else 'unavailable'}")
    print("=" * 72)
    print()


def _print_compare(naive: dict, full: dict, k: int, n_queries: int = 12,
                   workspace: str = "", baseline_name: str = "naive_top_k") -> None:
    """Comparison includes execution coverage; unavailable values stay absent."""
    keys = ["status", "queries_completed", "queries_failed", "queries_skipped",
            "permission_violation_rate", "avg_context_docs", "avg_context_chunks",
            f"avg_precision_at_{k}", "avg_recall", "avg_total_tokens"]
    print(f"\nQueryTrace — {workspace}: {n_queries} queries, {baseline_name} vs full_policy")
    print(f"{'Metric':<32} {baseline_name:>18} {'full_policy':>18}")
    for key in keys:
        print(f"{key:<32} {str(naive.get(key)):>18} {str(full.get(key)):>18}")
    if naive["status"] == full["status"] == "complete" and naive["avg_total_tokens"]:
        saving = 1 - full["total_selected_tokens"] / naive["total_selected_tokens"]
        print(f"Token change versus {baseline_name}: {saving:.2%} fewer (negative = more)")


def evaluation_exit_code(report: dict, require_permission_safety: bool = True) -> int:
    """Incomplete execution cannot pass an evaluation command or CI smoke."""
    agg = report["aggregate"]
    if report.get("status", agg.get("status")) != "complete":
        return 1
    if require_permission_safety and agg.get("permission_violation_rate") != 0.0:
        return 1
    return 0


def _print_ask_results(results: dict) -> None:
    agg = results["aggregate"]
    print()
    print("=" * 72)
    print("  QueryTrace — Ask-mode Evaluation (citation fidelity)")
    print("=" * 72)
    for r in results["per_query"]:
        if r.get("status") in ("failed", "skipped"):
            print(f"\n[{r['id']}] {r['status']}: {r.get('error', r.get('reason'))}")
            continue
        flag = "✓" if r["grounded"] else "∅"
        exp = (
            "-" if r["expected_cited"] is None
            else ("✓" if r["expected_cited"] else "✗")
        )
        print(f"\n[{r['id']}] ({r['role']}) {r['query'][:60]}")
        print(
            f"  citations={r['citations_valid']}/{r['citations_total']} valid"
            f"  grounded={flag}  expected_cited={exp}"
            f"  tokens={r['input_tokens']}in/{r['output_tokens']}out"
        )
        if r["invalid_citations"]:
            print(f"  ⚠ INVALID CITATIONS: {r['invalid_citations']}")
    print()
    print("-" * 72)
    validity = agg["citation_validity_rate"]
    expected = agg["expected_cited_rate"]
    print(f"  Model                  : {agg['model']}")
    print(f"  Citation validity rate : "
          f"{'n/a (no citations)' if validity is None else f'{validity:.0%}'}")
    print(f"  Status                 : {agg['status']}")
    print(f"  Completed / total      : {agg['queries_completed']} / {agg['queries_total']}")
    print(f"  Citation presence rate : {agg['groundedness_rate']}")
    print("  Validation             : identifier membership only, not semantic claim support")
    print(f"  Expected-cited rate    : "
          f"{'n/a' if expected is None else f'{expected:.0%}'}")
    print(f"  Tokens                 : {agg['total_input_tokens']} in / "
          f"{agg['total_output_tokens']} out")
    print("=" * 72)
    print()


def _print_goldens(goldens: dict) -> None:
    print()
    print("=" * 72)
    print("  QueryTrace — Ask goldens (same question, different role)")
    print("=" * 72)
    entries = goldens["snapshots"]["entries"]
    for case in goldens["cases"]:
        print(f"\n◆ [{case['id']}] {case['query']}")
        for e in [x for x in entries if x["case_id"] == case["id"]]:
            cited = ", ".join(
                c["doc_id"] + ("" if c["valid"] else "⚠") for c in e["citations"]
            ) or "(none)"
            preview = e["answer"][:140].replace("\n", " ")
            print(f"  [{e['role']:8s}] cites: {cited} · blocked_docs={e['blocked_count']}")
            print(f"             {preview}…")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run QueryTrace evals")
    parser.add_argument("--workspace", default=None,
                        help="Workspace slug to evaluate (default: the default workspace)")
    parser.add_argument("--evals", default=None,
                        help="Path to an evals JSON file "
                             "(default: the workspace's evals.json)")
    parser.add_argument("--k", type=int, default=5,
                        help="k for precision@k (default 5)")
    parser.add_argument("--top-k", type=int, default=8,
                        help="k=chunks for top-k baseline; k=max documents with 6*k "
                             "candidate chunks for filtered policies (default 8)")
    parser.add_argument("--compare", action="store_true",
                        help="Compare exact top-k chunks, whole corpus, and full policy")
    parser.add_argument("--output", default=None,
                        help="Write the detailed report JSON to this path")
    parser.add_argument("--ask", action="store_true",
                        help="Run the benchmark through the Ask path and measure "
                             "citation validity (requires ANTHROPIC_API_KEY; "
                             "spends tokens — cents with the default Haiku model)")
    parser.add_argument("--ask-goldens", action="store_true",
                        help="Regenerate the workspace's ask_goldens.json snapshots "
                             "(requires ANTHROPIC_API_KEY; spends tokens)")
    args = parser.parse_args()

    ws = get_workspace(args.workspace)

    if args.ask or args.ask_goldens:
        from src.ask import ask_enabled

        if not ask_enabled():
            parser.error(
                "--ask/--ask-goldens call the live model and need "
                "ANTHROPIC_API_KEY in the environment (never committed anywhere). "
                "A full run costs cents with the default Haiku model."
            )

    if args.ask_goldens:
        print(f"[{ws.slug}] Regenerating ask goldens (live model calls)...")
        goldens = run_ask_goldens(workspace=ws.slug, top_k=args.top_k)
        _print_goldens(goldens)
        print(f"Snapshots written to {goldens_path_for(ws)}")
        return

    evals_path = args.evals if args.evals is not None else ws.evals_path
    if not os.path.isfile(evals_path):
        print(f"[{ws.slug}] Evaluations unavailable: create {evals_path} with a queries array.")
        return 1
    queries = load_test_queries(evals_path)
    print(f"[{ws.slug}] Loaded {len(queries)} queries from {evals_path}")
    print("Running pipeline (this may take a moment for model loading)...")

    if args.ask:
        results = run_ask_evals(queries, top_k=args.top_k, workspace=ws.slug)
        _print_ask_results(results)
        os.makedirs(_RESULTS_DIR, exist_ok=True)
        snapshot_path = os.path.join(
            _RESULTS_DIR, f"ask-{date.today().isoformat()}-{ws.slug}.json"
        )
        with open(snapshot_path, "w") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Snapshot written to {snapshot_path}")
        return evaluation_exit_code(results, require_permission_safety=False)

    if args.compare:
        reports = {policy: run_evals(queries, k=args.k, top_k=args.top_k,
                                    policy_name=policy, workspace=ws.slug)
                   for policy in ("naive_top_k", "whole_corpus", "full_policy")}
        for baseline in ("naive_top_k", "whole_corpus"):
            _print_compare(reports[baseline]["aggregate"], reports["full_policy"]["aggregate"],
                           k=args.k, n_queries=len(queries), workspace=ws.slug,
                           baseline_name=baseline)
        if args.output:
            with open(args.output, "w") as target:
                json.dump(reports, target, indent=2)
        return max(evaluation_exit_code(report, require_permission_safety=policy == "full_policy")
                   for policy, report in reports.items())

    results = run_evals(queries, k=args.k, top_k=args.top_k, workspace=ws.slug)
    _print_results(results, k=args.k)
    if args.output:
        with open(args.output, "w") as target:
            json.dump(results, target, indent=2)
    return evaluation_exit_code(results)


if __name__ == "__main__":
    sys.exit(main())
