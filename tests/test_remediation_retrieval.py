"""Regression coverage for truthful retrieval, accounting, and evaluation.

The real-corpus checks use local ONNX embeddings, never an answer provider.
"""
from functools import partial
import json
from pathlib import Path

import pytest

from src import evaluator
from src.models import FreshnessScoredDocument, QueryRequest
from src.pipeline import run_pipeline
from src.policies import document_is_authorized
from src.retriever import retrieve
from src.stages.budget_packer import pack_budget
from src.stages.trace_builder import summarize_documents
from src.workspaces import get_workspace


WORKSPACES = ["pe-deal", "saas-internal"]
OUT_OF_DOMAIN = [
    "How do I bake a chocolate cake?",
    "What is the weather in Tokyo?",
    "Explain quantum entanglement",
    "Help me plan a yoga workout",
    "How do I build a binary search tree?",
]


def run_real(slug, query, role=None, **kwargs):
    ws = get_workspace(slug)
    role = role or max(ws.roles, key=lambda r: ws.roles[r]["access_rank"])
    return run_pipeline(QueryRequest(query=query, role=role, **kwargs),
                        partial(retrieve, workspace=slug), ws.roles, ws.metadata)


@pytest.mark.parametrize("slug", WORKSPACES)
def test_baselines_distinguish_exact_top_k_chunks_from_whole_corpus(slug):
    ws = get_workspace(slug)
    query = ws.manifest["scenarios"][0]["query"]
    top = run_real(slug, query, top_k=3, policy_name="naive_top_k")
    all_rows = run_real(slug, query, top_k=3, policy_name="whole_corpus")
    row_count = len(json.loads(Path(ws.index_docs_path).read_text()))
    assert len(top.context) == top.trace.metrics.retrieved_count == 3
    assert len(all_rows.context) == all_rows.trace.metrics.retrieved_count == row_count
    assert top.trace.policy_config.top_k_unit == "chunks"
    assert all_rows.trace.policy_config.top_k_unit == "unused"
    assert [d.chunk_id for d in top.context] == [d["chunk_id"] for d in retrieve(query, 3, slug)]
    assert all_rows.total_tokens > top.total_tokens


@pytest.mark.parametrize("slug", WORKSPACES)
@pytest.mark.parametrize("query", OUT_OF_DOMAIN)
def test_unrelated_queries_abstain_without_mistaking_rank_for_confidence(slug, query):
    ranked = retrieve(query, 8, slug)
    # The relative winner still exists. Its rank cannot authorize context assembly.
    assert ranked[0]["score"] == pytest.approx(1.0)
    assert max(d["semantic_similarity"] for d in ranked) < 0.25
    result = run_real(slug, query, top_k=8)
    trace = result.trace
    assert not result.context and not result.total_tokens
    assert trace.result_status == "insufficient_evidence"
    assert trace.evidence.applied and trace.evidence.sufficient is False
    assert trace.metrics.insufficient_evidence_count == trace.metrics.retrieved_count
    assert all(d.reason == "insufficient_evidence" for d in trace.dropped_by_budget)


@pytest.mark.parametrize("slug", WORKSPACES)
def test_ambiguous_query_is_not_claimed_to_have_a_certain_answer(slug):
    result = run_real(slug, "What changed?")
    assert result.trace.result_status == "insufficient_evidence"
    assert result.trace.score_kind == "relative_rrf_rank"


@pytest.mark.parametrize("slug", WORKSPACES)
def test_all_benchmark_queries_keep_evidence_and_all_roles_obey_authorization(slug):
    ws = get_workspace(slug)
    docs = {d["id"]: d for d in ws.metadata["documents"]}
    for q in evaluator.load_test_queries(ws.evals_path):
        for role in ws.roles:
            result = run_real(slug, q["query"], role, top_k=8)
            assert result.trace.evidence.applied
            assert all(document_is_authorized(docs[d.doc_id], role, ws.roles)
                       for d in result.context)
        result = run_real(slug, q["query"], q["role"], top_k=8)
        assert result.trace.result_status == "ok", q["id"]
        assert result.trace.evidence.sufficient
        assert result.context


@pytest.mark.parametrize("slug", WORKSPACES)
def test_zero_budget_explains_every_excluded_chunk(slug):
    ws = get_workspace(slug)
    result = run_real(slug, ws.manifest["scenarios"][0]["query"], token_budget=0)
    assert not result.context
    assert result.trace.result_status == "budget_exhausted"
    assert all(d.reason == "token_budget" for d in result.trace.dropped_by_budget)
    assert result.trace.metrics.dropped_count == result.trace.metrics.retrieved_count


