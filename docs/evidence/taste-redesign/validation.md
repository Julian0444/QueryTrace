# Validation record

Executed from the new checkout, using the existing Python environment and
Playwright dependencies. Baseline: `e9ca89f`; branch:
`codex/querytrace-taste-redesign`. Public demo corpora only; upload tests used
temporary copies. No production data or retrieval policies changed.

| Command / check | Result | Evidence |
|---|---|---|
| `python -m pytest tests/ -q` | 508 passed, one existing Starlette/httpx deprecation warning | [pytest](tests/pytest.txt) |
| `ruff check src/ tests/` | All checks passed | [Ruff](tests/ruff.txt) |
| `node --check frontend/app.js` and changed browser scripts | Passed | [syntax](tests/syntax.txt) |
| SVG XML parse and HTML duplicate-ID check | Passed | [syntax](tests/syntax.txt) |
| `npm run test:e2e` before changes | 50 passed | [baseline](tests/browser-before.txt) |
| `npm run test:e2e` after changes | 50 passed | [browser](tests/browser.txt), [JSON](tests/browser/browser-results.json) |
| `npm run test:e2e -- --grep 'evaluations\|accessibility\|exports'` after final evaluation copy | 4 passed | [targeted](tests/targeted.txt) |
| `node tests/browser/ui-polish.cjs` | 80 real UI states per baseline/final sweep; no overflow or console/page errors | [before](before/matrix.json), [after](after/matrix.json) |
| `node tests/browser/verify-style.cjs` | 8 theme/width combinations; fonts, served hashes, focus, hover, provider state, zero-budget and no-evidence, Guide, Compare, workspace clearing; zero external runtime requests or failed network requests | [style](tests/style-checks.json) |
| `node tests/browser/production-smoke.cjs` | Real app and both corpora; test routes absent; zero Ask requests | [smoke](tests/production/production-smoke.json) |
| `node tests/browser/copy-audit.cjs <output.json>` | 173 → 14 instructional words; 400.8 → 184.1px question position | [before](before/copy.json), [after](after/copy.json) |
| CUA human-style flows | Guide, drafts, query, trace, source, empty outcomes, login/limited role, logout, Documents, Evaluations, Audit, workspace and theme | [review narrative](README.md#human-style-interaction-and-actual-ask) |
| CUA upload via file chooser | Real DOCX ingestion in temporary corpus; table and header/footer read back | [extracted text](after/cua-upload-source.jpg) |
| CUA real Haiku Ask | One actual call + cached repeat; max output 600, local budget 2048, exact sent context checked, no blocked documents | [verification](ask/verification.json) |
| `node tests/browser/record-demo.cjs` | 58.88s actual UI recording; no `/ask` requests | [run](video/demo-run.json) |
| `node tests/browser/build-demo-preview.cjs` | Animated GIF, ~3.20 MiB, 1080×747, 8fps | [preview](video/preview.gif) |
| `node tests/browser/review-video.cjs` | Full H.264 playback, 1472 frames, 0 dropped, no errors | [playback](video/playback-review.json) |
| CUA complete video playback | Reached 58.88s / ended; inspected screenshots plus full playback | [CUA](video/cua-playback.json) |

Environment parameters used for read-only UI scripts:

```bash
QUERYTRACE_SMOKE_BASE_URL=http://localhost:8035
QUERYTRACE_SMOKE_OUTPUT_DIR=docs/evidence/taste-redesign/after
QUERYTRACE_TEST_PYTHON="$PWD/.venv/bin/python"
QUERYTRACE_TEST_OUTPUT_DIR=docs/evidence/taste-redesign/tests/browser
QUERYTRACE_VIDEO_OUTPUT_DIR=docs/evidence/taste-redesign/video
QUERYTRACE_VIDEO_PLAYER_URL=http://localhost:8036/video/
```

Set the relevant variables inline or export them before the documented commands.
`FFMPEG` pointed to the existing local imageio-ffmpeg 7.1 binary; no new video
dependency was added. See [recording instructions](../../demo-guide.md).

The browser suite includes axe checks for serious/critical violations in both
themes and Guide, keyboard-only controls, OS themes, reduced motion, actual
upload, permission-limited accounts, workspace clearing, failure recovery,
server-enforced roles and Guide's result/draft contracts. Simulated-provider
checks are isolated from the bounded real Haiku call.

An initial run had 49/50 passing because it expected Tab from Trace to skip the
new methodology disclosure. The revised assertion opens that disclosure by
keyboard and then checks focus on the same decision table; no behavior or
permission contract was removed. An immediate hover color check raced the
transition; it now waits for the color change. The reruns passed.

Final visual inspection covered initial task focus, density, type hierarchy,
Compare alignment, documents, login/upload, dark data readability, narrow Guide,
source/citation visibility, the original icon studies and the exported video.
The exact inspected video frames include 03, 13, 21, 28, 35, 42, 48 and 55 seconds;
GIF frames at 13 and 42 seconds were also inspected. The GIF derives from the
same full MP4, with no fake UI compositing.

No external Taste verifier ran, because no authorized public candidate URL
exists. No Docker rebuild or external deployment is claimed. CUA retained its
actual 1280×720 viewport despite requested overrides; responsive widths were
verified by the real Chromium scripts. Existing backend warning remains.
