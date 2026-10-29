# Result-backed tutorial implementation — October 28, 2026

Implements TR-01–TR-05 from the [historical review](../tutorial-review/report.md), preserving the earlier [UI remediation](../ui-remediation/README.md). No corpus, access policy, retrieval threshold or document selection was changed.

- The guide occupies document flow on desktop and mobile. Actions, outcomes and a keyboard-scrollable source reader share the guide; no floating overlay covers controls or focus.
- A compatible workspace question is shown first. Retrieval and comparison unlock progression only after successful responses. Comparison freezes the question, role and retrieval settings used for the example. Back does not execute requests; Exit cancels the UI’s pending operation and restores prior work; Guide resumes in memory; Restart requires new evidence. A reload requires a new run instead of certifying an experiment from stored step numbers.
- A decision and the exact selected source fragment are opened together. Narrow traces stack document, decision and reason; references are expandable. Complete traces, exports and per-policy fragment readers remain available with bounded scrolling.
- Stale retrieval and answer results name **Retrieve evidence** and **Generate answer** respectively. Generation retries still call `/ask` with the failed request’s inputs.
- Completion summarizes returned counts and policy differences. A variation must change the question, or be skipped explicitly. Restricted accounts explicitly omit unfiltered baselines; empty corpora explicitly record the absence of a source. The guide does not call the model or upload documents.

## Validation

Local Python 3.11: **508 passed**, Ruff passed. Browser suite: **73 passed**, including the existing authorization, upload, evaluation, prompt trimming and recovery tests. Both workspace comparisons completed all 12 queries with Full Policy unauthorized-return rate 0. Testing used `tests/browser/server.py`, temporary corpus copies and the deterministic provider; no paid provider calls and no uploads to the main corpus.

The new browser regressions exercise first visit, blocked completion without execution, Query/Compare failures and retry, exit during a pending response, prior draft/result restoration, resume/restart/reload, restricted Analyst, a workspace without scenarios, an empty corpus, disabled generation, action-specific stale text, and unchanged-question rejection. The full guide runs at **375×667**, **390×844** and **1440×900**, in both themes, with focus geometry and hit-testing checks. Existing 375/768/1024/1440 comparison overflow and keyboard scroll checks remain.

The [Codex browser verification](codex-review.md), [served-asset hashes](served-assets.json) and `captures/` record the visual checks. The [independent Claude review](claude/README.md) found no blocking defects in `736e0d1`; [follow-up resolutions](review-followup.md) record the small subsequent corrections. Saved screenshots complement interaction tests; passing tests is not evidence of subjective ease of use. The October 25 video and all earlier reports remain historical.

## Secret review

Gitleaks 8.30.1 found no secrets in the 32 commits outgoing from `origin/main` through `736e0d1`. Scanning the complete candidate tree flagged six values in the two demo `users.json` files: each is the SHA-256 of its intentionally published demo password, and both files are byte-for-byte unchanged from `origin/main`. No API keys were detected. The scan was redacted; no token, environment file or scanner dump containing secret values was saved in the repository. `.env` variants and private-key file extensions are ignored.

The full 73-test suite passed after the review wording fixes and the new generated-answer restoration regression. Nine focused checks passed after the final restricted-account navigation label adjustment; the final GitHub CI reruns the full suite on Python 3.9/3.11 and Chromium. The initial candidate `736e0d1` also passed both Linux CI matrix jobs on push and PR events. See [PR #5](https://github.com/Julian0444/QueryTrace/pull/5) for the integration commit and final CI status.
