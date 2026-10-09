"""
pipeline.py — Explicit orchestrator for the QueryTrace retrieval pipeline.

Flow:
  retrieve → permission_filter → freshness_scorer → budget_packer → trace_builder

Each stage returns a typed result.  The pipeline wraps each call in
StageOk / StageErr and aborts on first failure via PipelineError.
No I/O is performed here — all external dependencies are injected
via Protocol.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, List, Union

from src.models import (
    DroppedByBudget,
    EvidenceAssessment,
    FreshnessScoredDocument,
    PipelineResult,
    QueryRequest,
    ScoredDocument,
    UserContext,
)
from src.policies import resolve_policy
from src.protocols import MetadataStoreProtocol, RetrieverProtocol, RoleStoreProtocol
from src.stages import filter_permissions, score_freshness, pack_budget, build_trace
from src.stages.budget_packer import _count_tokens


# ---------------------------------------------------------------------------
# Stage result types
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StageOk:
    """A stage completed successfully."""
    value: Any


@dataclass(frozen=True)
class StageErr:
    """A stage failed."""
    stage: str
    error: str


StageResult = Union[StageOk, StageErr]


class PipelineError(Exception):
    """Raised when a pipeline stage fails.  Caught by the HTTP boundary."""

    def __init__(self, stage: str, error: str):
        self.stage = stage
        self.error = error
        super().__init__(f"Pipeline failed at '{stage}': {error}")


def _unwrap(result: StageResult) -> Any:
    """Extract value from StageOk, or raise PipelineError from StageErr."""
    if isinstance(result, StageErr):
        raise PipelineError(result.stage, result.error)
    return result.value


# ---------------------------------------------------------------------------
# Stage wrappers (thin error boundaries around typed stages)
# ---------------------------------------------------------------------------

def _retrieve_stage(
    query: str,
    top_k: int,
    retriever: RetrieverProtocol,
) -> StageResult:
    """Call the retriever and validate each result into ScoredDocument."""
    try:
        raw_dicts = retriever(query, top_k)
        docs = [ScoredDocument.model_validate(d) for d in raw_dicts]
        return StageOk(docs)
    except Exception as e:
        return StageErr(stage="retrieve", error=str(e))


def _permission_stage(docs, user_ctx, roles, policy) -> StageResult:
    if policy.skip_permission_filter:
        from src.stages.permission_filter import PermissionResult
        return StageOk(PermissionResult(permitted=docs, blocked=[]))
    try:
        return StageOk(filter_permissions(docs, user_ctx, roles))
    except Exception as e:
        return StageErr(stage="permission_filter", error=str(e))


def _freshness_stage(docs, metadata, policy) -> StageResult:
    if policy.skip_freshness:
        scored = [
            FreshnessScoredDocument(
                **doc.model_dump(), freshness_score=0.0, is_stale=False,
            )
            for doc in docs
        ]
        from src.stages.freshness_scorer import FreshnessResult
        return StageOk(FreshnessResult(scored=scored, stale=[]))
    try:
        return StageOk(score_freshness(docs, metadata, policy.half_life_days))
    except Exception as e:
        return StageErr(stage="freshness", error=str(e))


def _budget_stage(docs, policy) -> StageResult:
    try:
        return StageOk(pack_budget(
            docs,
            token_budget=policy.token_budget,
            enforce_budget=not policy.skip_budget,
            # H4 (Fase 5 Etapa B): top_k caps UNIQUE PARENT DOCUMENTS in the
            # final context; the token budget is the second limit. The naive
            # baseline (skip_budget) stays uncapped by design.
            max_docs=None if policy.skip_budget else policy.top_k,
        ))
    except Exception as e:
        return StageErr(stage="budget_packer", error=str(e))


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_pipeline(
    request: QueryRequest,
    retriever: RetrieverProtocol,
    roles: RoleStoreProtocol,
    metadata: MetadataStoreProtocol,
) -> PipelineResult:
    """Execute the full retrieval pipeline.

    Sequence: retrieve → permission_filter → freshness → budget_packer → trace.
    Aborts on first stage failure with PipelineError.

    Args:
        request:   Validated query request (query, role, top_k, policy_name).
        retriever: Callable satisfying RetrieverProtocol.
        roles:     Role definitions (role_name → dict with access_rank).
        metadata:  Raw corpus metadata (dict with "documents" key).

    Returns:
        PipelineResult with context, total_tokens, and decision trace.

    Raises:
        PipelineError: if any stage fails.
    """
    t0 = time.monotonic()

    # Resolve policy preset and build user context
    policy = resolve_policy(request.policy_name, request.top_k)
    if request.token_budget is not None:
        policy = policy.model_copy(update={"token_budget": request.token_budget})
    user_rank = roles[request.role]["access_rank"]
    user_ctx = UserContext(role=request.role, access_rank=user_rank)

    # Retrieval units are explicit. The unfiltered top-k baseline returns
    # exactly k ranked chunks; whole_corpus uses the retriever's all-rows
    # sentinel (0). Filtered policies inspect 6*k chunks and cap the final
    # context at k unique parent documents plus the token budget.
    retrieve_k = (0 if policy.retrieval_mode == "whole_corpus" else
                  policy.top_k if policy.retrieval_mode == "top_k_chunks" else
                  policy.top_k * policy.candidate_multiplier)
    candidates: List[ScoredDocument] = _unwrap(
        _retrieve_stage(request.query, retrieve_k, retriever)
    )
    # Workspace metadata is authoritative even if an injected/legacy index
    # payload carries an older version or permission label.
    meta_by_id = {d["id"]: d for d in metadata["documents"]}
    candidates = [d.model_copy(update={
        key: meta_by_id[d.doc_id][key]
        for key in ("min_role", "superseded_by", "date")
        if key in meta_by_id.get(d.doc_id, {})
    }) for d in candidates]

    # Stage 2 — Permission filter
    perm_result = _unwrap(_permission_stage(candidates, user_ctx, roles, policy))

    # An RRF rank always has a winner, even for an unrelated query. Preserve
    # cosine magnitude and require a conservative amount of query-level
    # evidence among PERMITTED candidates before assembling a context.
    # This is an abstention heuristic, not calibrated confidence. Injected
    # legacy retrievers without cosine expose an unavailable assessment.
    similarities = [d.semantic_similarity for d in perm_result.permitted
                    if d.semantic_similarity is not None]
    maximum = max(similarities) if similarities else None
    evidence = EvidenceAssessment(
        applied=not policy.skip_evidence_gate and maximum is not None,
        sufficient=maximum >= policy.evidence_threshold if maximum is not None else None,
        max_semantic_similarity=maximum,
        threshold=policy.evidence_threshold,
    )
    rejected_for_evidence = []
    supported = perm_result.permitted
    if evidence.applied and not evidence.sufficient:
        rejected_for_evidence = [DroppedByBudget(
            doc_id=d.doc_id, chunk_id=d.chunk_id, title=d.title,
            token_count=_count_tokens(d.excerpt), score=d.score,
            semantic_similarity=d.semantic_similarity, freshness_score=0.0,
            reason="insufficient_evidence",
        ) for d in supported]
        supported = []

    # Stage 3 — Freshness scorer
    fresh_result = _unwrap(_freshness_stage(supported, metadata, policy))

    # Stage 4 — Budget packer
    budget_result = _unwrap(_budget_stage(fresh_result.scored, policy))

    if budget_result.packed:
        result_status = "ok"
    elif not metadata["documents"]:
        result_status = "empty_corpus"
    elif candidates and not perm_result.permitted:
        result_status = "blocked_by_permissions"
    elif not candidates or rejected_for_evidence:
        result_status = "insufficient_evidence"
    else:
        result_status = "budget_exhausted"

    ttft_proxy_ms = (time.monotonic() - t0) * 1000.0

    # Stage 5 — Trace builder
    trace = build_trace(
        user_ctx=user_ctx,
        policy=policy,
        retrieved_count=len(candidates),
        included=budget_result.packed,
        blocked=perm_result.blocked,
        stale=fresh_result.stale,
        dropped=budget_result.over_budget + rejected_for_evidence,
        total_tokens=budget_result.total_tokens,
        budget_utilization=budget_result.budget_utilization,
        ttft_proxy_ms=ttft_proxy_ms,
        candidates=candidates,
        result_status=result_status,
        evidence=evidence,
        freshness_reference_date=(
            max((d["date"] for d in metadata["documents"] if d.get("date")), default=None)
            if not policy.skip_freshness else None
        ),
    )

    return PipelineResult(
        context=budget_result.packed,
        total_tokens=budget_result.total_tokens,
        trace=trace,
    )
