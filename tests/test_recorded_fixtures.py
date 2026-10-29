"""Historical answer fixtures expose parser gaps without rewriting measurements."""
import hashlib
from pathlib import Path

from tests.verify_recorded_fixtures import verify_recorded_fixtures


def test_historical_goldens_recover_grouped_citations_without_provider_calls(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Recorded fixture validation must never call a provider")

    monkeypatch.setattr("src.ask.call_model", forbidden)
    paths = [Path("corpora/pe-deal/ask_goldens.json"),
             Path("evals/results/ask-2026-07-06-pe-deal.json")]
    hashes = [hashlib.sha256(p.read_bytes()).hexdigest() for p in paths]
    report = verify_recorded_fixtures()
    assert report["answer_provider_calls"] == 0
    entries = report["goldens"]["entries"]
    analyst_ic = next(r for r in entries if r["case_id"] == "golden_ic_recommendation"
                      and r["role"] == "analyst")
    # Real saved answer contains two grouped references missed by its legacy parser.
    assert {"doc_001", "doc_002", "doc_003", "doc_004"} <= set(analyst_ic["omitted_by_recorded_parser"])
    assert {"doc_001", "doc_002", "doc_003", "doc_004", "doc_005", "doc_015"} == set(analyst_ic["extracted_citation_ids"])
    assert report["goldens"]["unknown_ids_total"] == 0
    assert report["goldens"]["unauthorized_ids_total"] == 0
    assert report["goldens"]["historical_citation_validity_rate_recomputed"] is None
    assert all(r["semantic_claim_support"] == "not_checked" for r in entries)
    assert hashes == [hashlib.sha256(p.read_bytes()).hexdigest() for p in paths]


def test_truncated_previews_never_become_a_recomputed_validity_rate():
    report = verify_recorded_fixtures()
    historical = report["historical_evaluation"]
    assert historical["status"] == "historical_unverifiable_from_truncated_previews"
    assert historical["citation_validity_rate_recomputed"] is None
    assert all(r["preview_characters"] <= 160 for r in historical["entries"])
    assert all("unverifiable" in r["full_answer_citations"] for r in historical["entries"])
