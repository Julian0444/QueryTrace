# Taste-backed QueryTrace redesign

Implemented from clean `e9ca89f` in the independent branch
`codex/querytrace-taste-redesign`. No policy, fixture, retrieval result or backend
contract was changed. No push, merge, deployment or public tunnel was used.
Local application: [http://localhost:8035/app/](http://localhost:8035/app/).

## What changed

The question and Run/Ask actions now lead the page. The header consolidates
identity and simulated role; the promotional introduction and duplicated
instructions are gone. Scenario explanations, ranking methodology, evaluation
formulas and prompt accounting remain in keyboard-accessible disclosures.
Permission failures, insufficient evidence, budget outcomes and unsafe baseline
inclusions stay visible. Results use flat reading rows; Compare keeps three
aligned columns from 1024px upward. Documents, Evaluations, Audit, Upload,
login, Guide and both themes share the same spacing and type system.

The original **Evidence route** SVG replaces the boxed QT mark in the header,
login and favicon. [Three studies](icon-studies.html) were inspected at 16, 24
and 32px in light and dark; the selected open query outline with a connected
endpoint remains recognizable at small sizes. Control icons share a 24px grid,
1.75px stroke, round joins and currentColor. All SVGs are authored locally;
Inter and Inria Serif remain locally hosted under their existing OFL licenses.

## Reference evidence

A real full Taste extraction of [MadeThis](https://www.madethis.com/) completed:

- Submission: `fe514b33-d2f0-4351-86b1-cb289446ab57`.
- Completed: `2026-10-10T02:30:47.169803Z`; `sections: null`; `cache_hit: false`.
- [Sanitized metadata](reference/submission.json).
- [Profile, colors and typography](reference/profile-colors-typography.json).
- [Surfaces, elevation and interactions](reference/surfaces-elevation-interactions.json).
- [Actions, navigation, data display and icons](reference/actions-navigation-data_display-icons.json).
- [Layout and sections](reference/layout-sections.json).
- [Pre-implementation mapping and rejected extraction errors](design-mapping.md).
- [Live computed styles](reference/computed-styles.json), [home](reference/home.jpg),
  [Agency section](reference/agency.jpg), [login/focus](reference/login-focus.jpg).

Official quickstart, submissions, design-system, MCP, brand-adherence and skills
documentation was read, using official `.md` pages when needed. The authenticated
MCP was not exposed in this session, so the HTTP API was used. The submission
search found no suitable prior result; one full extraction was requested. No
forced extraction, other brand or map request was made.

Cream `#FCFBF7`, charcoal `#2B2627`, body `#373532`, warm gray `#4D4841`,
Inria Serif 400, Inter, small main-action radii and 150ms transitions were
confirmed against the live reference. Dark mode, semantic status colors,
stronger focus/control contrast and tool/table layouts are our adaptations.
Taste's unrelated NoteApp text and inferred layout were not treated as facts.
No external adherence verifier ran: no public candidate URL was authorized.
There is no invented adherence score and no Taste dependency at runtime.

## Copy and composition measurement

| Same initial state: PE, guest Analyst, Full Policy, Ask configured, 1440×1000 | Before | After |
|---|---:|---:|
| Instructional words | 173 | 14 |
| Raw whitespace tokens in those blocks | 183 | 22 |
| Question input top | 400.8px | 184.1px |

The lexical count falls **91.9%** and the question moves **216.7px upward**.
[Before inventory](before/copy.json) and [after inventory](after/copy.json)
retain the exact visible blocks. Count all initial-view instructional prose,
including below the fold. Exclude control labels, scenario names, actual document
content, the role name and numeric access-count data; punctuation is not a word.
The earlier raw whitespace count included these tokens, so it is retained for
transparency. The same normalization was applied to both inventories. Necessary
warnings are not suppressed: selecting an unsafe baseline displays its warning.

## Comparable screenshots and visual assessment

Every pair uses the same viewport, theme, workspace and identity. Audit events naturally differ between runs; this pair compares the same scoped view, not identical history. Query
screens are empty; results/trace/Compare use “What is Meridian's ARR growth rate
and net revenue retention?”, guest Analyst. Upload is Patricia's admin account.
Both runs retain their complete 80-state manifests; only 13 representative pairs
are kept as images to avoid duplicate evidence.

| State | Before | After |
|---|---|---|
| Query 1440 light | [Before](before/query-1440-light.png) | [After](after/query-1440-light.png) |
| Query 375 light | [Before](before/query-375-light.png) | [After](after/query-375-light.png) |
| Query 375 dark | [Before](before/query-375-dark.png) | [After](after/query-375-dark.png) |
| Results 768 dark | [Before](before/results-768-dark.png) | [After](after/results-768-dark.png) |
| Compare 1024 light | [Before](before/compare-1024-light.png) | [After](after/compare-1024-light.png) |
| Compare 1440 dark | [Before](before/compare-1440-dark.png) | [After](after/compare-1440-dark.png) |
| Trace 1440 light | [Before](before/trace-1440-light.png) | [After](after/trace-1440-light.png) |
| Documents 1440 light | [Before](before/documents-1440-light.png) | [After](after/documents-1440-light.png) |
| Evaluations 1440 light | [Before](before/evals-1440-light.png) | [After](after/evals-1440-light.png) |
| Audit 1440 light | [Before](before/audit-1440-light.png) | [After](after/audit-1440-light.png) |
| Login 375 light | [Before](before/login-375-light.png) | [After](after/login-375-light.png) |
| Upload 375 dark | [Before](before/upload-375-dark.png) | [After](after/upload-375-dark.png) |
| Guide 375 light | [Before](before/guide-375-light.png) | [After](after/guide-375-light.png) |

Visual judgment: the first screen now prioritizes input and actions, with readable
secondary scenarios. Dense paragraphs no longer compete with data. Tabular metrics
align across policies; the warning about two unauthorized Top-k documents is
prominent. Source titles, fragment counts and policy outcomes have separate levels
of emphasis. The restrained cream/ink palette and serif/sans pairing are visibly
supported by the extraction; the tool remains recognizable and does not imitate a
marketing landing page. Dark mode preserves the same hierarchy. Mobile stacks the
controls and Compare, with internal horizontal scrolling for wide data tables.

Corrections made after inspecting rendered screenshots:

1. Removed an inherited border around scenario comparison links and kept usable
   hit areas. [First round](after/first-round-query.jpg) records the defect.
2. Shortened Ask's repeated prompt accounting and trace interpretation; full
   methodology remains expandable, while actual trimming and citation limitations
   remain visible.
3. Reduced Evaluations' introductory prose so completion and metrics lead.
4. Updated the keyboard test to traverse/open the new methodology disclosure
   before entering the scrollable decision table. The table-access contract stays.
5. Made the existing hover check await the CSS transition instead of sampling its
   first frame. Focus, hover and disabled-state behavior remain asserted.

## Human-style interaction and actual Ask

CUA was used before and after editing, with clicks, typing, source expansion,
Guide actions, login/logout, workspace switching and visible result inspection.
After: new arrival → skip/reopen/restart → load scenario → Run → Compare → open
Full Policy trace → finish retained three columns. A separate prior draft was
restored on exit. Budget zero showed `budget_exhausted` with an open trace;
an unrelated question showed `insufficient_evidence`. Julia's authenticated
Analyst role exposed six of sixteen documents. Evaluations completed 12/12;
Audit retained scoped executions. Workspace switching cleared old results.
CUA ran at the in-app browser's actual 1280×720 viewport; the four requested
breakpoints were exercised and captured by the real browser regression scripts.
The CUA viewport override did not change its reported inner dimensions.

The real DOCX upload used the temporary-copy test server on port 8037, with real
ingestion and indexing. It produced `doc_017`; [success](after/cua-upload.jpg) and
[extracted table](after/cua-upload-source.jpg) were read in Documents. Production
demo corpora were untouched. Baseline upload and prior-draft contracts were
covered by the existing 50-test browser suite before edits, and CUA repeated them
afterward. These are distinguished from baseline CUA actions in the mapping.

Haiku was invoked through the real Ask UI exactly once, followed by one cached
repeat. Model: `claude-haiku-4-5-20251001`; provider usage: **2637 input / 177
output tokens**; stop reason `end_turn`. The output cap was 600 and local context
budget 2048. The 2013-token context estimate is distinct from provider input
usage, which includes prompt framing, question and tokenizer differences.

[Verification](ask/verification.json), [actual SDK body and response](ask/provider-calls.json),
[UI export](ask/response.json), [cached UI export](ask/cached-response.json).
An ephemeral local observer recorded arguments immediately before the original
SDK `Messages.create` call; headers and keys were never recorded. The exported
eight fragments reconstruct exactly the six grouped document blocks sent.
All ten blocked document IDs were absent. Four citation IDs belonged to sent
context; clicking a citation navigated to its source. This is membership checking,
not proof that every generated claim is true. No paid calls occurred in tests,
screenshot sweeps or video recording. The total is below the authorized three.

## Validation and recording

See [commands and results](validation.md). Backend: **508 passed**; browser:
**50 passed**; four targeted checks repeated after the final evaluation copy edit.
Ruff, JavaScript/SVG syntax, file hashes, keyboard/focus, local fonts, accessibility,
empty outcomes and 80 visual states pass. Both themes and 375/768/1024/1440px were
checked. Compare has three distinct x positions at 1024/1440px. No unexpected
page/console errors or page overflow were recorded. Wide table regions remain
keyboard focusable. No external runtime request is needed.

The [58.88-second MP4](video/querytrace-demo.mp4), [GIF](video/preview.gif),
[local player](video/index.html) and [captions](video/captions.srt) were regenerated
with the existing scripts using real backend/UI actions. Full playback and
several exported checkpoints were reviewed. The original README YouTube link
is preserved. The video includes no paid model requests.

Limitations: no public deployment, external Taste adherence score, Docker rebuild
or broad generative benchmark is claimed. The pre-existing Starlette/httpx
DeprecationWarning remains. The reference's generated layout inaccuracies are
documented rather than silently accepted. These are local Chromium/CUA checks,
not a claim of exhaustive browser or assistive-technology coverage.
