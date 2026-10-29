# UI polish evidence

The original visual pass started at `ec8e7ab` on `codex/querytrace-improvements`. The [guide and presentation follow-up](follow-up/README.md) records the subsequent fixes and current validation. Screenshots and test reports below preserve the earlier review for comparison.

## What changed and why

- **Reading and controls:** system sans for navigation, explanations and controls; Fraunces for the brand and selected headings; monospace for technical references and values. Removed the Source Serif download, widespread uppercase and expanded tracking. No new design dependency.
- **Query:** a larger input and explicit Run query / Compare policies actions; quieter secondary actions and scenario links. The workspace picker and authenticated identity remain visible; the classification strip no longer repeats the workspace name. Role descriptions update immediately without a fade or delayed text.
- **Context:** document title, source text and a policy-derived selection explanation lead. Tokens, partial inclusion and superseded warnings remain visible. Native details disclose rank, freshness and tags, with an explicit reminder that relative rank is not confidence. Expanded text remains actual retrieved fragments.
- **Compare:** shared grid rows align policy headings, metrics, baseline definitions and trace entry points. Document rows no longer sit inside nested cards. Narrow screens stack whole policy sections. Unsafe-baseline differences and each policy's distinct limits remain visible.
- **Documents, Evaluations, Audit, Upload, login and Guide:** shared typography and spacing; readable single-column document rows; metric definitions reflow on phones; less decorative framing. Native tables retain keyboard-accessible scroll regions. Dark surfaces now have distinct page, input and content tones.
- **Styles:** folded duplicate component rules together and placed responsive rules after components; removed grain/stamp effects rather than adding another final override layer. The stylesheet is 3,732 lines, down from 4,069 despite expanding formerly dense rules for readability.
- **Session bootstrap:** guest loads previously emitted an expected `/me` 401 in the browser console. The UI now requests `/me?optional=true`, which returns JSON null without a valid session. Default `/me` still returns 401 for absent or forged cookies; valid identities, logout, role enforcement and every protected endpoint keep their contracts. Three focused backend cases cover the probe.

No policy, fixture, threshold, benchmark output, permission rule or answer-provider integration was changed. Existing browser assertions and controls were retained. The only existing browser-harness change makes the evidence output directory configurable, so earlier evidence is preserved.

## Comparable screenshots

Both sets use the PE deal room, guest laboratory Analyst, query **“What is Meridian's ARR growth rate and net revenue retention?”**, k=8, 2,048-token budget and 1,000px viewport height. Login captures show the same public accounts; Upload captures use Patricia's administrator session. Widths are 375, 768, 1024 and 1440; every state is captured in light and dark. The script performs real interactions with the production backend. Audit timestamps and elapsed-time proxies are naturally run-specific.

| State | Before | After |
|---|---|---|
| Query, 1440 light | [Before](before/query-1440-light.png) | [After](after/query-1440-light.png) |
| Retrieved context, 1440 light | [Before](before/results-1440-light.png) | [After](after/results-1440-light.png) |
| Retrieved context, 375 dark | [Before](before/results-375-dark.png) | [After](after/results-375-dark.png) |
| Compare, 1440 light | [Before](before/compare-1440-light.png) | [After](after/compare-1440-light.png) |
| Compare, 768 dark | [Before](before/compare-768-dark.png) | [After](after/compare-768-dark.png) |
| Trace, 1024 light | [Before](before/trace-1024-light.png) | [After](after/trace-1024-light.png) |
| Documents, 1440 light | [Before](before/documents-1440-light.png) | [After](after/documents-1440-light.png) |
| Evaluations, 375 light | [Before](before/evals-375-light.png) | [After](after/evals-375-light.png) |
| Audit, 1024 dark | [Before](before/audit-1024-dark.png) | [After](after/audit-1024-dark.png) |
| Upload, 768 light | [Before](before/upload-768-light.png) | [After](after/upload-768-light.png) |
| Login, 375 dark | [Before](before/login-375-dark.png) | [After](after/login-375-dark.png) |
| Guide, 375 light | [Before](before/guide-375-light.png) | [After](after/guide-375-light.png) |

[Before matrix](before/matrix.json) · [After matrix](after/matrix.json) · [All before images](before/) · [All after images](after/)

The earlier `docs/evidence/after/` and `docs/evidence/docker/` assets are untouched. Additional regression states include [simulated Ask](tests/ask-simulated.png), [insufficient evidence](tests/insufficient-evidence.png), [evaluation failure](tests/evaluation-failed.png) and [DOCX upload](tests/upload-complete.png).

## Validation

