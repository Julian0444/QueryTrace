# QueryTrace — independent UI review (Opus)

| | |
|---|---|
| Candidate | `97530876c3eb7ac7e447e90c5aca35c14ecf1895` (branch `codex/querytrace-taste-redesign`) |
| Reviewer model | Claude Opus 5.5 (`claude-opus-5-5`) |
| Harness | Claude Code CLI agent (Claude Agent SDK) driving the **Playwright MCP** server: an isolated headless Chrome, separate from the user's personal browser. No Claude-in-Chrome extension, no subagents and no other model were used. Bash was not used. |
| Server | `http://127.0.0.1:8039/app/` (Opus fixture server only) |
| Date | 2026-10-25 local (browser audit timestamps 25/10/2026 ~20:48–21:06; Playwright artefact names are in UTC, 2026-10-26T03:48–04:06Z) |
| Viewports | 1440×900 (main), 1024×768, 768×1024, 375×812; light and dark themes |
| Product actions | Clicks, typing, keyboard and file upload, all through Playwright. Direct requests were limited to same-origin `POST /__test/control` (fixture setup) and `GET /__test/state` (fake-provider call log). |
| Other reviewer | Not read. This report was written before opening any other review. |

**Environment limitations.** The headless Chrome locale is Spanish, so native validation bubbles ("Selecciona un archivo"), the date picker (dd/mm/aaaa) and audit timestamps ("p.m.") are localized. That is environment, not product. Playwright also auto-saved accessibility snapshots, console logs and one exported JSON locally. The coordinator retained those raw artifacts outside the repository; this evidence directory contains the report and all 82 numbered screenshots. Full-page screenshots paint the sticky header mid-page (screenshot artefact, not a product bug). No screen reader, forced-colors or 200% zoom testing, and no browsers other than Chrome.

**State caveat.** At about 04:00Z I uploaded the allowed fixture `meridian-table.docx` as `doc_017` (min role VP) into the isolated PE corpus. Screenshots after `57-*` include it, for example as a Top-k leak in `68-*`, `71-*` and `82-*`. That is my test artefact, not a product defect.

---

## 1. First impression (before reading anything else)

Evidence: [01-first-visit-1440.png](01-first-visit-1440.png) (welcome modal), [02-first-visit-no-guide-1440.png](02-first-visit-no-guide-1440.png) (after "Explore on my own").

- **What I thought the product was.** A search box over a fictional deal room, plus role and policy switches. Only the modal tagline ("Follow the evidence") and the page title "Context Policy Lab" hint that the point is *which documents an AI assistant would be allowed to see, and why*. Once the modal closes, nothing on the page says that.
- **Expected next action.** Type a question or click an example, then press **Run query**.
- **Query vs Ask.** I could not tell the difference from the page. "Run query" and "Ask AI" both sound like "answer my question". The only explanation is a small right-aligned status line ("Run: context only · Ask unavailable: no provider") and a `title` tooltip. Ask was disabled with no visible reason near the button.
- **What competed for attention.** Before any result, the first screen offers about 20 actionable controls:
  - workspace select, Guide, theme, Sign in
  - 6 tabs, one of them disabled ("Upload")
  - Run query and a disabled Ask AI
  - 3 roles and 3 policies (Top-k and Permissions only rendered in **red and amber text**, which looks like warnings)
  - Retrieval settings
  - 2 examples and 1 "Compare" example
  - 3 scenario cards × (Run query + Compare policies + About disclosure)

  Examples and scenario cards are two overlapping sets of entry points. The coloured policy labels drew my eye more than the question box did.
- **Hierarchy.** The question box is clearly primary and the typography is calm. The weakness is the number of equal-weight underlined secondary links below it.

## 2. Is the main story (question → evidence → policy decisions) clear and convincing?

