# QueryTrace remediation record

Working branch: `codex/querytrace-improvements`, based on `404b53c`. Initial Git state clean; no existing user edits to move. No push, deployment, or merge into the original branch is authorized.

## Baseline — 2026-10-08

- Read the independent review at the supplied attachment path and the earlier audit evidence. Claims are hypotheses until checked against this checkout.
- Python 3.11.15: **427 passed**, one upstream Starlette/httpx deprecation warning; Ruff passed. Logs: [pytest](evidence/before/pytest.txt).
- Started the unchanged application on port 8000 and inspected the login, guest, query, comparison, evaluation and upload surfaces before integration. Initial browser evidence is under `evidence/before/`.
- Docker client exists but the Docker daemon socket is unavailable. Container execution is **not verified**.
- `origin/HEAD` and local `main` point to the merged release; `render.yaml` still selects `feat/ToDeploy`. Review its repository history before changing the blueprint; do not deploy.

## Findings matrix

Status vocabulary: confirmed / implementing / verified / not reproduced / externally blocked. Evidence must identify a test or a saved run, not just a code edit.

| ID | Finding and reproduction in original checkout | Intended resolution and verification | Status |
|---|---|---|---|
| F01 | Manual Compare submission uses `SESSION.role` instead of selected role; scenarios bypass that handler. Query locks admin to session role. | Unify authorized simulation contract, expose identity/effective role; assert manual + scenario requests, non-admin enforcement, context reset. | confirmed; implementing |
| F02 | Evaluator catches failures, computes zero violation rate with zero successes; UI checks only `rate === 0`; CLI only asserts that metric. CI runs pytest first and must be assessed separately. | Explicit complete/incomplete/failed/not_run/unavailable; denominators/null metrics; failing CLI exits; partial/total-failure tests and UI regression. | confirmed; implementing |
| F03 | `run_evals` checks `forbidden_doc_ids`, a partial list. | Compare every selected document against workspace role metadata; query/document/chunk denominators; both corpora regression. | confirmed; implementing |
| F04 | Every policy retrieves `6 * top_k`; naive skips all final caps; 48 requested versus 28 corpus chunks. Landing page hardcodes 50%. | True top-k chunks, explicitly named whole-corpus baseline, reproducible execution metadata and calculated savings. | confirmed; implementing |
| F05 | RRF min-max score is shown as Relevance, including 1.00 for unrelated queries. | Preserve semantic evidence independently of rank; reject insufficient evidence without topic keyword hacks; measure valid/ambiguous/unrelated queries. | confirmed; implementing |
| F06 | `groupTraceEntries` keeps first chunk token count; document buckets overlap; budget packer lacks drop reason. | Sum tokens, terminal chunk accounting, unique docs/partial inclusion, correct limits/reasons; reconcile JSON and UI. | confirmed; implementing |
| F07 | Superseded candidates are labeled as stale in final summary even if budget excludes them; card assumes penalty despite skip policy. | Candidate/demotion/included counts, explicit corpus reference date and replacement, policy-aware labels. | confirmed; implementing |
| F08 | Query returns early for empty context, discarding trace in UI. | Preserve trace and distinguish empty corpus, evidence, permission, budget and service failures; test Query/Compare/Ask. | confirmed; implementing |
| F09 | Ask trims prompt documents but returns `result.context`/tokens/trace from before trimming. | Return actual provider context, record additional exclusions/initial selection and separate local estimates/provider usage. | confirmed; implementing |
| F10 | Ask cache excludes corpus version; citation regex only single IDs; answer is escaped plain text. | Version-aware isolated cache, grouped citation parser, safe Markdown, mock provider tests and recorded-fixture revalidation. | confirmed; implementing |
| F11 | Three index artifacts are published separately; metadata rollback does not restore artifacts. | Coherent publication with read/write coordination and recoverable transaction; inject publication failures and retry without duplicates. | confirmed; implementing |
| F12 | DOCX extractor visits only `document.paragraphs`; Upload does not refresh metadata. | Ordered body paragraphs/tables, headers/footers and explicit unsupported-element limits; representative fixture + UI refresh. | confirmed; implementing |
| F13 | Resolver requires users.json; eval endpoint and import-time benchmark count assume evals.json. | Optional demo/eval configuration, actionable startup/default validation; custom corpus browser/API tests. | confirmed; implementing |
| F14 | API_BASE hardcodes localhost for localhost and 127.0.0.1. | Same-origin supported serving, secure cookie settings; both hosts login/reload/logout browser tests. | confirmed; implementing |
| F15 | Audit reads global records without workspace filter; UI omits user/workspace. Result header omits executed query. | Authorized scoped audit with attribution and parameters; show executed query and stale edits; verify switching boundaries. | confirmed; implementing |
| UX | Conflicting labels, cropped comparison titles, repeated badges, unsupported production/certification claims. | Coherent navigation, Documents view, progressive trace details, clear demo boundaries, keyboard and responsive light/dark checks. | confirmed; implementing |
| TOUR | No interactive first-run tour. | Six adaptive steps, explicit user actions, versioned storage/reopen/reset, no paid calls, no automatic uploads, resilient BYOC. | implementing |
| DOCS | Badge points to another repo; stale architecture/upload/demo claims and links; deployment branch stale. | Rewrite docs against final code and measured runs, verify local links and blueprint intent from Git history. | confirmed; implementing |

## Work streams and integration

- `codex/querytrace-retrieval`: pipeline, policies, models, retrieval and evaluations.
- `codex/querytrace-services`: API, auth, Ask, ingestion/index publication and workspace resolution.
- `codex/querytrace-ui`: vanilla frontend and interactive tour.
- Main improvement branch: personal integration review, deterministic browser automation, evidence, docs and final verification.

Each stream uses its own worktree. Commits are consolidated into the improvement branch only after review. The application used for final acceptance must contain all integrated changes.
