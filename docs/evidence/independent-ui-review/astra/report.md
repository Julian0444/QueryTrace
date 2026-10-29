# Independent UI review — GPT-6 Astra

**Recommendation: request changes before calling this candidate demo-ready.** The main experiment works and its visual treatment is calm. The permission comparison is convincing when it names the documents admitted by Top-k and blocked by Full Policy. However, Ask error recovery performs the wrong operation, and the launch/evidence flow still makes visitors work too hard to understand the demonstration.

Candidate supplied: `97530876c3eb7ac7e447e90c5aca35c14ecf1895`. Review date: 2026-10-25. Reviewer: GPT-6 Astra, independently delegated reviewer. Harness: Codex desktop subagent, CUA native accessibility actions plus the CUA-documented Playwright locator API, a newly created internal-browser tab, exclusively `http://localhost:8038/app/`. No other reviewer output was read. No product code was changed.

## First impressions, kept distinct

The contemporaneous [first-impression notes](first-impressions.md) were written after dismissing the welcome dialog with **Explore on my own**, before reading product source or other reviews.

I understood this as a fictional enterprise-document retrieval laboratory demonstrating role and policy effects. I expected to run a supplied scenario because I did not yet know the corpus. The largest control was an empty question box, while the concrete scenario question was hidden under **About this scenario**. Two example links, a separate comparison example, three scenario cards with Run/Compare/About actions, and six navigation items all offered competing starts.

The visual styling itself is restrained. The difficulty is the number and meaning of choices. The welcome copy establishes “question, permissions and the decision trace,” but that purpose is not stated as plainly on the persistent main page. Query versus Ask is inferable from the small “Run: context only · Ask: generated answer” line; the primary button labels do not carry the distinction themselves.

The isolated server initially had Ask disabled. I subsequently enabled and tested the deterministic provider. The disabled Ask observation is an unavailable-state judgment, **not a claim that Ask is disabled in the owner’s main application**. That main application was not visited.

## Prioritized findings

### F1 — Ask failure recovery runs Query instead of Ask

**Observed bug · high impact on the failed-answer flow · merge blocker.**

Steps:

1. In Nimbus, enter “What is the current on-call escalation process and database failover procedure?” as Employee with Full policy.
2. Enable the isolated fake provider with `{"enabled":true,"provider_error":true}` and click **Ask AI**.
3. Observe **Request failed**, the injected provider message, and **Try again**.
4. Reset the fixture to `{"enabled":true,"context_cap":100}` and click **Try again**.

Observed: the error disappears into a normal result labeled **Context only · no answer generated**, with 6 documents and 2014 context tokens. There is no Ask answer/accounting panel. The permitted `/__test/state` inspection reported `calls: []`. Clicking **Ask AI** directly then produced the distinct **No answer generated** panel and prompt-cap explanation expected for that limited-context fixture. Thus the retry did not attempt the failed operation.

Expected: retry the Ask request, retaining its operation and inputs, or explicitly label a deliberate alternative as **Retrieve context instead**. A generic recovery control must not silently change the task.

Evidence: [06-ask-retry-became-query.jpg](06-ask-retry-became-query.jpg); CUA observations “Test generated-answer provider failure,” “Retry Ask with limited context fixture,” and “Verify limited context directly through Ask.” Source inspected only afterward: `frontend/app.js:979` passes Ask failures to the shared renderer; `frontend/app.js:1977`–`1983` dispatches the general result retry to `runSingleQuery`, with no Ask branch. The parent later independently confirmed the same behavior with a healthy provider without the context cap; this report’s own reproduction is the one documented above.

### F2 — Several overlapping launch paths obscure the experiment

**Design judgment · high importance for the stated demonstration goal · should address before demo-ready approval.**

Steps: enter either built-in workspace, choose **Explore on my own**, and inspect the page before running a question. Also sign in as Julia or Victoria.

Observed: the first screen combines an empty question form, Run/Ask, role and policy controls, two example links, a separate “Compare” example, and three scenario cards containing parallel Run/Compare/About actions. Query and Compare also occupy peer navigation positions beside four supporting views. Under restricted identities, many of these controls remain visible but disabled. For example, Victoria’s Analyst scenario says **Requires document role Analyst; your authenticated role is VP**. That describes the scenario’s fixed role as if the more senior identity lacks document access.

Expected: one obvious demonstration start with a visible question and one primary action, followed by the role/policy experiment and evidence. Preserve free-form querying as an obvious secondary route. Explain fixed-role demonstrations as simulations, separately from access restrictions.