**Partly.** The strongest moment is in **Compare**: "Top-k includes 2 documents this role cannot access. Full Policy blocks them." ([16-compare-headline-viewport-1440.png](16-compare-headline-viewport-1440.png)). The default **Query** tab shows one policy at a time and buries the decisions:
- "10 documents blocked · 3 fragments excluded" appears as a grey line.
- The Decision Trace is collapsed.
- Under Top-k, restricted documents appear in the evidence list with no marker that this role should not see them ([13-analyst-topk-restricted-docs-unmarked-1440.png](13-analyst-topk-restricted-docs-unmarked-1440.png)).

The freshness/versions half of the story is not convincing. For the SaaS headline question, Full Policy produces **the same 6 documents** as Permissions Only, including the superseded On-Call Runbook v1 in full ([27-saas-employee-full-policy-1440.png](27-saas-employee-full-policy-1440.png), [29-saas-compare-employee-1440.png](29-saas-compare-employee-1440.png)).

The evidence cards show the *start* of each fragment rather than the passage that answers the question. The ARR answer (34.2% growth, 118% NRR in the 10-K) only appears after "Read source" ([08-read-source-10k-1440.png](08-read-source-10k-1440.png)). The first card is a press *rumor* article ([04-pe-query-viewport-1440.png](04-pe-query-viewport-1440.png)).

---

## 3. Coverage

| # | Area | Status | Notes / evidence |
|---|---|---|---|
| 1 | First visit without guide, Query vs Ask, hierarchy | Observed | 01, 02, 03, 04 |
| 2a | PE workspace: Analyst / VP / Partner × three policies, trace, methodology, Read source, ranking disclosure | Observed | 03–13 |
| 2b | SaaS workspace: Employee query, compare; Manager and Exec via sign-in | Observed | 26–29, 49–51 |
| 2c | Compare tab (PE and SaaS), compare trace | Observed | 14–18, 24, 29, 82 |
| 2d | Stale-result protection: role, policy, query text, k/budget, workspace | Observed | 10, 11, 19, 23; workspace switch resets |
| 2e | Every scenario card individually | **Partial** | Ran PE Permission Wall (Run and Compare), Diligence risks, Stale detection and SaaS Permission Wall (via guide). Other cards not clicked one by one. |
| 3 | Guide: start, next/back, skip, exit, Escape, reopen, finish, keyboard Tab/Enter, scroll, draft retention | Observed | 30–39, 79–81. The "Restart guide" link itself was not clicked (the Guide button already restarts). |
| 4a | Documents: list, filter, no-match, full text | Observed | 40–42 |
| 4b | Evaluations: complete, partial failure, all-failed, no-evals | Observed | 43–45, 74. Loading state too fast to observe. |
| 4c | Audit | Observed (guest only) | 46. Admin scope and cross-session visibility **not tested**. |
| 4d | Upload: disabled, validation, loading, success, list | Observed | 52–57. Unsupported-type and server-error uploads **not tested**. |
| 5 | Guest; julia, victoria, patricia, sofia, marcos, alex; invalid login; sign-out; private-reader | Observed | 47–54, 76–77. `private-admin` **not tested**. |
| 5b | Permission boundary | Observed at UI level | Authenticated traces show "Titles withheld by server"; Documents limited to role. No direct API probing (out of scope). |
| 6 | Ask: disabled, enabled, answer, citations, invalid citation, script-as-text, provider error, retry, context cap, stale answer | Observed | 58–66 |
| 7 | 1440 / 1024 / 768 / 375; light and dark; skip link; focus order; sticky header; modals | Observed | 67–72, 79–82. 1024 checked on Compare only. No assistive technology. |
| 8 | Fixture workspaces: empty-test, restricted-test, custom-no-evals, private-test | Observed | 73–77 |

---

## 4. Findings (most important first)

Severity scale: **P0** blocker · **P1** fix before merge · **P2** fix soon · **P3** polish. Each finding is labelled either *observed bug* or *design judgment*.

