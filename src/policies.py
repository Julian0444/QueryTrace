"""
policies.py — Role-based access control and policy presets for the pipeline.

Policy presets:
  naive_top_k       — exactly k ranked chunks, no filters or token budget
  whole_corpus      — every ranked chunk, no filters or token budget
  permission_aware  — retrieval + role-based access control, no freshness
  full_policy       — RBAC + query evidence gate + freshness + budget packing
  default           — alias for full_policy
"""

import json

from src.models import PolicyConfig


# ---------------------------------------------------------------------------
# Policy presets
# ---------------------------------------------------------------------------

POLICY_PRESETS = {
    "naive_top_k": PolicyConfig(
        name="naive_top_k",
        skip_permission_filter=True,
        skip_freshness=True,
        skip_budget=True,
        skip_evidence_gate=True,
        retrieval_mode="top_k_chunks",
        top_k_unit="chunks",
        candidate_multiplier=1,
    ),
    "whole_corpus": PolicyConfig(
        name="whole_corpus",
        skip_permission_filter=True,
        skip_freshness=True,
        skip_budget=True,
        skip_evidence_gate=True,
        retrieval_mode="whole_corpus",
        top_k_unit="unused",
    ),
    "permission_aware": PolicyConfig(
        name="permission_aware",
        skip_freshness=True,
    ),
    "full_policy": PolicyConfig(name="full_policy"),
    "default": PolicyConfig(name="default"),
}


def resolve_policy(name: str, top_k: int) -> PolicyConfig:
    """Look up a named policy preset and apply the request's top_k override.

    Raises ValueError if the name is not a known preset.
    """
    base = POLICY_PRESETS.get(name)
    if base is None:
        raise ValueError(
            f"Unknown policy: {name!r}. Valid policies: {list(POLICY_PRESETS.keys())}"
        )
    if top_k != base.top_k:
        return base.model_copy(update={"top_k": top_k})
    return base


# ---------------------------------------------------------------------------
# Role loading
# ---------------------------------------------------------------------------

def load_roles(roles_path: str) -> dict:
    """Load role definitions from a roles JSON file.

    Returns the 'roles' dict mapping role name → {name, description, access_rank}.
    """
    with open(roles_path, "r") as f:
        data = json.load(f)
    return data["roles"]


def document_is_authorized(doc: dict, role: str, roles) -> bool:
    """The same fail-closed rank comparison used by the permission stage.

    Evaluation calls this against workspace metadata for EVERY returned
    document. Optional forbidden-id annotations are not an authorization source.
    """
    try:
        return roles[doc["min_role"]]["access_rank"] <= roles[role]["access_rank"]
    except (KeyError, TypeError):
        return False
