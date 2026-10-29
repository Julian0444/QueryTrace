# First impressions — before source or other reviews

Date: 2026-10-25. Model: GPT-6 Astra, independent reviewer. Candidate supplied: 97530876c3eb7ac7e447e90c5aca35c14ecf1895. Assigned server: http://localhost:8038/app/.

Entered a new CUA in-app-browser tab and chose “Explore on my own” from the welcome dialog. Default screenshot was 1265 × 712. No product source or previous reviews read.

- My initial understanding: this is a fictional enterprise-document search laboratory that shows how role and policy affect retrieval. The welcome sentence says “question, permissions and the decision trace”; the persistent main screen does not plainly state the experiment or desired learning outcome.
- Expected next action: run the Analyst “Permission Wall” scenario, because I do not yet know what questions the corpus can answer. However, the largest control is an empty question box, with the actual scenario question hidden behind “About this scenario.”
- Attention competitors: six navigation items; the main Run query / disabled Ask AI pair; role and policy selectors; Retrieval settings; two Examples links; a separate “Compare / Stale detection” link; and three scenario cards, each with Run query, Compare policies, and About. The visual style is quiet and orderly, but the choice architecture still asks me to distinguish several similar entry points.
- Query vs Ask: “Run: context only · Ask unavailable: no provider” suggests Query returns excerpts while Ask generates an answer. This is inferable technical copy rather than a plain explanation of the two user outcomes. The disabled Ask control advertises unavailable functionality before the visitor has seen the core demonstration.
- Positive first impression: the question box has clear keyboard focus, role selection says how many documents are visible, and the three policy names expose the experiment without hiding it behind a settings panel.

Initial screenshot inspected in CUA tool output under “Inspect initial page without guide.” The documented screenshot API returns bytes and has no save-path argument; screenshot persistence will be reported honestly if a supported save mechanism is unavailable.

Later tooling note: screenshot saving was established using the returned bytes and Node file I/O. The final report lists the saved screenshots; the initial screenshot itself remains an inline tool observation. This note does not alter the first-impression judgments above.