### F1 — P1 · design judgment — The policy story lives in Compare; the default Query view hides it
- **Impact.** A new visitor runs a question, sees a list of documents and a grey summary line, and does not learn why any document was blocked, penalized or leaked.
- **Repro.**
  1. PE workspace, guest Analyst, choose **Top-k · no filters**, ask "What is Meridian's ARR growth rate and net revenue retention?".
  2. VP-only "Project Clearwater Financial Model v1.0/v2.0" appear as ordinary cards.
  3. The trace says "0 fragments blocked by permissions".
  4. The header still says "Sees 6 of 16 docs".
- **Expected.** Each leaked card is flagged "would be blocked for Analyst". Compare *does* do this ("Included here · blocked by Full Policy").
- **Evidence.** [12-analyst-topk-1440.png](12-analyst-topk-1440.png), [13-analyst-topk-restricted-docs-unmarked-1440.png](13-analyst-topk-restricted-docs-unmarked-1440.png) versus [16-compare-headline-viewport-1440.png](16-compare-headline-viewport-1440.png).

### F2 — P1 · observed bug — Opening a Decision Trace in Compare overflows the page horizontally
- **Repro.**
  1. Compare tab, run any comparison.
  2. Click the Full Policy "Decision Trace" box. The guide's step 5 button "Open Full Policy decision trace" does the same.
- **Observed.**
  - `document.scrollWidth` becomes 1679px at a 1440px viewport, and 1402px at 1024px.
  - The Full Policy column widens to 682px and runs off-screen, clipping the "Reason and annotations" column and the column's metrics.
  - The other two columns' card lists drop below the long trace, leaving large empty gaps.
- **Expected.** The trace scrolls inside its column, or opens full-width below the three columns.
- **Evidence.** [17-compare-trace-click-1440.png](17-compare-trace-click-1440.png), [18-compare-trace-overflow-fullpage-1440.png](18-compare-trace-overflow-fullpage-1440.png), [37-guide-step5-trace-overflow-1440.png](37-guide-step5-trace-overflow-1440.png), [82-compare-trace-overflow-1024.png](82-compare-trace-overflow-1024.png).

### F3 — P1 · observed bug — After a failed Ask, "Try again" silently becomes a context-only Run
- **Repro.**
  1. Set the fixture to `{"enabled":true,"provider_error":true}`.
  2. Click **Ask AI**: "Request failed · Try again".
  3. Leave the error injected and click **Try again**.
- **Observed.**
  - The error disappears and the page shows "Context only · no answer generated".
  - `/__test/state` still records exactly **1** provider call, so the retry never called the provider.
  - Re-running with the fault cleared also gave context only.
- **Expected.** Try again repeats the Ask, or is labelled "Show context without an answer".
- **Evidence.** [63-ask-provider-error-1440.png](63-ask-provider-error-1440.png), [64-ask-after-try-again-1440.png](64-ask-after-try-again-1440.png), [65-try-again-downgrades-ask-to-run-1440.png](65-try-again-downgrades-ask-to-run-1440.png).

### F4 — P2 · design judgment — The freshness/versions half of the story doesn't land
- **Same documents under both policies.** For the SaaS headline question as Employee, Permissions Only and Full Policy include the identical 6 documents and fragments. The superseded "On-Call Runbook v1" is included 2/2 under Full Policy, only re-ordered. Unrelated docs (Performance Review Guide, Infosec endpoints) also fill the budget.
- **Stale detection example.** The PE "Stale detection →" example opens Compare with the headline "No permission difference in the selected Top-k context…". The headline does not mention versions, and it uses the **same red alarm styling** as the leak warning (`comparison-finding`, bg `rgb(246,233,230)`).
- **Disconfirmation attempt.** The methodology and guide step 5 do state that superseded sources are penalized, not excluded. So this is intended behaviour, not a bug. But the demo questions don't show the policy changing the outcome.
- **Evidence.** [27-saas-employee-full-policy-1440.png](27-saas-employee-full-policy-1440.png), [29-saas-compare-employee-1440.png](29-saas-compare-employee-1440.png), [24-stale-detection-compare-partner-1440.png](24-stale-detection-compare-partner-1440.png), [50-sofia-trace-titles-withheld-1440.png](50-sofia-trace-titles-withheld-1440.png) (Runbook v1 fragments included while current docs are cut for budget).