Suggested direction: consolidate examples and scenarios into one scenario selector/list; show each scenario question and intended observation; choose one primary scenario action (comparison is particularly effective here). Keep Query and Ask outcomes explicit, e.g. **Retrieve evidence** and **Generate answer**. A disabled provider state can be a concise adjacent explanation rather than a prominent dead action. Move Evaluations, Audit and Upload to a clearly secondary tools area; keep Documents easy to reach as the source corpus.

Evidence: [04-saas-entry-enabled-ask.jpg](04-saas-entry-enabled-ask.jpg), [01-analyst-disabled-controls.jpg](01-analyst-disabled-controls.jpg), and initial CUA screenshot “Inspect initial page without guide.” This is a hierarchy judgment, not a claim that the controls fail.

### F3 — Comparison offers ranking details but no direct path to read its evidence

**Design judgment · medium/high impact on the product’s central evidence story · should address.**

Steps: run the PE VP financial-model comparison, the Partner freshness comparison, or the SaaS Salary bands/Roadmap comparison. Inspect an included document in any column.

Observed: a card shows the title, reference, fragment count, a short snippet and **Ranking & freshness**. Its title is not a link and there is no **Read source** action. The snippet frequently consists mostly of the document header, ending before the substantive evidence. The user can inspect why a source ranked, but cannot read that source from the comparison. Query’s **Read source** and Documents’ **Read extracted text** do work, so this absence is especially noticeable.

Expected: an in-context source reader that exposes the exact included fragments, with document metadata and full authorized source text where appropriate. Preserve the comparison while reading. A source drawer or one expandable document action would serve the user better than requiring a navigation/filter detour.

Evidence: [11-desktop-comparison-evidence.jpg](11-desktop-comparison-evidence.jpg), [09-mobile-comparison-scrolled.jpg](09-mobile-comparison-scrolled.jpg). Later source verification: `frontend/app.js:1494` truncates comparison content to 120 characters; `frontend/app.js:1506`–`1514` renders a static title and snippet followed by ranking disclosure, with no source-opening control.

### F4 — Comparison loses policy context during evidence inspection

**Design judgment · medium impact · should address together with F3.**

Steps: on desktop, run a comparison and scroll down one viewport into the source cards. At widths 768 and 375, inspect the same comparison and scroll through its results.

Observed: desktop keeps global navigation visible but scrolls the three policy headings away. The source cards no longer identify their policy, so the user must remember column order. At tablet/mobile, the columns become three complete lists stacked sequentially. At 375 px, a viewport deep in a list contains neither its policy label nor the other policies’ outcomes. There is no horizontal overflow in the tested mobile comparison, but “compare” has become a memory task over a long page.

Expected: retain policy labels while reviewing evidence and show the important differences together. A compact document-by-policy outcome summary, followed by one selected policy’s source detail, would scale better than three fully repeated lists. Sticky local headings are a smaller desktop improvement.

Evidence: [11-desktop-comparison-evidence.jpg](11-desktop-comparison-evidence.jpg), [07-tablet-comparison.jpg](07-tablet-comparison.jpg), [08-mobile-comparison-top.jpg](08-mobile-comparison-top.jpg), [09-mobile-comparison-scrolled.jpg](09-mobile-comparison-scrolled.jpg). Mobile’s global header did scroll away; it did **not** permanently consume a quarter of the viewport.

### F5 — Completed-with-failures evaluations have no visible rerun action

**Design judgment · medium impact on recovery · optional follow-up, not the primary merge blocker.**

Steps: enter Evaluations with partial and then total injected retrieval failures. Inspect the summary and page actions, leave for Audit, and return.

Observed: **Incomplete** accurately says 11/12 complete and 1 failed; **Failed** accurately says 0/12 and suppresses permission metrics. The only evaluation actions visible were **Compare policies on a question** and **Export evaluation JSON**. Returning to the view preserved the failed result. No visible Retry/Rerun action explains how to refresh this completed-but-unsuccessful benchmark.

Expected: a contextual **Rerun evaluation** or **Retry failed queries** action, with clear provenance for the displayed run. This is a useful action to add while removing redundant navigation elsewhere.

Evidence: [03-evaluation-partial.jpg](03-evaluation-partial.jpg) and CUA observations “Inspect total evaluation failure state” / “Inspect audit details and evaluation recovery after fixture reset.” I did not establish an independent backend recovery problem; the finding concerns the visible recovery affordance.

## What worked, and hypotheses rejected

