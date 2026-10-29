# Integration validation — October 28, 2026

The candidate now includes the result-backed tutorial fixes TR-01–TR-05. See [current implementation and evidence](evidence/tutorial-implementation/README.md). Local Python (508), browser (73), Ruff and both workspace evaluation results are recorded there. Claude independently reviewed `736e0d1` without blocking findings; small wording corrections and an additional Ask restoration check are recorded in the follow-up. The first candidate passed both Linux CI matrix jobs; [PR #5](https://github.com/Julian0444/QueryTrace/pull/5) records final-head CI and integration status. GitHub CI and merge status must be checked against the published final head; the historical checks below do not certify it.

---

# Local merge-readiness review — October 25, 2026

**Historical status, October 25:** UI remediation was ready for the owner’s local review. The three confirmed defects and the primary simplification requests from the [independent review](evidence/independent-ui-review/README.md) have been implemented. The [follow-up](evidence/ui-remediation/README.md) records current checks and screenshots. Owner acceptance and final GitHub CI are still required before merging. No push or merge was performed.

## Candidate and scope

Candidate: `codex/querytrace-taste-redesign`. `origin/main` was freshly fetched at `404b53c`; it is an ancestor of the candidate, so there is no divergent-main conflict. The candidate already contained 28 commits before the final video/documentation delivery. It includes the earlier retrieval, authorization, upload, audit and evaluation corrections as well as the UI redesign. Merging only the older `codex/querytrace-improvements` branch would omit the final redesign and new demo.

The earlier application source validated below was `950cef5`. The closing commit adds the demo, its player/recording scripts and documentation; it does not change frontend or backend runtime behavior. The [redesign evidence](evidence/taste-redesign/README.md) records the completed Taste extraction, before/after comparison, icon work and prior real-provider verification.

## Earlier local checks (before the independent UI audit)

| Check | Result |
|---|---|
| `python -m pytest tests/ -q` under Python 3.11 | 508 passed; one existing Starlette/httpx deprecation warning |
| `ruff check src/ tests/` | Passed |
| `npm run test:e2e` with the temporary-corpus server | 50 passed; deterministic provider, no paid calls |
| `python -m src.evaluator --workspace pe-deal --compare` | Complete; 12/12, no failures, Full Policy unauthorized-return rate 0 |
| `python -m src.evaluator --workspace saas-internal --compare` | Complete; 12/12, no failures, Full Policy unauthorized-return rate 0 |
| Final demo recorder in rehearsal mode against the real app | Passed; export equals response, Julia's role is enforced, workspace switch clears results |
| JavaScript syntax and `git diff --check` | Passed |
| Recording/application hashes and MP4/GIF hashes | Match |
| Full MP4 playback and player checks | 113.52 seconds; 0 dropped frames; chapter seeking passes; no decoding errors |
| Player axe checks at desktop and 375 px | 0 violations in the checked WCAG A/AA rules; no mobile overflow |
| Local media byte-range service | Normal/suffix ranges match original bytes; invalid ranges return 416 |

[Machine-readable validation](media/demo/validation.json) and [playback report](media/demo/playback-review.json) record the final video hash. Saved chapter frames and GIF samples were inspected visually. CUA also played the complete MP4 in the in-app browser and confirmed the end state without a media error. The final recording is silent, in English, with nine workflow chapters plus title cards; the README retains an animated preview and the earlier YouTube link.

## Remaining integration step and limits

The local UI fixes and regressions are complete; the owner will now review the running application. The existing demo recording remains evidence of the earlier UI. After owner acceptance and any requested adjustments, open a PR from the candidate branch, review its full accumulated scope and require the configured GitHub Actions checks for the final commit. The CI workflow runs Python 3.9 and 3.11, both workspace benchmarks and Chromium regressions. The current delivery has only been validated locally on Python 3.11; no current Linux CI result is claimed before pushing. Earlier Python 3.9/Docker evidence is historical.

No merge, public deployment, external Taste adherence verification or new paid model call was performed. Public demo credentials, local storage, process-local audit/jobs/caches and the documented production limitations remain unchanged. These are boundaries of this demonstration, not assertions of production readiness.