### F5 — P2 · design judgment (with one observed defect) — Evidence cards don't show the evidence
- **Not the matching passage.** Previews show the first ~300 characters of each fragment, not the matching passage. For the ARR/NRR question, the 10-K card shows "Business overview… headquartered in Austin". The answer (ARR +34.2%, NRR 118%) requires Read source.
- **Rumor ranked first.** The top card is "Fintech Market Wire — Meridian Rumored $500M Valuation", because freshness is weighted 50%.
- **Observed defect.** Previews cut mid-word with no ellipsis ("real-t", "value-creat", "The r", "Atlas ma").
- **Citations.** Clicking a citation chip jumps to the card but still shows the generic preview.
- **Evidence.** [03-pe-query-analyst-full-1440.png](03-pe-query-analyst-full-1440.png), [08-read-source-10k-1440.png](08-read-source-10k-1440.png), [61-citation-click-1440.png](61-citation-click-1440.png).

### F6 — P2 · observed bug — Query tab shows a "Running…" message forever after a Compare example
- **Repro.**
  1. Query tab, click the "Stale detection →" example. The app switches to Compare and runs it.
  2. Click the **Query** tab.
- **Observed.** The status reads "Scenario selected. Running its configured query and document role." It is still there after 4 seconds, nothing is busy, and the previous Query result is gone.
- **Evidence.** [25-query-tab-after-compare-example-1440.png](25-query-tab-after-compare-example-1440.png).

### F7 — P2 · design judgment — Signed-in non-admins get a page of dead controls
- **What a signed-in Employee, Manager or Analyst sees:**
  - Compare, Evaluations, Audit and Upload tabs are disabled. The reason is only a `title` tooltip.
  - Other roles are disabled, and the Policy control disappears.
  - Scenario cards show amber warnings plus disabled Run and Compare links.
- **Impact.** Real users lose the comparison that tells the story, and the screen fills with greyed controls.
- **Evidence.** [49-signed-in-sofia-1440.png](49-signed-in-sofia-1440.png).

### F8 — P2 · design judgment — A provider failure discards the retrieved evidence
- **Observed.** When Ask fails, only "Request failed / Deterministic test provider unavailable / Try again" remains. Retrieval succeeded, but the context is not shown.
- **Expected.** Show the context with "answer unavailable".
- **Evidence.** [63-ask-provider-error-1440.png](63-ask-provider-error-1440.png).

### F9 — P2 · design judgment — Guest "simulated role" messages contradict each other
- **Documents tab.** As "Guest · Simulated Employee", Documents lists "14 accessible documents of 14 … laboratory disclosure", and the Exec-only board deck text can be read. Meanwhile Query says "Sees 6 of 14 docs".
- **Top-k.** Under Top-k, "Sees 6 of 16 docs" stays visible while VP documents are in the context.
- **Not a security bug.** Authenticated sessions enforce correctly; see positives.
- **Evidence.** [40-documents-saas-employee-1440.png](40-documents-saas-employee-1440.png), [41-documents-guest-employee-reads-exec-doc-1440.png](41-documents-guest-employee-reads-exec-doc-1440.png).

### F10 — P3 · observed bugs and copy