- The comparison banner makes the permission effect concrete: PE VP showed two unauthorized Top-k documents, and SaaS Employee Salary bands showed three. Document names made the lesson understandable.
- Query records the executed question, workspace and effective role. Editing the question adds an input-changed notice. Changing the policy adds a controls-changed notice. Changing role removes old results. Switching workspace signs out the prior identity and clears results.
- **Budget staleness was disconfirmed.** CUA Playwright `fill` plus `press("Tab")` changed the displayed number without the same change-event behavior as native CUA. Native `setValue` plus `pressKey("Tab")` in Compare removed results and displayed **Retrieval settings changed. Run again with the new candidate limit and budget.** Source afterward confirmed a `change` listener on both k and budget (`frontend/app.js:2164`). No stale-budget defect is claimed.
- All six public demo identities signed in. Low/middle accounts had fixed roles and disabled laboratory/admin views; admin identities could simulate other roles. Invalid login gave a clear error and a demo-card click recovered. No unauthorized content bypass was attempted or observed.
- Query source expansion, Documents filtering/full extracted text, and Ask citation navigation worked. The citation moved focus to the source card. Invalid fixture citations were visibly marked; raw script-like fixture content rendered as text. The deterministic answer’s wording and invalid citation are intentional fixture facts, not product defects.
- Guide Back/Next, Skip, reopen, Restart, Finish, Enter activation and Escape worked. Opening/navigating/skipping it preserved the existing comparison and question in the tested flow. Mobile kept guide navigation accessible with an internally scrollable content area.
- Upload required admin access. Empty submission invoked native file validation. The authorized DOCX fixture indexed successfully as `doc_017`, with clear completion text and explicit clearing of prior results/evaluations.
- Evaluation completion/failure denominators are unusually clear. All-failed does not present zero unauthorized results as a success claim.

## Actual coverage

| Area | Status | Scope and limits |
| --- | --- | --- |
| First visit without guide | Observed | New tab, welcome dismissed, initial purpose/actions recorded before source inspection. |
| PE scenarios/policies | Observed, partial matrix | Analyst Permission Wall Query; VP financial-model Query and three-policy Compare; Partner freshness/IC+LP Compare. All three policy outputs inspected. Did not execute every example/mode combination. |
| SaaS scenarios/policies | Observed, partial matrix | On-call question via Query/Ask; Employee Outage postmortem; Manager Hiring plan; Exec Roadmap three-policy Compare; Employee Salary bands three-policy Compare. The Stale Runbook scenario button itself was not separately clicked. |
| Roles and identity | Observed | Guest roles; Julia, Victoria, Patricia, Sofía, Marcos, Alex sign-in; representative permitted queries; sign-out; invalid credentials; workspace change signs out. UI permission boundaries checked, no API penetration test. |
| Evidence | Observed | Single-query source expansion, trace outcomes, full Documents text, Compare previews, Ask citation focus. JSON export buttons inspected, downloads not executed. |
| Stale result handling | Observed | Query text, role, workspace, policy and native budget change. k listener verified in source after budget investigation; k not independently changed in UI. In-flight race matrix not tested. |
| Guide | Observed, partial action coverage | All six text steps; Back/Next/Skip/reopen/Restart/Finish; Enter and Escape; draft/result retention; desktop and mobile. Did not invoke every step’s embedded action or complete an exhaustive Tab-order audit. |
| Documents | Observed | Signed-in Analyst 6/16 accessible; full extracted text; no-match filter and recovery. Loading/error injection not tested. |
| Evaluations | Observed | PE success, transient loading, partial failure and all failure; denominators and action availability. Custom no-evaluation fixture not reached. |
| Audit | Observed | Admin scope, execution table and Parameters and decisions. Refresh control present; empty/error states not tested. |
| Upload | Observed | Admin form, no-file validation, allowed DOCX selection, indexing state, success. Duplicate/bad-file/server-error recovery not tested. |
| Ask | Observed | Disabled and enabled states, deterministic success, citation focus/invalid indicator, provider failure, wrong-operation retry, 100-token prompt-cap/no-context response. No real provider calls. |
| Responsive/themes | Observed | Default about 1265×712; explicit 1440×900, 768×1024, 375×812. Light and dark desktop/mobile inspected. No horizontal overflow in measured 375px comparison. No full contrast/zoom/screen-reader audit. |
| Empty fixture | Partial | `empty-test` landing showed 0/0 docs and a bare “Try a scenario” heading. Query/Documents/Audit empty states were not reached before browser loss; this is not reported as a confirmed production defect. |
| Restricted/private fixtures | Blocked/not tested | Browser unavailable after user interruption. No claims about their behavior. |

## Control inventory