Commands below were run from the worktree. Production smoke uses actual retrieval and both bundled corpora. The broader browser suite uses temporary corpora and a simulated answer provider for Ask; it does not make paid requests.

| Command / check | Result | Evidence |
|---|---|---|
| `.venv/bin/python -m pytest tests/ -q` | **508 passed**, one upstream Starlette/httpx deprecation warning | [Log](tests/pytest.txt) |
| `.venv/bin/ruff check src/ tests/` | Passed | [Log](tests/ruff.txt) |
| `node --check frontend/app.js`; `git diff --check` | Passed | [Static checks](tests/static-checks.txt) |
| `QUERYTRACE_TEST_OUTPUT_DIR=docs/evidence/ui-polish/tests QUERYTRACE_TEST_PYTHON="$PWD/.venv/bin/python" npm run test:e2e` | **48 passed**, no skipped tests or weakened assertions | [Log](tests/browser.log), [JSON report](tests/browser-results.json) |
| `QUERYTRACE_SMOKE_OUTPUT_DIR=docs/evidence/ui-polish/after node tests/browser/ui-polish.cjs` | **80 states**, both themes × four widths; no viewport overflow, console errors or page errors | [Matrix](after/matrix.json), [Log](tests/matrix.log) |
| `QUERYTRACE_SMOKE_BASE_URL=http://localhost:8015 QUERYTRACE_SMOKE_OUTPUT_DIR=docs/evidence/ui-polish/production node tests/browser/production-smoke.cjs` | Both real corpora; Query, Compare, Documents, Evaluations, Guide; Ask disabled; test routes absent | [Report](production/production-smoke.json), [Log](tests/production-smoke.log) |
| WCAG 2 A/AA + 2.1 AA axe scans | Zero reported violations in Query and Guide, both themes | [Light Query](tests/accessibility-light-query.json), [Dark Query](tests/accessibility-dark-query.json), [Light Guide](tests/accessibility-light-tour.json), [Dark Guide](tests/accessibility-dark-tour.json) |
| `node tests/browser/accessibility-surfaces.cjs` | 12 additional axe scans, zero violations: expanded metadata/trace, Documents, Evaluations, Audit and login in both themes | [Report](tests/additional-accessibility.json), [Log](tests/additional-accessibility.log) |
| Local documentation links | No missing target files | [Report](tests/documentation-links.json) |
| H.264 export playback and decode | Entire video played at normal speed; no playback or decode errors; eight visual checkpoints inspected | [Playback](video/playback-review.json), [Log](tests/playback.log), [Decoder log](video/decode.log) |

The first browser pass found a desktop Compare overflow introduced by the initial layout; it was fixed and the entire suite rerun. [Initial log](tests/browser-initial.log). The baseline matrix records eight expected unauthenticated 401 probes; the final matrix records zero after the optional session probe fix. Repeated live login captures initially hit the existing ten-attempts/minute limit; the capture helper respects its cooldown. The application limit was not changed.

The suite covers all six public account logins, reload/logout on both local hostnames, guest and simulated roles, workspace changes, real source disclosure, all Guide steps, keyboard navigation, empty/blocked/budget outcomes, stale in-flight results, upload, exports, evaluation failures and actual sent-context accounting with a simulated Ask provider.

## Video

[![QueryTrace recorded walkthrough](video/cover.png)](video/querytrace-demo.mp4)

[MP4](video/querytrace-demo.mp4) · [Local player instructions](../../demo-guide.md#recorded-walkthrough) · [Captions](video/captions.srt) · [Transcript and regeneration](../../demo-guide.md#recorded-walkthrough)

The recording uses a 1440 × 900 application viewport plus a 96px caption band: H.264, yuv420p, 25fps, fast-start MP4, about 59 seconds and 1.2 MB. Captions derive counts from backend responses. It includes a real query, source expansion, permission-block decision, policy comparison and Guide reopening. [Response/timeline record](video/demo-run.json). Visual review checked text readability, the source excerpt's ARR/NRR lines, the blocked fragment, aligned comparison metrics, caption timing and final Guide controls. Nothing was uploaded externally.

Reproduce playback checks with `node tests/browser/review-video.cjs` while serving the video's directory on port 8016. The player intentionally uses local HTML; GitHub inline playback is a separate pending manual attachment step described in the guide.

## Boundaries

This revision was verified on local macOS Chromium and Python 3.11. The base revision's Linux ARM64 Docker evidence is retained but was not rerun for this visual change. Real Anthropic calls, remote CI, deployment, other browser engines and manual assistive-technology testing are not claimed. No external asset upload or deployment is part of this evidence. All recorded retrieval runs used no answer-provider key.