| Item | Evidence |
|---|---|
| **Run** with an empty question does nothing, with no message. Focus stays on the button, and the stale banner keeps saying "press Run". | [28-empty-query-run-1440.png](28-empty-query-run-1440.png) |
| Stale handling is inconsistent: role/settings changes **clear** results, policy/query edits **dim** them. Dimming is partial: the "documents blocked" line and "Included documents" heading stay at full opacity. After Ask, the **answer panel is not dimmed**, and the banner says "press Run". | `10`, `11`, `19`, `23`, [62-ask-answer-after-policy-change-1440.png](62-ask-answer-after-policy-change-1440.png) |
| Pluralization errors: "1 documents blocked", "1 fragments blocked", "1 documents are partially included", "Top-k includes 1 document … blocks them". | `75`, `37`, `29` |
| "Hr Policy" (should be "HR Policy"); raw `not_called`; "evals.json"; "Updating FAISS + BM25 indexes…" | `27`, `66`, `74`, `56` |
| Context-cap result advises "adjust the query or budget, or use an authorized identity", but the cause was the prompt cap. | [66-ask-context-cap-1440.png](66-ask-context-cap-1440.png) |
| SaaS Upload form placeholders reference "Meridian". The label says "Date (YYYY-MM-DD)" while the picker shows the locale format. | [52-upload-admin-saas-1440.png](52-upload-admin-saas-1440.png) |
| Compare content column jumps left and wider: Query input x=144, w=1152 → Compare x=24, w=1392, not aligned with the nav at x=80. | [14-compare-tab-initial-1440.png](14-compare-tab-initial-1440.png) |
| Empty workspace shows an orphan "Try a scenario" heading with nothing under it, and the PE placeholder text. | [73-empty-test-workspace-1440.png](73-empty-test-workspace-1440.png) |
| Evaluation benchmark table: the last column is hidden behind an inner horizontal scroll at 1440 when the error text is long. | [44-evaluations-partial-failure-1440.png](44-evaluations-partial-failure-1440.png) |

### F11 — P3 · observed accessibility and responsive issues

| Item | Evidence |
|---|---|
| **Skip tour** leaves focus on `<body>`. Exit, Escape and Finish correctly return focus to Guide. | `localStorage` check in session |
| Scenario cards: DOM/focus order is "About this scenario" (y=614) before "Run query" (y=568). | Tab test from "Stale detection →" |
| At 375px, the guide bottom sheet covers the **Run query** button that step 3 tells you to press (`elementFromPoint` hits the guide). Scrolling reveals it. | [80-mobile-375-guide-step3.png](80-mobile-375-guide-step3.png), `81-*` |
| At 375px, the trace table puts "Final outcome" and "Reason" off-screen behind horizontal scroll. The redundant `doc_id / doc_id#c01` column is visible first. | [70-mobile-375-trace.png](70-mobile-375-trace.png) |
| At 375px, the "Upload" tab wraps alone onto a second nav row. The header is 229px tall. | [69-mobile-375-initial.png](69-mobile-375-initial.png) |
| At desktop the guide panel is not sticky. After its own step-5 action, Next/Back scroll away (scrollY 886). | `37-*` |

### F12 — P3 · design judgment (secondary surfaces)
- **Guide controls.**
  - Exit, Skip tour, Finish and "Restart guide" all appear on the final step.
  - Reopening always restarts at step 1 even though progress is stored, so "Restart guide" is redundant.
  - Step 3 talks about "Run" while the page shows "Compare policies".
  - Positive: on exit the guide restores the user's pre-guide draft and comparison.
- **Examples and scenarios.**
  - Examples duplicate the scenarios.
  - Scenarios vanish after the first run and only return after a reload or workspace switch.
  - "Diligence risks" silently switches role Analyst → VP.
  - Scenario takeaways are hidden behind "About this scenario" and are vague ("Inspect…").