def test_document_cap_has_distinct_reason_and_partial_tokens_reconcile():
    chunks = [FreshnessScoredDocument(
        doc_id=did, score=score, excerpt=text, min_role="analyst",
        freshness_score=score, chunk_id=f"{did}#c{i}", chunk_count=count,
    ) for did, i, score, text, count in [
        ("a", 1, .9, "first chunk", 2), ("a", 2, .8, "second chunk", 2),
        ("b", 1, .7, "other", 1),
    ]]
    packed = pack_budget(chunks, token_budget=1000, max_docs=1)
    assert [d.reason for d in packed.over_budget] == ["document_limit"]
    rows = summarize_documents(packed.packed, [], packed.over_budget)
    assert rows[0].token_count == sum(d.token_count for d in packed.packed)
    assert rows[0].status == "included"
    partial = pack_budget(chunks, token_budget=3)
    rows = summarize_documents(partial.packed, [], partial.over_budget)
    assert next(d for d in rows if d.doc_id == "a").status == "partial"
    assert sum(d.token_count for d in rows) == partial.total_tokens


def test_freshness_annotations_distinguish_demoted_candidates_and_final_context():
    query = get_workspace("pe-deal").manifest["scenarios"][2]["query"]
    result = run_real("pe-deal", query, top_k=8, token_budget=0)
    trace = result.trace
    assert trace.metrics.stale_candidate_doc_count > 0
    assert trace.metrics.stale_doc_count > 0
    assert trace.metrics.stale_included_doc_count == 0
    assert all(d.final_outcome == "token_budget" for d in trace.demoted_as_stale)
    assert trace.freshness_reference_date == "2024-04-18"
    skipped = run_real("pe-deal", query, policy_name="permission_aware")
    assert not skipped.trace.demoted_as_stale
    assert skipped.trace.metrics.stale_count == 0
    assert skipped.trace.freshness_reference_date is None


def test_empty_corpus_and_permission_wall_have_distinct_traces():
    roles = {"reader": {"access_rank": 1}, "owner": {"access_rank": 2}}
    req = QueryRequest(query="question", role="reader")
    empty = run_pipeline(req, lambda q, k: [], roles, {"documents": []})
    assert empty.trace.result_status == "empty_corpus"
    doc = {"doc_id": "private", "score": 1., "semantic_similarity": .8,
           "excerpt": "restricted", "min_role": "owner", "date": "2024-01-01"}
    blocked = run_pipeline(req, lambda q, k: [doc], roles,
                           {"documents": [{"id": "private", "date": "2024-01-01"}]})
    assert blocked.trace.result_status == "blocked_by_permissions"
    assert blocked.trace.metrics.blocked_count == 1
    assert not blocked.context


@pytest.mark.parametrize("slug", WORKSPACES)
def test_trace_unique_document_partition_and_token_sum(slug):
    ws = get_workspace(slug)
    result = run_real(slug, ws.manifest["scenarios"][0]["query"], top_k=8)
    m, rows = result.trace.metrics, result.trace.document_summaries
    assert m.retrieved_doc_count == len(rows) == len({d.doc_id for d in rows})
    assert m.fully_included_doc_count + m.partially_included_doc_count + m.excluded_doc_count + m.blocked_doc_count == m.retrieved_doc_count
    assert sum(d.token_count for d in rows) == result.total_tokens
    assert sum(d.included_chunks + d.blocked_chunks + d.dropped_chunks for d in rows) == m.retrieved_count


def test_evaluator_checks_actual_permissions_without_forbidden_annotations():
    report = evaluator.run_evals([{"id": "no-annotations", "query": "annual revenue",
                                  "role": "analyst", "expected_doc_ids": []}],
                                 policy_name="whole_corpus", workspace="pe-deal")
    row, agg = report["per_query"][0], report["aggregate"]
    ws = get_workspace("pe-deal")
    forbidden = {d["id"] for d in ws.metadata["documents"]
                 if not document_is_authorized(d, "analyst", ws.roles)}
    assert set(row["permission_violations"]) == forbidden
    assert agg["permission_violation_rate"] == 1.
    assert agg["queries_with_permission_violations"] == 1
    assert agg["permission_violation_documents"] == len(forbidden)
    assert agg["permission_violation_chunks"] > len(forbidden)
    assert agg["metric_denominator_queries"] == 1


def test_evaluator_missing_document_is_an_authorization_violation(monkeypatch):
    from src.models import IncludedDocument, PipelineResult
    real = run_real("pe-deal", "ARR growth")
    rogue = IncludedDocument(doc_id="not-in-workspace", content="x", score=1,
                             freshness_score=1, token_count=1)
    monkeypatch.setattr("src.pipeline.run_pipeline", lambda *a: PipelineResult(
        context=[rogue], total_tokens=1, trace=real.trace))
    report = evaluator.run_evals([{"id": "rogue", "query": "q", "role": "partner"}])
    assert report["per_query"][0]["permission_violations"] == ["not-in-workspace"]


