# Claude independent browser review — guided tutorial

- Candidate: `736e0d100062a83440ae67a0051521d096067570` (worktree `querytrace-taste-redesign`, clean)
- Server: existing `tests/browser/server.py` at `http://localhost:8041/app/` (isolated temp corpus). No servers started or stopped. Provider stayed disabled; `/__test/control` was not called. No uploads, and no corpus or policy changes.
- Browsers:
  - T3 preview tab, incognito profile, own tab (`reuseExistingTab:false`), 1440×900 (`innerWidth`/`innerHeight` confirmed). Closed afterwards.
  - `preview_snapshot` timed out at 375×667 (the same failure root saw), so mobile and theme checks used headless Chromium via the worktree's `node_modules/playwright`, in fresh contexts (`isMobile`, `hasTouch`, DPR 2).
- Measured viewports: 1440×900, 375×667 and 390×844, each in light and dark (`prefers-color-scheme`).
- Prior review conclusions were not read before testing.

## Verdict
**No blocking defects found.** The guide runs real requests (`POST /query`, `/compare`). Each step is unlocked only by a successful result, and the summaries match the counts in the rendered trace. In my runs, the next action was always a single labeled primary button.

## Verified
- **Execution, not a click-through.** Step 1 → `/query` (6 docs · 8 fragments · 2013 tokens; 17 permission-blocked + 3 limit-excluded = 28 − 8, which matches "28 candidate fragments → 8 included"). Step 2 → `/compare` (Top-k 8 / Permissions 6 / Full 6, naming the 2 blocked Clearwater models). Step 3 opens the Full Policy trace and a bounded decision table (one included and one blocked row; the blocked row shows the title only, no content) plus the selected source. Step 4 rejects an unchanged or empty question with a validation message, and shows "Retrieving… / Waiting for the server" before the result. Step 5 summary is built from those results.
- **Exit, back, reopen and restart.** Exit or Escape restores a prior draft (query, VP role, Permissions-only policy and its rendered result). I exited during a delayed in-flight request (3 s client-side delay); the late response did not overwrite the restored work. Focus returns to the invoking control, or to Guide. Reopening resumes at the same step from memory. A page reload restarts at step 1, because results are not persisted by design.
- **Identity.** Guest mode shows "simulated role; no account is changed". Julia (Analyst) and Victoria (VP) show "Your signed-in identity stays unchanged" and "cannot run unfiltered comparisons". No `/compare` request was made, and blocked titles show as "Titles withheld by server". Role radios stay disabled. Login, logout and workspace switches reload the page, so the in-memory guide run cannot carry over between identities.
- **Empty, no-scenario and restricted workspaces.** These prompt for a question, run real requests, and report "This corpus is empty", "Relevant candidates were blocked by permissions" or "No selected source was available" without inventing evidence. The lab-disabled `private-test` workspace shows the login screen and no welcome dialog.
- **Mobile and themes.** All 5 steps completed at 375×667 and 390×844 in both themes. No horizontal overflow (`scrollWidth` equals the viewport width), no page or console errors. Focus moves to the step title or the result region each time. The welcome dialog fits inside the viewport, with a 16 px side inset.

## Non-blocking observations
1. When no comparison was run (Julia/Victoria), step 4 still says "The original comparison stays available." (`frontend/app.js:2321`).
2. Step 5 shows "Result received. Continue when you have read it." above the summary. The step 3 note "Decision and source opened below" also appears when there is no source.
3. Pluralization: "1 documents", and "blocks them" when only one document is blocked.
4. On mobile, after a result arrives, the Continue button is usually below the fold (for example at 689–731 px on a 667 px viewport). Focus lands on the result, so the user scrolls to reach it. Usable, but it costs an extra step.
5. "Restart guide" is 28 px tall and "Exit" is 36 px. Both meet WCAG 2.2 AA (24 px) but are under 44 px.
6. On desktop the guide panel switches between a centered 1152 px width (Query view) and full width (Compare view).

## Not tested
- Restoring a prior generated `/ask` answer and its retry button after exiting the guide. I skipped this to avoid calling `/__test/control`, which would reset shared state while root's session is active. That code in `closeTour` is only reformatted in this commit.
- Real screen readers, iOS Safari/WebKit, and partner/admin accounts.