- **Hidden fourth policy.** "Query baseline: Whole corpus · no filters" is a radio inside Retrieval settings. "k" means fragments for Top-k but documents for policy runs ([21-whole-corpus-baseline-1440.png](21-whole-corpus-baseline-1440.png)).
- **Compare metrics.** Six metrics per column (18 numbers), including "latency proxy". Three "Selection limits" disclosures say nearly the same thing.
- **Evaluations.**
  - Only Full Policy is benchmarked, so there is no Top-k baseline to show the leak rate the product prevents.
  - Precision@5 is capped at 0.20 when one document is expected, so "0.25" reads as poor.
  - No retry after a failed evaluation (reload only).
  - The unavailable state repeats itself three times.
- **Upload.** Defaults to the least restrictive access (lowest role, sensitivity "low"; type `board_deck` / `board_memo`). Options show raw enum values (`53`, `55`).
- **Audit / workspace.** Audit lists oldest first, shows the raw id `saas-internal`, and writes 3 rows per Compare. Switching workspace while signed in signs the user out silently; only the guide mentions it.

### Positives (verified, not just assumed)
- **Stale results.** Changing role, workspace, retrieval settings, policy or query text never left a result that claimed to match the new controls. It either cleared the result or showed a stale banner (F10 notes the inconsistency).
- **Permission boundary.** Signed-in Julia and Sofía see only their role's documents, and traces show "Titles withheld by server · N documents · requires vp, partner" (`50-*`).
- **Answer rendering.** The answer's `<script>` is rendered as text (`window.unsafeAnswer` undefined). The invalid citation `doc_999999` is struck through and labelled. A cached repeat Ask is disclosed ("cached response, no new model call").
- **Evaluation states.** Partial and all-failed evaluations are honest: "Incomplete 11/12", metrics withheld when nothing completed, failures visible per row.
- **Upload.** Clear loading and success states ("Indexed doc_017 … Previous results and evaluations have been cleared"); the uploaded document appears in Documents with its role.
- **Other states.** Invalid login, empty corpus, restricted corpus and no-match filter states are clear. Dark mode is coherent. The skip link appears on focus.

---

## 5. Control inventory

| Control | User task it serves | Recommendation |
|---|---|---|
| Workspace select | Switch fictional corpus | **Keep**. Hide test fixtures in production (fixture fact). |
| Guide button | Learn the product | **Keep**. Make reopen resume; remove "Restart guide". |
| Guide: Exit / Skip tour / Finish / Restart guide / Back / Next / step action | Navigate tutorial | **Combine**: Back · Next/Finish · one "Close". Remove Skip tour and Restart guide. |
| Theme toggle | Preference | Keep (low prominence) |
| Guest status + Sign in / Sign out | Identity | Keep. Add a notice when a workspace switch signs you out. |
| Tabs: Query / Compare | Main demo | **Combine**: make the three-policy diff the default result of a question, with single-policy detail as a drill-down. Or at least put the Compare headline on Query. |
| Tabs: Documents | Browse corpus | Keep |
| Tabs: Evaluations | Benchmark credibility | Keep, but secondary. Add a Top-k baseline. |
| Tabs: Audit | Ops record | **Move** to a secondary/admin area |
| Tabs: Upload | Admin ingestion | **Hide** unless the user is an admin (no disabled tab) |
| Run query / Ask AI | Retrieve context / generate answer | Keep both. Rename for intent ("Show context" / "Generate answer"). Hide Ask when no provider instead of disabling it plus a status line. |
| "Run: context only · Ask unavailable…" line | Explain Run vs Ask | **Remove**. Fold into the button labels or helper text. |
| Document role segmented control | Core permission lever | Keep. When signed in, show only the effective role (no disabled options). |
| Policy segmented control (Query) | Pick one policy | **Move** into the comparison (or keep with neutral colours). Red and amber labels compete with the question. |
| Retrieval settings (k, budget, Whole-corpus radio) | Expert tuning | Keep collapsed. **Remove** the hidden Whole-corpus radio, or make it a Compare baseline. |
| Examples row (2 + 1 compare) | Quick start | **Combine** with scenario cards into one set of 3. |
| Scenario cards (Run + Compare + About ×3) | Guided demos | **Combine** into one action per card ("See what each policy sends"). Show the takeaway inline and drop the About disclosure. |
| Export JSON (Query, Compare, Evaluations, Audit) | Reproducibility | Keep, but move into an overflow/"Download" menu |
| Decision Trace | Core explanation | Keep. Open by default for blocked, excluded and penalized rows. Fix the Compare overflow (F2). |
| Methodology & evidence check | Rigor | Keep collapsed |
| Read source / Collapse source | Full text | Keep. Preview the matched passage. |
| Ranking, freshness & tags (per card) | Score detail | Keep collapsed |
| Compare: 6 metrics × 3, Selection limits × 3, How counts work | Quantify difference | **Reduce** to included / unauthorized / penalized. Remove latency proxy. One shared "Selection limits". |
| Citation chips | Jump to source | Keep. Highlight the cited passage. |
| Documents filter | Find a document | Keep |
| Evaluation per-metric "Definition" ×11, Run provenance | Interpret metrics | Keep |
| Audit Refresh | Update log | Keep (in the admin area) |
| Sign-in demo cards, credential form, Continue as guest | Pick identity | Keep. Align role vocabulary (cards say "Clearance I/II/III", the app says Employee/Manager/Exec). |

