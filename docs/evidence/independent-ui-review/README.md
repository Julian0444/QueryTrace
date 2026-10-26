# Independent UI review — October 25, 2026

**Merge recommendation: hold.** The existing implementation demonstrates real policy decisions, but the first screen offers too many competing starts and the comparison does not consistently lead to readable evidence. Browser exploration also reproduced three functional UI defects that the earlier green suite did not cover. Both independent reviewers recommend changes before merge. This review supersedes the earlier broad readiness statement; it does not invalidate the recorded test results.

Candidate: `97530876c3eb7ac7e447e90c5aca35c14ecf1895`, branch `codex/querytrace-taste-redesign`. Product code was held unchanged throughout the independent reviews. The changes accompanying this report are documentation and evidence only; none of the findings below is presented as fixed.

## Review method and evidence

- **GPT-6 Astra:** independently delegated with the requested model, using CUA in the Codex internal browser. [Report](astra/report.md), [first impressions](astra/first-impressions.md), 11 saved screenshots.
- **Claude Opus 5.5:** exact runtime model `claude-opus-5-5`, using Claude Code and Playwright MCP in an isolated Chrome browser. [Report](opus/report.md). The actual model and tool activity are recorded in [provenance](provenance.json).
- **Coordinator:** independently reproduced the Ask retry, expanded comparison overflow, stuck scenario status, enabled-Ask landing and restricted-identity control density using CUA on a third isolated server. Rechecked and rejected the initial stale-budget hypothesis. All 12 [served-asset checks](served-assets.json) matched the candidate frontend, including the owner's main server.

Both reviewers received the same [protocol](protocol.md), recorded first impressions before source inspection, and did not read each other's conclusions. Separate test servers copied the fictional corpora and used real application routes. Only the answer provider was deterministic; no real Ask provider calls were made. Uploads affected temporary corpora only. Test-only workspace names and injected failure/answer wording are not counted as product defects.