@pytest.mark.parametrize("failures,expected", [(1, "incomplete"), (2, "failed")])
def test_partial_and_total_eval_failures_are_not_success(monkeypatch, failures, expected):
    import src.pipeline
    original = src.pipeline.run_pipeline
    calls = []

    def fail_some(*args):
        calls.append(None)
        if len(calls) <= failures:
            raise RuntimeError("injected service failure")
        return original(*args)

    monkeypatch.setattr(src.pipeline, "run_pipeline", fail_some)
    qs = evaluator.load_test_queries(get_workspace("pe-deal").evals_path)[:2]
    report = evaluator.run_evals(qs)
    agg = report["aggregate"]
    assert report["status"] == expected
    assert agg["queries_total"] == agg["queries_attempted"] == 2
    assert agg["queries_completed"] == agg["queries_run"] == 2 - failures
    assert agg["queries_failed"] == failures
    assert agg["metric_denominator_queries"] == 2 - failures
    if failures == 2:
        assert agg["permission_violation_rate"] is None
        assert agg["avg_precision_at_5"] is None
    assert evaluator.evaluation_exit_code(report) == 1
    evaluator._print_results(report, 5)  # formatting handles null metrics


def test_unrun_unavailable_and_skipped_evaluations_remain_explicit():
    for report in [evaluator.run_evals([]), evaluator.empty_evaluation(),
                   evaluator.run_evals([{"id": "skip", "skip": "disabled"}])]:
        assert report["status"] in ("unavailable", "not_run")
        assert report["aggregate"]["permission_violation_rate"] is None
        assert evaluator.evaluation_exit_code(report) == 1
    queries = evaluator.load_test_queries(get_workspace().evals_path)[:1]
    report = evaluator.run_evals(queries + [{"id": "skip", "skip": "disabled"}])
    assert report["status"] == "incomplete"
    assert report["aggregate"]["queries_skipped"] == 1
    assert report["aggregate"]["queries_attempted"] == 1


def test_evaluator_cli_compare_fails_when_all_queries_fail(monkeypatch):
    monkeypatch.setattr("src.pipeline.run_pipeline", lambda *a: (_ for _ in ()).throw(RuntimeError("down")))
    monkeypatch.setattr("sys.argv", ["evaluator", "--compare"])
    assert evaluator.main() == 1


def test_authoritative_metadata_overrides_older_index_permission_labels():
    roles = {"reader": {"access_rank": 1}, "owner": {"access_rank": 2}}
    req = QueryRequest(query="question", role="reader")
    stale_payload = {"doc_id": "private", "score": 1., "excerpt": "private content",
                     "min_role": "reader", "semantic_similarity": .9}
    metadata = {"documents": [{"id": "private", "date": "2024-01-01", "min_role": "owner"}]}
    result = run_pipeline(req, lambda q, k: [stale_payload], roles, metadata)
    assert result.trace.result_status == "blocked_by_permissions"
    assert not result.context
    assert result.trace.blocked_by_permission[0].required_role == "owner"


@pytest.mark.parametrize("failures,status", [(1, "incomplete"), (2, "failed")])
def test_ask_evaluator_failures_keep_denominators(failures, status):
    from src.ask import ModelReply
    calls = []

    def provider(system, user):
        calls.append(user)
        if len(calls) <= failures:
            raise RuntimeError("fake provider unavailable")
        return ModelReply(text="A statement [doc_001].", model="deterministic-test",
                          input_tokens=10, output_tokens=5)

    queries = evaluator.load_test_queries(get_workspace().evals_path)[:2]
    report = evaluator.run_ask_evals(queries, call=provider)
    agg = report["aggregate"]
    assert report["status"] == status
    assert agg["queries_failed"] == failures
    assert agg["queries_completed"] == 2 - failures
    assert evaluator.evaluation_exit_code(report, require_permission_safety=False) == 1
    if failures == 2:
        assert agg["citation_validity_rate"] is None
        assert agg["groundedness_rate"] is None
    evaluator._print_ask_results(report)


def test_ask_evaluator_does_not_call_provider_without_evidence():
    def provider(*args):
        raise AssertionError("provider must not run")

    report = evaluator.run_ask_evals([{"id": "unrelated", "query": OUT_OF_DOMAIN[0],
                                       "role": "analyst"}], call=provider)
    assert report["status"] == "complete"
    assert report["aggregate"]["queries_without_context"] == 1
    assert report["aggregate"]["total_input_tokens"] == 0
    assert report["aggregate"]["citation_validity_rate"] is None
