# QueryTrace remediation record

Working branch: `codex/querytrace-improvements`, based on `404b53c`. Initial Git state clean; no existing user edits to move. No push, deployment, or merge into the original branch is authorized.

## Baseline — 2026-10-08

- Read the independent review at the supplied attachment path and the earlier audit evidence. Claims are hypotheses until checked against this checkout.
- Python 3.11.15: **427 passed**, one upstream Starlette/httpx deprecation warning; Ruff passed. Logs: [pytest](evidence/before/pytest.txt).
- Started the unchanged application on port 8000 and inspected the login, guest, query, comparison, evaluation and upload surfaces before integration. Initial browser evidence is under `evidence/before/`.
- Docker client exists but the Docker daemon socket is unavailable. Container execution is **not verified**.
- `origin/HEAD` and local `main` point to the merged release; `render.yaml` still selects `feat/ToDeploy`. Review its repository history before changing the blueprint; do not deploy.

## Final findings matrix

Every original finding was reproduced against the original checkout before changing its implementation. The evidence links below record real runs; tests that replace the answer provider are explicitly marked simulated.

| ID | Implemented resolution | Evidence / regression | Status |
|---|---|---|---|
| F01 | Manual/scenario role uses the same backend-enforced contract; identity and simulation separated; changes clear both result modes and ignore obsolete in-flight responses. | `test_admin_manual_role_consistent_query_compare`, browser six users × two hosts, guest role loops, scenario execution and request-race test; [original mismatch](evidence/before/browser-baseline.json) | verified |
| F02 | Complete/incomplete/failed/not_run/unavailable states, null metrics without completed queries, explicit denominators and nonzero failure exits; CI still runs tests before evaluator. | `test_partial_and_total_eval_failures_are_not_success`, CLI [total](evidence/after/eval-all-fail.json)/[partial](evidence/after/eval-partial-fail.json), browser injected failures | verified |
| F03 | Every returned document checked against canonical authorization; separate query/document/fragment violation rates. Missing canonical metadata fails closed for governed policies. | `test_evaluator_checks_actual_permissions_without_forbidden_annotations`, missing-metadata regressions; [PE](evidence/after/benchmark-pe.json), [SaaS](evidence/after/benchmark-saas.json) | verified |
| F04 | Actual k-fragment baseline and explicitly named whole-corpus baseline; no promotional hardcoded reduction. | `test_baselines_distinguish_exact_top_k_chunks_from_whole_corpus`; [per-query comparison](evidence/after/benchmark-query-comparison.csv), browser Compare/export | verified |
| F05 | Relative RRF rank separated from cosine evidence; conservative query-level abstention without word exceptions. | 24 valid benchmarks unchanged; 10/10 unrelated probes abstain; [ambiguous/OOD results](evidence/after/relevance-after.json); browser empty trace | verified; heuristic limits documented |
| F06 | Aggregate token sums, terminal fragment counts, document summaries and partial inclusion; document-limit, evidence, selection-budget and prompt-budget reasons distinct. | `test_trace_unique_document_partition_and_token_sum`, `test_document_cap_has_distinct_reason_and_partial_tokens_reconcile`, browser response/export accounting | verified |
| F07 | Superseded candidate, penalized and final-context counts separated; corpus temporal reference disclosed; final outcomes survive later exclusion. | `test_freshness_annotations_distinguish_demoted_candidates_and_final_context`, Ask final-trace tests, configured scenario browser tests | verified |
| F08 | Empty corpus, insufficient evidence, permission wall, budget exhaustion and service failures remain distinct; empty traces stay visible. | API regression tests; browser custom empty/restricted corpora, zero budget, unrelated query, provider/retrieval failure recovery | verified |
| F09 | Ask returns actual sent context/trace/tokens, plus initial selection and explicit prompt exclusions; local estimates separate from provider usage. | Trim/no-trim/zero-context API and browser tests; [simulated Ask](evidence/after/ask-simulated.png) | verified with simulated provider |
| F10 | Versioned isolated cache; escaped Markdown; grouped valid/invalid citation membership checks; errors/disabled states; historical recordings labeled and revalidated offline. | `test_ask_cache_invalidated_by_successful_corpus_publication`, grouped citation tests, browser Markdown/XSS/cache; [recorded revalidation](evidence/after/recorded-fixtures-revalidation.json) | verified; no semantic-grounding claim |
| F11 | Reentrant per-corpus thread/file locks, rollback journal, commit marker and restart recovery coordinate source/metadata/FAISS/BM25/payload publication and caches. | Publication failure injection after each artifact, exact-byte rollback, retry without duplicates, killed subprocess recovery and concurrent reader tests in `test_service_remediation.py` | verified for tested process failures |
| F12 | DOCX body/table order, nested tables, headers/footers; substantive unsupported objects rejected instead of silently omitted; Upload refreshes dependent state. | DOCX extraction fixtures/tests and real browser upload of [table fixture](../tests/browser/fixtures/meridian-table.docx), Query/Ask/cache/evaluation refresh | verified |
| F13 | Optional users/evals/scenarios; unavailable/not_run evaluation states; validated default/config; private login without public credential hints. | Custom/no-eval and invalid-configuration API tests; browser BYOC tutorial, Documents and private manual login | verified |
| F14 | Same-origin API; HttpOnly/Lax cookie, HTTPS Secure flag, explicit optional CORS allowlist. | Browser login/query/reload/logout for all six users on localhost and 127.0.0.1 | verified in supported local mode |
| F15 | Workspace-scoped audit limited to authorized full-access administrators or guest lab, for Query, Compare policies and Ask/cache/failure; identity/effective role/version/parameters recorded; results label executed query. | Audit API regressions and browser attribution/scope/export tests; [audit](evidence/after/audit-admin.png) | verified |
| UX | Consistent Query/Compare/Documents/Evaluations terminology, concise purpose, progressive traces, explicit demo boundaries, readable titles and responsive forms. | Browser widths 375/768/1024/1440, light/dark, real keyboard actions; saved screenshots and automated accessibility reports | verified for tested states |
| TOUR | Versioned six-step Guide; welcome/skip/reopen/reset/complete/resume; adaptive accounts/scenarios/capabilities; explicit actions preserve prior draft/results. | Browser first-run, completion, BYOC, explicit scenario/trace, mobile controls and keyboard Escape; zero provider calls | verified |
| DOCS | README/architecture/demo/upload/config/evaluation rewritten; badge repository fixed; local links checked; Render main verified from PR #4 and origin/HEAD. | [Link check](evidence/after/documentation-links.json), [evaluation methodology](evaluation.md), Git history; no external deployment | verified locally |