---

## 6. Three most valuable changes

1. **Put the policy decision on the first result.** When someone asks a question or picks a scenario, lead with one sentence:

   > "Top-k would send 2 VP-only documents to the model; Full Policy blocks them; 1 superseded memo is penalized."

   Follow it with the three-way diff. Flag leaked cards inline. Merge Examples and Scenarios into three cards with visible takeaways, and remove the competing coloured policy toggle and status lines from the first screen (F1, F4, F12).
2. **Make the evidence and the freshness claim visible.**
   - Preview the matched passage (ARR +34.2%, NRR 118%) instead of fragment openings.
   - Choose demo questions where Full Policy actually changes the outcome versus Permissions Only.
   - Fix the "Stale detection" headline so it summarizes version decisions instead of permissions, and stop using red for "no difference" (F4, F5).
3. **Fix the main-path state and layout bugs, and remove dead controls.** Compare trace overflow (F2), Try again downgrading Ask to Run (F3), stuck "Running…" message (F6), empty-Run no-op and pluralization (F10). Hide unavailable tabs, roles and actions for signed-in users instead of greying them out (F7).

## 7. Merge recommendation

**Hold — request changes before merge.**
- **No P0.** Permission boundaries held for authenticated users, injected HTML was inert, failure states are honest and nothing lost data.
- **Three P1s.**
  - F2 breaks the layout on the guide's own key step at desktop widths.
  - F3 makes retry do something other than what the user asked for.
  - F1: the product's central claim is only legible in a secondary tab, which confirms the owner's suspicion that competing controls obscure the story.
- **Path to merge.** Fixing F2, F3 and F6, plus a Compare-style headline on the Query result (the first change above), would make this mergeable. The P2/P3 items can follow.

## 8. Screenshot index (all in this directory)

| Range | Content |
|---|---|
| `01`–`02` | First visit |
| `03`–`13` | PE query, trace, roles, policies |
| `14`–`18` | Compare and its overflow |
| `19`–`25` | Stale states, settings, examples, stuck status |
| `26`–`29` | SaaS workspace |
| `30`–`39` | Guide |
| `40`–`42` | Documents |
| `43`–`45`, `74` | Evaluations |
| `46` | Audit |
| `47`–`54` | Sign-in and roles |
| `52`–`57` | Upload |
| `58`–`66` | Ask |
| `67`–`72` | Tablet, mobile, dark |
| `73`, `75`–`78` | Fixture workspaces |
| `79`–`81` | Mobile guide |
| `82` | 1024 Compare overflow |
