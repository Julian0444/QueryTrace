# Guide and presentation follow-up

The guide now retains the example query and results when a visitor starts without prior work. Existing drafts and results are still restored after explicit example actions, and results from a replaced corpus are never restored. The Compare step runs a real comparison; the trace step opens Full Policy. On desktop the guide sits above the application so all three comparison columns retain their width.

Compare calls out the actual unauthorized documents included by Top-k. Result details and trace rows show the backend's selection priority (50% relative rank + 50% freshness), while keeping relative rank distinct from confidence. Audit groups execution, actor and role fields into five readable columns; detailed parameters remain available. Evaluations labels the Full Policy benchmark, explains precision's expected-document denominator and links to live per-query comparison. Aggregate baseline evaluation remains available through the evaluator CLI, not this screen.

The README leads with the RAG problem, the three policy questions, measured fixture results and the walkthrough. Technical limits and verification details follow the quick start. No policies, fixtures, thresholds, retrieval order or evaluation results changed. Machine-specific paths were removed from the UI evidence reports; earlier screenshots are retained.

## Comparable screenshots

PE workspace, guest Analyst, ARR/NRR query, k=8, 2,048 tokens, 1,000px viewport height. Each pair uses the same width and theme. Audit execution times naturally differ.

| Screen | Previous UI | Updated UI |
|---|---|---|
| Compare, 1440 light | [Before](../after/compare-1440-light.png) | [After](compare-1440-light.png) |
| Guide, 1440 light | [Before](../after/guide-1440-light.png) | [After](guide-1440-light.png) |
| Guide, 375 dark | [Before](../after/guide-375-dark.png) | [After](guide-375-dark.png) |
| Audit, 1440 light | [Before](../after/audit-1440-light.png) | [After](audit-1440-light.png) |
| Evaluations, 1440 light | [Before](../after/evals-1440-light.png) | [After](evals-1440-light.png) |
| Trace, 1440 light | [Before](../after/trace-1440-light.png) | [After](trace-1440-light.png) |

## Validation

[Results](validation.json): 508 Python tests; 50 browser tests; Ruff, JavaScript syntax and whitespace checks passed. Browser coverage includes login/logout, workspace changes, restricted accounts, empty states, uploads, simulated Ask, keyboard, accessibility and both themes at 375, 768, 1024 and 1440px. Two new browser tests complete or exit the guide from an empty session, verify that Query and Compare retain real results, check three desktop columns, the Full Policy trace, the actual exposure count, selection priority and Audit width. The existing prior-draft restoration test now verifies that the guide itself runs Compare and opens Full Policy.

Twelve additional accessibility scans (expanded results, trace, Documents, Evaluations, Audit and login in both themes) found zero violations. All 190 local documentation links resolve. The production screenshot sweep checked 80 states against the served checkout, with no page/console errors or page overflow. Full logs and the complete regenerated sweep can be kept outside the repository; only the six comparison screenshots above are added here.

```bash
python -m pytest tests/ -q
ruff check src/ tests/
node --check frontend/app.js
git diff --check
QUERYTRACE_TEST_OUTPUT_DIR=/tmp/querytrace-browser \
  QUERYTRACE_TEST_PYTHON="$PWD/.venv/bin/python" npm run test:e2e
QUERYTRACE_SMOKE_BASE_URL=http://localhost:8015 \
  QUERYTRACE_SMOKE_OUTPUT_DIR=/tmp/querytrace-screenshots \
  node tests/browser/ui-polish.cjs
```

The [MP4](../video/querytrace-demo.mp4), [cover](../video/cover.png) and [captions](../video/captions.srt) are regenerated from the updated production UI. The 58.76-second H.264 export was played through at normal speed and decoded without errors; eight visual checkpoints were inspected for legibility, framing and caption timing. Browser playback reported one dropped frame out of 1,469. See [recording and playback instructions](../../../demo-guide.md#recorded-walkthrough) and the [playback report](../video/playback-review.json).

Verification remains local macOS Chromium and Python 3.11. The upstream Starlette/httpx deprecation warning remains. Docker was not rerun; live model-provider calls and external deployment are unverified. The small corpus can still return the same accessible documents for multiple questions; this behavior is documented rather than masked by fixture or threshold changes.