## Work streams and integration

- `codex/querytrace-retrieval`: pipeline, policies, models, retrieval and evaluations.
- `codex/querytrace-services`: API, auth, Ask, ingestion/index publication and workspace resolution.
- `codex/querytrace-ui`: vanilla frontend and interactive tour.
- Main improvement branch: personal integration review, deterministic browser automation, evidence, docs and final verification.

Each stream uses its own worktree. Commits are consolidated into the improvement branch only after review. The application used for final acceptance must contain all integrated changes.

## Final validation

| Command / check | Observed result | Evidence |
|---|---|---|
| `.venv/bin/python -m pytest tests/ -q` | 505 passed, 1 upstream Starlette/httpx deprecation warning | [Python 3.11 log](evidence/after/pytest.txt) |
| `/tmp/querytrace-validation-py39/bin/python -m pytest tests/ -q` | 505 passed, 4 environment/dependency warnings | [Python 3.9 log](evidence/after/pytest-py39.txt) |
| `.venv/bin/ruff check src/ tests/` | All checks passed | [Ruff](evidence/after/ruff.txt) |
| `node --check frontend/app.js`; `git diff --check` | Passed | Final integration check |
| `QUERYTRACE_TEST_PYTHON="$PWD/.venv/bin/python" npm run test:e2e` | 48 passed; no skipped tests | [Browser log](evidence/after/browser-test-log.txt), [machine-readable report](evidence/after/browser-results.json) |
| `node tests/browser/production-smoke.cjs` with the normal server on 8000 | Both real corpora, Query, Compare, Documents, Evaluations, Guide; no page errors, no test-only routes, Ask disabled | [Result](evidence/after/production-smoke.json), [log](evidence/after/production-smoke.txt) |
| `python -m src.evaluator --workspace pe-deal --compare --output ...` | All 3 policies complete, 12/12 each; full-policy violations 0/12 | [PE](evidence/after/benchmark-pe.json) |
| Same evaluator command for `saas-internal` | All 3 policies complete, 12/12 each; full-policy violations 0/12 | [SaaS](evidence/after/benchmark-saas.json) |
| `python -m tests.verify_recorded_fixtures --output ...` | Offline revalidation; six grouped references recovered; historical context not reconstructable with certainty | [Report](evidence/after/recorded-fixtures-revalidation.json) |
| WCAG 2 A/AA + 2.1 AA axe scans | Zero violations in tested Query/Guide states, both themes | [light Query](evidence/after/accessibility-light-query.json), [dark Guide](evidence/after/accessibility-dark-tour.json) |
| Local documentation link validation | Zero broken links | [Report](evidence/after/documentation-links.json) |
| `docker info --format '{{.ServerVersion}}'` | Exit 1: Docker daemon socket unavailable; no container build/run claimed | [Docker evidence](evidence/after/docker-status.json) |

