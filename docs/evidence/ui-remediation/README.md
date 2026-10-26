# UI remediation — October 25, 2026

Implemented the [independent review](../independent-ui-review/README.md) findings for local owner testing. This delivery is limited to frontend fixes, simplified controls, regressions and their validation. The existing demo video is historical; no new recording, external model-provider call, push, merge or deployment was made.

## Changes

- **B1:** independent comparison columns constrain their children; wide decision tables scroll locally. Expanding a trace no longer widens the page or pushes the other columns’ evidence down. Policy headers remain visible while scrolling.
- **B2:** error recovery retains the failed operation and its original question, role, policy, k, budget and workspace. Retrying generation calls `/ask` and renders an answer.
- **B3:** selecting a comparison scenario leaves an accurate ready state in Query and resets its busy state.
- One persistent scenario picker shows each question, intended observation and a single action. Guest/admin scenarios compare policies; restricted accounts receive compatible retrieval scenarios. Free-form questions remain available.
- **Retrieve evidence** and **Generate answer** name the two outcomes. Tools contains permitted Evaluations/Audit/Upload actions. Restricted roles appear as status; unavailable controls and duplicate guide dismissal were removed.
- A compact policy outcome table precedes comparison evidence. Each source identifies its policy and opens exactly that policy’s included fragments, with keyboard-accessible scrolling. No new source permissions are granted.
- Query outcomes state actual blocked/excluded counts. For unfiltered baselines, authorized document metadata identifies included documents outside the simulated role’s access. If metadata is unavailable, the general baseline warning remains. Exported responses are unchanged.

## Validation

**508 Python tests, 60 browser tests and Ruff passed.** After bounding long comparison tables vertically, all 14 affected responsive, expanded-trace and accessibility checks passed again. See [validation.json](validation.json) for checks and frontend hashes. Regressions cover expanded traces at 375/768/1024/1440px, actual Ask recovery, scenario-to-Query navigation, exact per-policy source text, baseline inclusion labels and accessibility in light/dark themes. Existing authorization, ingestion, export, guide and workspace flows remain covered.

CUA inspection in the internal browser checked the simplified landing, restricted Analyst view, expanded comparison, inline source reader and recovery from a deterministic provider failure. The main app at `http://localhost:8035/app/` serves the changed files; fake-provider testing used an isolated temporary-corpus server.

## Branch and handoff

Work remains on `codex/querytrace-taste-redesign`, an extension of the user-linked `codex/querytrace-improvements`. A fresh fetch before these changes confirmed all commits from `origin/codex/querytrace-improvements` were present, with six later commits ending at `4ae93b6` before this remediation. The original checkout was preserved.

Owner review is pending. The evaluation rerun proposal marked “Follow-up” in the original report remains outside this focused change. Final CI and any updated demo recording are separate from this local review.

## Visual evidence

[Running application](running-app.jpg) · [Restricted Analyst](restricted-analyst.jpg) · [Expanded comparison](expanded-comparison.jpg) · [Selected source fragments](comparison-source.jpg).
