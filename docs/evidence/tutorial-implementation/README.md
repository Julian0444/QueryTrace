# Result-backed tutorial implementation — October 28, 2026

Implements TR-01–TR-05 from the [historical review](../tutorial-review/report.md), preserving the earlier [UI remediation](../ui-remediation/README.md). No corpus, access policy, retrieval threshold or document selection was changed.

- The guide occupies document flow on desktop and mobile. Actions, outcomes and a keyboard-scrollable source reader share the guide; no floating overlay covers controls or focus.
- A compatible workspace question is shown first. Retrieval and comparison unlock progression only after successful responses. Comparison freezes the question, role and retrieval settings used for the example. Back does not execute requests; Exit cancels the UI’s pending operation and restores prior work; Guide resumes in memory; Restart requires new evidence. A reload requires a new run instead of certifying an experiment from stored step numbers.
- A decision and the exact selected source fragment are opened together. Narrow traces stack document, decision and reason; references are expandable. Complete traces, exports and per-policy fragment readers remain available with bounded scrolling.
- Stale retrieval and answer results name **Retrieve evidence** and **Generate answer** respectively. Generation retries still call `/ask` with the failed request’s inputs.
- Completion summarizes returned counts and policy differences. A variation must change the question, or be skipped explicitly. Restricted accounts explicitly omit unfiltered baselines; empty corpora explicitly record the absence of a source. The guide does not call the model or upload documents.

## Validation

Local Python 3.11: **508 passed**, Ruff passed. Browser suite: **72 passed**, including the existing authorization, upload, evaluation, prompt trimming and recovery tests. Both workspace comparisons completed all 12 queries with Full Policy unauthorized-return rate 0. Testing used `tests/browser/server.py`, temporary corpus copies and the deterministic provider; no paid provider calls and no uploads to the main corpus.

The new browser regressions exercise first visit, blocked completion without execution, Query/Compare failures and retry, exit during a pending response, prior draft/result restoration, resume/restart/reload, restricted Analyst, a workspace without scenarios, an empty corpus, disabled generation, action-specific stale text, and unchanged-question rejection. The full guide runs at **375×667**, **390×844** and **1440×900**, in both themes, with focus geometry and hit-testing checks. Existing 375/768/1024/1440 comparison overflow and keyboard scroll checks remain.

Visual review and independent review records are added below after inspection. Saved screenshots complement interaction tests; passing tests is not evidence of subjective ease of use. The October 25 video and all earlier reports remain historical.