The browser suite exercises actual interactions at 375, 768, 1024 and 1440 px in both themes, including Query, Compare, Documents, Evaluations, login, Upload and all Guide steps. Keyboard checks cover radio-arrow selection, Enter submission, trace expansion, Tab focus, Guide focus and Escape. Tests exercise a temporary corpus with the real application routes, local embeddings and indexing; only the paid answer provider and explicitly identified error cases are simulated. The normal-server smoke has no mocks.

Browser harness issues discovered during test development (initial-storage overwrite on reload, selecting covered radio inputs instead of their visible labels, and scenario cards disappearing after execution) were corrected in the harness. Product issues found during integration were also corrected: role descriptions after login, stale in-flight responses, old results hidden in another mode, skipped-evaluation rows, final Ask document counters and tutorial restoration across a corpus update, and corpus-wide tooling access for an administrator with a restricted document role. The published development signing key was replaced with a random process-local fallback; configured signing keys remain unchanged.

System Python 3.9 initially lacked fastembed and was not a valid compatibility environment. The final 3.9 result above comes from a separate virtual environment installed from `requirements-dev.txt`; no system packages were modified.

## Representative final screenshots

- [Normal application: Query](evidence/after/final-query.png), [Compare](evidence/after/final-comparison.png), [Decision Trace](evidence/after/final-trace.png), [Documents](evidence/after/final-documents.png), [Evaluations](evidence/after/final-evaluations.png).
- [Welcome](evidence/after/final-welcome.png), [Guide](evidence/after/final-guide.png), [mobile dark Guide](evidence/after/tour-375-dark.png), [mobile query](evidence/after/query-results-375-dark.png).
- [Simulated Ask](evidence/after/ask-simulated.png), [DOCX upload](evidence/after/upload-complete.png), [scoped Audit](evidence/after/audit-admin.png), [failed evaluation](evidence/after/evaluation-failed.png), [custom corpus without evals](evidence/after/custom-no-evals.png).

## Remaining integration boundaries

- Docker daemon unavailable: container build/run unverified.
- No authorized paid model calls: real Anthropic integration is unverified; deterministic Ask contract tests are not substituted for that integration.
- No push, remote GitHub Actions run, external deployment, merge into main or original-branch modification occurred. CI configuration was updated; local equivalents passed.
- Browser coverage is Chromium on this macOS host, not a claim about every browser or assistive technology. POSIX local storage and a single service process are the documented operating scope.
- Power loss, multi-host storage and semantic claim verification are not claimed. Recorded historical Ask previews cannot establish current or historical semantic grounding.

## Run and review

The normal server is left running at `http://localhost:8000/app/`, with Ask disabled and both original demo corpora intact. To restart from the repository root:

```bash
source .venv/bin/activate
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
```

Use Guide for the first walkthrough. For a protected session use the public demo accounts listed in the README; for upload use an administrator. Upload regression files were published only to disposable test corpora, not the bundled presentation corpora.

All changes are consolidated on `codex/querytrace-improvements`, based on `404b53c`. The three auxiliary worktree branches retain their component commits. The initial checkout was clean, so there were no user edits to discard or transplant. Review the complete branch diff against main; no remote action has been performed.
