# Evaluation definitions and measured evidence

An evaluation describes an identified execution against a particular corpus and policy. It is not a certification. Reports include run ID, timestamp, workspace, corpus fingerprint, policy parameters and per-query results. The frontend exports that JSON.

## Execution coverage

- `complete`: every configured query completed successfully.
- `incomplete`: some queries completed, with failures or explicit omissions.
- `failed`: attempted queries failed and none completed.
- `not_run`: no queries were attempted, including an empty configured set.
- `unavailable`: no evaluation set exists for the workspace.

Reports expose total, attempted, completed, failed and skipped counts. Quality/safety metrics divide by **completed queries**, never silently treating errors as good answers. No completed queries means unavailable (`null`) metrics. The CLI exits 1 for incomplete/failed/unavailable runs and for full-policy permission violations. In comparison mode, unsafe baseline violations are expected, but failed baseline execution still fails the command.

CI already ran pytest before the evaluator in the original project. The independently reproduced evaluator false-success defect did not prove that the whole CI pipeline ignored failures. Updated CI runs both workspace benchmarks and deterministic browser regressions as well as Python tests/lint.

## Metric units

| Metric | Definition |
|---|---|
| Query permission violation rate | Completed queries returning at least one unauthorized document / completed queries |
| Document permission violation rate | Unauthorized document occurrences / returned document occurrences, deduplicated within each query |
| Fragment permission violation rate | Unauthorized returned fragments / returned fragments |
| Precision@k | Expected documents among the first min(k, returned unique documents), divided by that same minimum; zero for empty context |
| Recall | Returned expected documents / expected documents; evaluates configured expectations, not exhaustive relevance |
| Selected tokens | Local `cl100k_base` estimate of included fragment text, excluding provider prompt overhead |
| Token reduction versus baseline | 1 − full-policy selected tokens / baseline selected tokens, over the same queries; negative means more tokens |

Permission metrics evaluate **every returned document** against workspace metadata and role ranks. Missing metadata/unknown roles fail closed. Optional `forbidden_doc_ids` annotations are preserved as annotations, not used to decide authorization.

Precision's short-result denominator is an existing convention, not canonical fixed-denominator precision@k. It is named explicitly so users can interpret it. Sparse expected-document lists also limit its usefulness: an unlisted but relevant document counts as a miss.

## Baselines

| Policy | Retrieval | Permission filter | Freshness | Final cap |
|---|---|---|---|---|
| `naive_top_k` | Exactly up to k ranked fragments | Off | Off | k fragments; no token cap |
| `whole_corpus` | Every fragment | Off | Off | None; k unused |
| `permission_aware` | Up to 6 × k ranked fragments | On | Off | k unique documents, token budget |
| `full_policy` | Up to 6 × k ranked fragments | On | On | k unique documents, token budget |

`naive_top_k` means at most k ranked **fragments**, no permission/freshness/evidence filtering and no token cap. `whole_corpus` means every indexed fragment, with the same controls disabled and k unused. The filtered policies retrieve at most 6 × k candidates, apply authorization and an evidence gate, and select at most k unique documents within the token budget. Full policy also applies freshness; Permissions Only does not.

These runs compare final context, not model answers or measured model latency. The displayed latency proxy is an estimate. Different policies intentionally have different candidate/selection rules; their definitions are part of each trace.

## Before and after

Reproduced original checkout: `404b53c`, 427 passing tests. The old “top-k” at k=8 requested 48 candidates from each 28-fragment corpus and included them all. Its partial forbidden-ID annotations undercounted permission violations.

| Workspace | Original labeled top-k | Correct authorization over the same all-corpus output | New actual top-8 | Full policy |
|---|---:|---:|---:|---:|
| PE | 6/12 = 50.00% | 8/12 = 66.67% | 7/12 = 58.33% | 0/12 |
| SaaS | 7/12 = 58.33% | 9/12 = 75.00% | 9/12 = 75.00% | 0/12 |

The corrected full-policy output is unchanged for all 24 original benchmark queries. All runs completed 12/12, with zero failures or omissions.

