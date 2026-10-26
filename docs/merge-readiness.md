# Local merge-readiness review — October 25, 2026

**Merge is on hold following the independent UI review requested on October 25.** The earlier local checks below passed, but they did not establish product clarity or cover every interaction. Subsequent browser use reproduced an Ask retry that runs retrieval instead of retrying generation, an expanded comparison trace that overflows the page, and a false running status after returning from a comparison example. The review also identifies competing entry actions and excessive disabled controls that obscure the demonstration. See the [independent UI review](evidence/independent-ui-review/README.md) for evidence, priorities and the revised acceptance criteria. This branch has not been pushed or merged during this work.

## Candidate and scope

Candidate: `codex/querytrace-taste-redesign`. `origin/main` was freshly fetched at `404b53c`; it is an ancestor of the candidate, so there is no divergent-main conflict. The candidate already contained 28 commits before the final video/documentation delivery. It includes the earlier retrieval, authorization, upload, audit and evaluation corrections as well as the UI redesign. Merging only the older `codex/querytrace-improvements` branch would omit the final redesign and new demo.

The application source validated here is `950cef5`. The closing commit adds the demo, its player/recording scripts and documentation; it does not change frontend or backend runtime behavior. The [redesign evidence](evidence/taste-redesign/README.md) records the completed Taste extraction, before/after comparison, icon work and prior real-provider verification.

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

Resolve the confirmed UI defects and the review's primary clarity issues, then repeat the affected browser journeys and review the resulting screens. Add regressions for the missing interactions before treating the previous green suite as sufficient. Once those gates are satisfied, open a PR from the candidate branch, review its full accumulated scope and require the configured GitHub Actions checks for the final commit. The CI workflow runs Python 3.9 and 3.11, both workspace benchmarks and Chromium regressions. The current delivery has only been validated locally on Python 3.11; no current Linux CI result is claimed before pushing. Earlier Python 3.9/Docker evidence is historical.

No merge, public deployment, external Taste adherence verification or new paid model call was performed. Public demo credentials, local storage, process-local audit/jobs/caches and the documented production limitations remain unchanged. These are boundaries of this demonstration, not assertions of production readiness.
