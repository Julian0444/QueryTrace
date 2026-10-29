"""Recheck saved Ask answers without making an answer-provider call.

Run: python -m tests.verify_recorded_fixtures --output /tmp/recorded-fixtures.json
A current-context replay is NOT a reconstruction of the historical prompt.
"""
import argparse
from datetime import datetime, timezone
from functools import partial
import hashlib
import json
from pathlib import Path

from src import ask
from src.models import QueryRequest
from src.pipeline import run_pipeline
from src.policies import document_is_authorized
from src.retriever import retrieve
from src.storage import corpus_lock
from src.workspaces import get_workspace


REPLAY_CONFIG = {"policy_name": "full_policy", "top_k": 8, "token_budget": 2048,
                 "prompt_context_cap": 4096}


def verify_recorded_fixtures(repo=None):
    """Report what the persisted evidence can and cannot prove mechanically."""
    repo = Path(repo) if repo else Path(__file__).resolve().parents[1]
    golden_path = repo / "corpora/pe-deal/ask_goldens.json"
    preview_path = repo / "evals/results/ask-2026-07-06-pe-deal.json"
    goldens = json.loads(golden_path.read_text())
    historical_evals = json.loads(preview_path.read_text())
    cases = {case["id"]: case for case in goldens["cases"]}
    ws = get_workspace(goldens["workspace"])
    rows = []
    with corpus_lock(ws.root):
        ws = get_workspace(ws.slug)
        metadata = {d["id"]: d for d in ws.metadata["documents"]}
        corpus_fingerprint = hashlib.sha256(
            Path(ws.index_docs_path).read_bytes() + Path(ws.metadata_path).read_bytes()
        ).hexdigest()
        for entry in goldens["snapshots"]["entries"]:
            case = cases[entry["case_id"]]
            # These are today's explicit replay parameters, not inferred historical ones.
            request = QueryRequest(query=case["query"], role=entry["role"],
                                   workspace=ws.slug, policy_name=REPLAY_CONFIG["policy_name"],
                                   top_k=REPLAY_CONFIG["top_k"],
                                   token_budget=REPLAY_CONFIG["token_budget"])
            selected = run_pipeline(request, partial(retrieve, workspace=ws.slug),
                                    ws.roles, ws.metadata)
            prompt_docs = ask.trim_to_context_cap(
                selected.context, max_context_tokens=REPLAY_CONFIG["prompt_context_cap"])
            prompt_ids = list(dict.fromkeys(d.doc_id for d in prompt_docs))
            parsed = ask.extract_citations(entry["answer"], prompt_ids)
            extracted_ids = [c.doc_id for c in parsed]
            recorded_ids = [c["doc_id"] for c in entry["citations"]]
            rows.append({
                "case_id": entry["case_id"], "role": entry["role"],
                "answer_sha256": hashlib.sha256(entry["answer"].encode()).hexdigest(),
                "recorded_citation_ids": recorded_ids,
                "extracted_citation_ids": extracted_ids,
                "omitted_by_recorded_parser": [i for i in extracted_ids if i not in recorded_ids],
                "unknown_corpus_ids": [i for i in extracted_ids if i not in metadata],
                "unauthorized_ids": [i for i in extracted_ids
                                     if not document_is_authorized(metadata.get(i, {}), entry["role"], ws.roles)],
                "current_context_ids": prompt_ids,
                "current_context_chunk_ids": [d.chunk_id for d in prompt_docs],
                "current_context_tokens_estimated": sum(d.token_count for d in prompt_docs),
                "current_context_membership": [c.model_dump() for c in parsed],
                "absent_from_current_context": [c.doc_id for c in parsed if not c.valid],
                "historical_context_membership": "unverifiable: historical prompt/context IDs were not saved",
                "semantic_claim_support": "not_checked",
            })
    preview_rows = [{
        "id": row["id"], "role": row["role"],
        "preview_characters": len(row["answer_preview"]),
        "visible_complete_citation_ids": [c.doc_id for c in ask.extract_citations(row["answer_preview"], [])],
        "full_answer_citations": "unverifiable: only a truncated preview was saved",
        "historical_context_membership": "unverifiable: historical context IDs were not saved",
    } for row in historical_evals["per_query"]]
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "validation_kind": "offline_mechanical_reparse_and_current_context_replay",
        "answer_provider_calls": 0,
        "workspace": ws.slug,
        "corpus_fingerprint": corpus_fingerprint,
        "replay_config": REPLAY_CONFIG,
        "goldens": {
            "source": str(golden_path.relative_to(repo)),
            "recorded_at": goldens["snapshots"]["generated_at"],
            "answers_available": len(rows),
            "recorded_unique_citations_per_answer_total": sum(len(r["recorded_citation_ids"]) for r in rows),
            "reparsed_unique_citations_per_answer_total": sum(len(r["extracted_citation_ids"]) for r in rows),
            "newly_recovered_ids_total": sum(len(r["omitted_by_recorded_parser"]) for r in rows),
            "unknown_ids_total": sum(len(r["unknown_corpus_ids"]) for r in rows),
            "unauthorized_ids_total": sum(len(r["unauthorized_ids"]) for r in rows),
            "absent_from_current_context_total": sum(len(r["absent_from_current_context"]) for r in rows),
            "historical_citation_validity_rate_recomputed": None,
            "entries": rows,
        },
        "historical_evaluation": {
            "source": str(preview_path.relative_to(repo)),
            "status": "historical_unverifiable_from_truncated_previews",
            "reported_aggregate": historical_evals["aggregate"],
            "citation_validity_rate_recomputed": None,
            "entries": preview_rows,
        },
        "limitations": [
            "Corpus existence and role authorization can be checked for every extracted ID.",
            "Current replay membership is a compatibility check, not evidence of the historical prompt.",
            "Neither identifier membership nor a valid citation proves semantic support for a claim.",
            "Provider output, usage, and historical aggregate rates were preserved, not regenerated.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--repo", type=Path)
    args = parser.parse_args()
    report = verify_recorded_fixtures(args.repo)
    payload = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload)
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