| Workspace | Policy | Mean fragments | Mean unique docs | Mean tokens | P@5 | Recall |
|---|---|---:|---:|---:|---:|---:|
| PE | Top-8 fragments | 8.00 | 7.50 | 2265.4 | .2667 | .8750 |
| PE | Whole corpus | 28.00 | 16.00 | 7151.0 | .2667 | 1.0000 |
| PE | Full policy | 8.00 | 6.67 | 2016.8 | .3000 | 1.0000 |
| SaaS | Top-8 fragments | 8.00 | 6.00 | 1939.4 | .2667 | 1.0000 |
| SaaS | Whole corpus | 28.00 | 14.00 | 6592.0 | .2667 | 1.0000 |
| SaaS | Full policy | 8.75 | 5.83 | 2021.6 | .2500 | 1.0000 |

PE full policy uses 10.98% fewer tokens than top-8 and 71.80% fewer than the whole corpus. SaaS full policy uses **4.24% more** than top-8 and 69.33% fewer than the whole corpus. No positive savings claim is made when the measured result is an increase.

Reproduce without an answer-provider key:

```bash
python -m src.evaluator --workspace pe-deal --compare --output /tmp/pe-results.json
python -m src.evaluator --workspace saas-internal --compare --output /tmp/saas-results.json
```

Evidence: [original PE log](evidence/before/benchmark-pe.txt), [original SaaS log](evidence/before/benchmark-saas.txt), [final PE report](evidence/after/benchmark-pe.json), [final SaaS report](evidence/after/benchmark-saas.json), [per-query before/after CSV](evidence/after/benchmark-query-comparison.csv). Reports retain unrounded counts and per-query token sums; displayed means are rounded.

## Evidence sufficiency experiment

The filtered policies abstain when the best permitted fragment has MiniLM cosine similarity below 0.25. RRF normalization remains a ranking aid and is never treated as absolute certainty. No query-word exceptions are used.

- All 24 benchmark queries retained sufficient evidence and unchanged full-policy results for their configured roles.
- Five unrelated questions (recipe, weather, quantum entanglement, yoga and binary trees), tested against both workspaces, all abstained: 10/10.
- Eleven additional probes per workspace include those unrelated questions and ambiguous prompts. “What changed?” abstained in both; “What are the risks?” passed in both. “Summarize the latest information” and “policy” passed in SaaS but abstained in PE.

[Probe results and cosine values](evidence/after/relevance-after.json). This is a small fixture experiment, not an independent generalization benchmark. A valid broad question may be rejected, while an ambiguous one may pass. The gate checks that some permitted evidence exists; it does not filter every weak fragment or prove an answer is supported. Recalibrate and evaluate on a new corpus before relying on the threshold.

## Ask verification

Deterministic tests use a simulated provider and verify the actual built prompt, final context, extra trimming, cached/uncached results, provider errors, individual/grouped/invalid citations and escaped Markdown. Provider usage in these tests is explicitly synthetic. No paid API was consumed during remediation.

Historical Ask files from July 2026 are retained as historical recordings. `evals/results/ask-2026-07-06-pe-deal.json` stores truncated answer previews, so its old 100% metrics cannot be revalidated from complete answers. A “groundedness” field in the old report merely measured citation presence; it never established semantic grounding. Current mechanical checks only establish identifier membership in sent context.

Offline revalidation of the six complete golden answers extracts 20 references, versus 14 stored by the former parser (six recovered grouped references). All IDs exist and satisfy their role permissions. Three references are absent from the context reconstructed by the **current** pipeline with full_policy/k8/2048 and a 4096 prompt cap. This is not a claim about their historical prompt, which was not preserved. [Revalidation report](evidence/after/recorded-fixtures-revalidation.json).

```bash
python -m tests.verify_recorded_fixtures --output /tmp/recorded-fixtures.json
```

CLI `--ask` and `--ask-goldens` call the real provider and may incur charges; do not use them for the offline acceptance suite. A real provider integration and external deployment remain unverified. Docker execution was subsequently verified: both workspace benchmarks complete with networking disabled, and all six policy/workspace aggregate reports exactly match the local results above. [Docker validation](docker-validation.md), [metric parity report](evidence/docker/benchmark-parity.json).