| Control family | Recommendation | User task served |
| --- | --- | --- |
| Question field + primary run | Keep; clarify outcome label | Start the evidence-retrieval experiment. |
| Ask AI | Keep when available; clarify “Generate answer”; contextual unavailable state | Turn selected evidence into an answer, then verify citations. |
| Role and policy controls | Keep close to the question | Change the experiment’s access/selection assumptions. Explain simulated vs authenticated roles. |
| Retrieval settings, k, budget | Keep collapsed; use understandable labels | Advanced control over candidate/context limits. |
| Examples + scenario Run/Compare + standalone comparison example | Combine into one scenario entry system | Give a novice a meaningful question and expected observation without duplicate choices. |
| Query/Compare navigation | Combine around the same question/result or make a clearer primary/secondary relationship | Inspect one selection, then compare policies without relearning entry points. |
| Documents | Keep accessible, add direct source links from results | Understand the corpus and inspect evidence. |
| Evaluations/Audit/Upload navigation | Move into secondary tools; Upload remains permission-aware | Validate the system, inspect history, and administer a corpus after understanding the core demo. |
| Decision Trace | Keep; make the main outcome visible before expansion | Explain included/blocked/excluded fragments. |
| Ranking/freshness details | Keep secondary to source reading | Explain score mechanics when the user needs them. |
| Comparison source action | Add in context | Read the evidence at the moment of comparison. |
| Export JSON | Keep as quiet contextual action or overflow item | Preserve a technical record; not a novice’s next step. |
| Guide Exit / Skip / Restart | Combine duplicate dismissal; hide Restart at step 1 | Leave/resume learning without three similar escape/reset choices. Keep Back/Next and contextual demonstration actions. |
| Evaluation rerun | Add after incomplete/failed runs | Recover from temporary benchmark failures. |
| Demo account cards | Keep | Quickly demonstrate enforced access. Avoid “requires lower role” phrasing for fixed-role scenarios. |
| Theme toggle, sign-in/out, workspace | Keep compact | Change presentation, identity and corpus. |

## Evidence and environment limits

Saved and inspected screenshots:

1. [Restricted Analyst landing](01-analyst-disabled-controls.jpg)
2. [Successful fictional DOCX upload](02-upload-success.jpg)
3. [Partial evaluation failure](03-evaluation-partial.jpg)
4. [SaaS landing with Ask enabled](04-saas-entry-enabled-ask.jpg)
5. [Citation focuses its source](05-citation-source.jpg)
6. [Ask retry becomes context-only Query](06-ask-retry-became-query.jpg)
7. [Tablet comparison](07-tablet-comparison.jpg)
8. [Mobile comparison start](08-mobile-comparison-top.jpg)
9. [Mobile comparison evidence without policy context](09-mobile-comparison-scrolled.jpg)
10. [Mobile guide](10-mobile-guide.jpg)
11. [Desktop comparison evidence without policy headings or source action](11-desktop-comparison-evidence.jpg)

Earlier screenshots were inspected inline before a supported saving technique was established. Later captures were saved from CUA screenshot bytes using Node file I/O. The initial note’s uncertainty about saving was resolved; the files above exist. One navigation call reported a transient target-navigation error, after which the assigned tab was successfully observed on `empty-test`.

Viewport dimensions above are the requested overrides. The CUA JPEG exports sometimes have smaller raster dimensions: desktop captures are 1440×900 or 1425×891, tablet 753×1004, and mobile 360×780. The mobile DOM measurement returned `innerWidth: 375`, body/document scroll width 360. I did not infer a product sizing defect from the capture-size difference.

After the user interruption, browser 3 became unavailable; creating a fresh internal-browser tab also returned unavailable. I did not touch user tabs or switch to an unrelated browser. Remaining probes were stopped and marked above. The last explicit viewport was 1440×900; its override could not be reset after browser loss. No paid Ask calls, outside messages, commits, merges or deployments occurred. Source reads were limited to verifying observed retry/comparison behavior and the rejected budget hypothesis. The fake-provider controls were reset with `{}` at the end. The one authorized fictional upload remains in the isolated 8038 corpus.

## Three most valuable changes and merge decision

1. **Make Ask retry repeat Ask.** Preserve operation identity and executed inputs through the error state.
2. **Give the demonstration one obvious start.** Consolidate scenarios/examples, show the question and expected policy contrast, and make retrieval versus answer generation explicit.
3. **Make comparison lead directly to evidence.** Add source reading and retain policy context; use a compact outcome comparison on narrow screens.

**Do not merge this candidate as a finished usability redesign yet.** F1 is a concrete recovery defect. F2–F4 are the central product-clarity acceptance gaps for the stated objective, rather than cosmetic preferences. The existing permission summaries, source/trace content, guide behavior and honest evaluation accounting provide a strong base; the remaining work should simplify the path through them.