T3 Code was installed, but opening a new review session through its native UI did not succeed. The first Claude-in-Chrome attempt also had no connected browser extension. The completed alternative uses the [official Playwright MCP](https://github.com/microsoft/playwright-mcp) with an isolated profile; it does not depend on the owner's Chrome tabs or extension connection. The original [Claude Chrome integration](https://code.claude.com/docs/en/chrome) attempt is setup history, not a completed audit.

## Confirmed defects

### B1. Expanding Full Policy's trace breaks desktop comparison width

**Observed layout defect; fix before merge.** As a guest Analyst in PE, run Permission Wall's comparison and expand the Full Policy Decision Trace. The trace makes the right-hand column exceed the viewport and introduces page-level horizontal scrolling, cutting off its metrics and evidence. Closing the trace restores the page width.

Coordinator measurement at a 1280px viewport: the document was 1265px wide with the trace collapsed and 1563px with it expanded. Opus also captured overflow at 1440px. This is a content-layout change caused by expanding a normal control, not a screenshot scaling inference.

[Visible reproduction](reproduction/compare-trace-overflow.jpg) · [Measured before/after](reproduction/compare-trace-overflow.json).

Expected: all three policy columns remain within the viewport; the trace's wide table scrolls inside its own bounded container. Inspect the comparison subgrid's intrinsic sizing and trace wrapper constraints, not just the outer page's overflow. Do not hide the clipped evidence to make an overflow assertion pass.

### B2. Ask's “Try again” runs retrieval instead of generation

**Observed interaction defect; fix before merge.** Enable a deterministic provider failure, enter a valid question and click Ask AI. Restore the healthy provider and click Try again. The resulting page says **Context only · no answer generated**. No new provider call occurs. The failed operation has silently changed from Ask to Query.

Astra observed this independently. The coordinator repeated it with a healthy provider and no prompt cap, ruling out the limited-context fixture as the cause. The shared error handler in `frontend/app.js:1977` dispatches result retries to `runSingleQuery`; the Ask catch at `frontend/app.js:979` does not retain a distinct retry operation.

[Visible reproduction](reproduction/ask-retry-runs-query.jpg) · [Provider-call count](reproduction/ask-retry.json).

Expected: retry the failed operation with clearly defined executed inputs. If the UI offers retrieval as an alternative, label it as an alternative action. Add a regression that clicks the actual retry button, restores provider health, and verifies an Ask response and answer panel.

### B3. Returning to Query after a comparison example leaves a false running status

**Observed state defect; fix with the main-flow changes.** From a fresh Query view, click **Stale detection →**, wait for its comparison, then return to Query. The result area still reads **Scenario selected. Running its configured query and document role.** There is no query in progress and the message does not complete. Opus observed this at desktop width; the coordinator reproduced it through CUA.

[Visible reproduction](reproduction/scenario-stuck-running.jpg). The scenario action writes this message via `invalidateResults` at `frontend/app.js:826`, while only the comparison result is subsequently rendered. Expected: an accurate ready/empty state when returning to Query, or an actual result with its execution provenance. A comparison action must not leave a fake loading message in another mode.

## Product clarity priorities

These are design judgments grounded in observed use, not claims of security or backend failure.

| Priority | Observed problem | Concrete direction | Acceptance check |
| --- | --- | --- | --- |
| Before demo-ready merge | Query leads with a document list while the strongest policy lesson is in Compare | Put a short, factual policy outcome beside the result and label unauthorized baseline inclusions where they appear | The visitor can explain what the policy changed without first discovering a secondary view |
| Before demo-ready merge | Empty question, Examples row, separate comparison example and three Run/Compare/About scenario cards compete for the first action | Use one scenario entry system with a visible question and intended observation; retain free-form entry | A new visitor can choose a meaningful first question without decoding several parallel sets of controls |
| Before demo-ready merge | “Run query” and “Ask AI” require a distant technical explanation | Label the outcomes directly, such as Retrieve evidence and Generate answer; make the answer action secondary to evidence inspection | The visitor can explain whether a model will be called before clicking |
| Before demo-ready merge | Restricted sign-in leaves a screen full of disabled navigation, role choices, examples and scenario actions | Show the authenticated role as status and surface relevant actions; put unavailable laboratory/admin tools in a secondary context with one explanation | Analyst has an obvious usable scenario and does not have to scan several dead ends |
| Before demo-ready merge | Compare exposes short snippets and ranking details but no direct source reader | Add an authorized source/fragment reader in comparison context | From a policy result, the visitor can read the supporting text without losing the comparison |
| Before demo-ready merge | Scrolling loses policy labels; mobile stacks entire policy lists | Keep policy context visible and provide a compact outcome comparison before long source lists | At any evidence position the visitor can identify its policy; mobile comparison does not depend on remembering a previous long list |
| Follow-up | Evaluations can honestly show partial/all failure without a visible rerun action | Add contextual rerun/retry with clear run provenance | Recover from an injected transient failure using an obvious page action |

The desired demonstration is **question → selected and blocked evidence → reasons for the policy decision**, with answer generation available once that distinction is understood. The current restrained colors and typography are useful; the next pass should change the choice structure and evidence flow.

The detailed reports contain additional proposals, not an instruction to adopt each one. Preserve the configured baselines and honest document/fragment accounting. Explain when freshness only penalizes or reorders a source; do not alter fixtures, relevance judgments or policy outcomes to manufacture a more favorable contrast. These reviews are not an independent security certification.

### Control decisions

| Keep prominent | Combine | Move into context or secondary tools |
| --- | --- | --- |
| Question, role/policy experiment, the concrete policy outcome, evidence and decision trace | Examples and scenario launchers; repeated entry points to comparison; repeated identity/role explanation | Technical exports, ranking details, methodology, Evaluations/Audit/Upload, unavailable controls and duplicate guide dismissal actions |

Documents, workspace, identity, Guide and theme remain accessible. This recommendation does not require a sidebar, a promotional hero, a new framework, or weaker permission checks.

[Initial screen with Ask enabled](reproduction/initial-ask-enabled.jpg) · [Restricted Analyst screen](reproduction/signed-in-disabled-controls.jpg) · [Comparison evidence without policy context](astra/11-desktop-comparison-evidence.jpg).

## Findings rejected or bounded

**Stale budget results were not confirmed.** Native CUA editing followed by Tab correctly cleared Query and Compare results and displayed a settings-changed notice. The initial discrepancy came from a different automation event path. [Query check](reproduction/budget-query-invalidation-correct.jpg) · [Compare check](reproduction/budget-compare-invalidation.jpg). It is excluded from the defect list.

The disabled Ask state was exercised intentionally; the owner's configured application has Ask enabled. The enabled-state screenshot above shows that the competing-action issue remains without relying on an unavailable provider. Baseline permission leakage is an intentional laboratory demonstration and must remain clearly labeled; it is not itself an authorization bypass finding.

The reviewers' coverage tables are authoritative about what they actually exercised. Broad route coverage is not exhaustive coverage of every scenario, viewport, theme and failure combination. Astra's remaining empty/private/restricted fixture checks were interrupted when its browser became unavailable. No production readiness or current CI result is inferred from these local audits.

## Revised merge gate

1. Fix B1–B3, with regressions that expand comparison traces at desktop/narrow widths, click Ask's real recovery action and return to Query after a comparison example.
2. Consolidate the first-run choices and authenticated-state controls; preserve the ability to demonstrate role and policy differences.
3. Make comparison evidence readable in context and retain policy identity during scrolling/mobile use.
4. Repeat the affected journeys in the browser, inspect before/after screenshots, and review every changed outcome label. Re-run appropriate existing browser/accessibility checks and then the PR's required CI.
5. Refresh the demo recording and documentation if the UI changes. The existing video documents the pre-remediation candidate and should not be silently relabeled as evidence of a later fix.

Previous local test totals are retained in [merge-readiness](../../merge-readiness.md) as historical checks, not a substitute for the newly identified acceptance criteria. No push, merge or deployment was performed.

## Delivery validation

[Validation record](validation.json): local report links resolve, all JSON parses, and 101 retained screenshots were checked for readable files, matching formats and hashes. The larger screenshot sets preserve the reviewers' coverage; the links above select the evidence most relevant to the merge decision. Runtime source, corpora, fixtures and tests remain unchanged from the candidate. The existing full test suite was not rerun for this documentation-only delivery.
