"""
trace_builder.py — Reducer/aggregator: assembles DecisionTrace from stage outputs.

Takes the outputs of all upstream stages and produces a first-class
DecisionTrace with structured decision outcomes and aggregate metrics.
"""

from __future__ import annotations

from typing import List, Optional

from src.models import (
    BlockedDocument,
    DecisionTrace,
    DocumentDecisionSummary,
    DroppedByBudget,
    EvidenceAssessment,
    IncludedDocument,
    PolicyConfig,
    ScoredDocument,
    StaleDocument,
    TraceMetrics,
    UserContext,
)


class TraceAccountingError(RuntimeError):
    """Internal accounting invariant violated (blocked + included + dropped
    != retrieved). Deliberately NOT a ValueError: the HTTP boundary maps
    ValueError to 400 (bad request), but this is a server-side bug and must
    surface as 500."""


def summarize_documents(included, blocked, dropped, prompt_excluded=()):
    """Aggregate tokens once per document, retaining its distinct chunk outcomes."""
    groups = {}
    for kind, entries in [("included", included), ("blocked", blocked),
                          ("dropped", dropped), ("dropped", prompt_excluded)]:
        for d in entries:
            row = groups.setdefault(d.doc_id, {
                "doc_id": d.doc_id, "title": d.title, "included_chunks": 0,
                "dropped_chunks": 0, "blocked_chunks": 0, "token_count": 0,
                "retrieved_chunks": 0, "available_chunks": None, "reasons": [],
            })
            row[kind + "_chunks"] += 1
            row["retrieved_chunks"] += 1
            count = getattr(d, "chunk_count", None)
            if count is not None:
                row["available_chunks"] = max(row["available_chunks"] or 0, count)
            if kind == "included":
                row["token_count"] += d.token_count
            else:
                reason = getattr(d, "reason", "prompt_budget")
                if reason not in row["reasons"]:
                    row["reasons"].append(reason)
    summaries = []
    for row in groups.values():
        if row["included_chunks"]:
            partial = (row["dropped_chunks"] or row["blocked_chunks"] or
                       row["included_chunks"] < (row["available_chunks"] or 0))
            row["status"] = "partial" if partial else "included"
        else:
            row["status"] = "blocked" if row["blocked_chunks"] else "excluded"
        summaries.append(DocumentDecisionSummary(**row))
    return summaries


def build_trace(
    user_ctx: UserContext,
    policy: PolicyConfig,
    retrieved_count: int,
    included: List[IncludedDocument],
    blocked: List[BlockedDocument],
    stale: List[StaleDocument],
    dropped: List[DroppedByBudget],
    total_tokens: int,
    budget_utilization: float,
    ttft_proxy_ms: float,
    candidates: Optional[List[ScoredDocument]] = None,
    result_status: str = "ok",
    evidence: Optional[EvidenceAssessment] = None,
    freshness_reference_date: Optional[str] = None,
) -> DecisionTrace:
    """Assemble the full audit trace from all stage outputs.

    Args:
        user_ctx:           Who made the request.
        policy:             Policy config used for this run.
        retrieved_count:    Number of raw candidates from the retriever.
        included:           Documents that made it into final context.
        blocked:            Documents blocked by permission filter.
        stale:              Superseded documents (demoted, not removed).
        dropped:            Documents cut by the token budget.
        total_tokens:       Total tokens in the assembled context.
        budget_utilization: Fraction of token budget used (0.0–1.0).
        ttft_proxy_ms:      Pipeline execution time in milliseconds.

    Returns:
        A fully populated DecisionTrace.
    """
    # Invariant: every retrieved CHUNK must end up in exactly one bucket.
    # Counts are chunk-level since Fase 5 Etapa B (the retrieval unit is the
    # chunk); doc-level views are derived below for the UI.
    accounted = len(blocked) + len(included) + len(dropped)
    if accounted != retrieved_count:
        raise TraceAccountingError(
            f"Chunk accounting mismatch: "
            f"blocked({len(blocked)}) + included({len(included)}) + "
            f"dropped({len(dropped)}) = {accounted}, expected {retrieved_count}"
        )
    if sum(d.token_count for d in included) != total_tokens:
        raise TraceAccountingError("Included chunk tokens do not reconcile with total_tokens")

    summaries = summarize_documents(included, blocked, dropped)
    included_keys = {(d.doc_id, d.chunk_id) for d in included}
    dropped_reasons = {(d.doc_id, d.chunk_id): d.reason for d in dropped}
    stale = [d.model_copy(update={
        "final_outcome": "included" if (d.doc_id, d.chunk_id) in included_keys
        else dropped_reasons.get((d.doc_id, d.chunk_id), "not_in_context")
    }) for d in stale]
    stale_candidates = [d for d in candidates or [] if d.superseded_by]
    stale_included = [d for d in included if d.superseded_by]

    avg_score = (
        sum(d.score for d in included) / len(included) if included else 0.0
    )
    avg_freshness = (
        sum(d.freshness_score for d in included) / len(included) if included else 0.0
    )

    metrics = TraceMetrics(
        retrieved_count=retrieved_count,
        blocked_count=len(blocked),
        stale_count=len(stale),
        dropped_count=len(dropped),
        included_count=len(included),
        total_tokens=total_tokens,
        budget_utilization=budget_utilization,
        avg_score=round(avg_score, 6),
        avg_freshness_score=round(avg_freshness, 6),
        included_doc_count=len({d.doc_id for d in included}),
        blocked_doc_count=len({d.doc_id for d in blocked}),
        stale_doc_count=len({d.doc_id for d in stale}),
        dropped_doc_count=len({d.doc_id for d in dropped}),
        retrieved_doc_count=len(summaries),
        partially_included_doc_count=sum(d.status == "partial" for d in summaries),
        fully_included_doc_count=sum(d.status == "included" for d in summaries),
        excluded_doc_count=sum(d.status == "excluded" for d in summaries),
        stale_candidate_count=len(stale_candidates),
        stale_candidate_doc_count=len({d.doc_id for d in stale_candidates}),
        stale_included_count=len(stale_included),
        stale_included_doc_count=len({d.doc_id for d in stale_included}),
        insufficient_evidence_count=sum(d.reason == "insufficient_evidence" for d in dropped),
    )

    return DecisionTrace(
        user_context=user_ctx,
        policy_config=policy,
        included=included,
        blocked_by_permission=blocked,
        demoted_as_stale=stale,
        dropped_by_budget=dropped,
        document_summaries=summaries,
        result_status=result_status,
        evidence=evidence or EvidenceAssessment(),
        freshness_reference_date=freshness_reference_date,
        total_tokens=total_tokens,
        ttft_proxy_ms=round(ttft_proxy_ms, 2),
        metrics=metrics,
    )
