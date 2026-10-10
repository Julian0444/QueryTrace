# Pre-implementation design mapping

Base: e9ca89f, clean prior visual revision. Recorded before frontend edits.
Reference: https://www.madethis.com/. Taste submission
`fe514b33-d2f0-4351-86b1-cb289446ab57`, completed 2026-10-10T02:30:47.169803Z,
full (`sections: null`), fresh (`cache_hit: false`). Official quickstart,
submissions, design-system, MCP, brand-adherence and skills documentation was
read on 2026-10-09 (America/Los_Angeles), using official `.md` representations
when the web reader could not open the page. No authenticated Taste MCP was
exposed; HTTP API used, credentials read only from the private environment.

## Reference → working tool

| Verified observation | QueryTrace component | Concrete change |
|---|---|---|
| Cream #FCFBF7, white inputs, charcoal #2B2627, body #373532, warm gray #4D4841; Taste and computed CSS agree | Entire UI | Retain verified palette; simplify surface hierarchy so white is used for input and reading surfaces, sand for secondary controls |
| Inria Serif 400 headings (20/24px secondary scale), Inter 14/16px UI/body | Query, results, secondary screens | Remove promotional headline; use a small task title, 20px document titles and tabular numbers; preserve local OFL fonts |
| One dominant central input, separated primary and secondary actions | Query form | Move question above the fold, group Run and Ask, make their distinct effects explicit in one short line |
| Small radii (observed 1px login, 2px signup), restrained outline actions, 150ms color transitions | Buttons, navigation, disclosures | One charcoal primary action, quiet text tabs, accessible stronger control outlines; remove redundant card framing |
| Clear horizontal alignment and equal-width comparison groups | Compare | Keep three columns from 1024px upward; align headers, metrics, disclosures, traces, and document starts via subgrid |
| Sparse outlined SVG arrows; no need for pictorial controls everywhere | Identity, actions and brand | Original query-route symbol; original consistent 24px/1.75 stroke control icons, no borrowed logo or emoji |
| Cream/white sections with breathing room | Documents, Evaluations, Audit, Upload, login | Compact titles; flat data rows; concise introductions; explanations in accessible details; error and permission outcomes remain visible |

Taste's `layout.ascii_template` and several `sections` descriptions incorrectly
mention NoteApp, an orange logo and unrelated copy. Its `navigation.tabs: null`
also omits the business tabs visibly present in CUA. These inferred descriptions
are retained verbatim as evidence but rejected as implementation inputs. The
live Agency tab is green #D2E2C4 with a 0px button radius; its contour is a separate
SVG. The reference login has rounder third-party authentication controls. We
follow the site's main action system, not that embedded login widget. No forced
second extraction is needed to resolve these discrepancies: live CSS and
screenshots establish the relevant values.

Dark mode, data tables, dense tool layout, semantic status colors, stronger focus
and input contrast are QueryTrace adaptations. The reference has no dark tool
or auditable result tables to copy. No hero, sidebar, floating illustrations,
marketing sections, runtime Taste dependency or external verifier/tunnel.

## Copy inventory

| Content | Decision |
|---|---|
| Product eyebrow, large promise, introduction, repeated empty-state explanation and final hint | Remove; Guide covers purpose and sequence |
| Guest vs authenticated identity; simulated document role | Consolidate in header, retain explicit Guest / Signed in / Simulated wording |
| Classification banner | Short fictional-corpus note next to the question heading |
| Role access count | Keep as short count; role examples available in Guide step 2 |
| Selected policy paragraph | Move to Retrieval settings; unsafe-baseline warning stays visible when selected |
| Run vs Ask instructions | Shorten to one line; disabled provider remains explained |
| Scenario hint paragraphs | Move to optional scenario details; retain title, role, both actions and disabled reasons |
| Result source permissions repeated in every card | Show once as result outcome; unsafe baseline warning remains visible |
| Candidates, formulas, scoring caveats | Accessible methodology disclosures, preserved text and counts |
| Compare policy descriptions and baseline windows | Short header descriptions; exact windows in a disclosure in each column |
| Ask model/tokens and citation limitation | Keep concise usage and citation caution; prompt trimming details in disclosure; trimming outcome stays visible |
| Upload storage/OCR limitations | Brief persistent persistence warning with detailed extraction/storage disclosure |
| Evaluation completion/failure/denominators | Always visible; definitions in per-metric disclosures |

Baseline raw measurement: **183 whitespace tokens**, input top **400.8px**, at
1440×1000, guest Analyst, PE, Full Policy, Ask configured. `before/copy.json`
lists every counted block. The final lexical recount removes punctuation, the role name and access-count data: **173 instructional words**. Count all initial working-view instructions including
below the fold, excluding names, labels, action labels and actual documents.
Do not count disclosure contents as visible; keep necessary warnings visible.

## Baseline use

CUA: new arrival, dismiss/reopen/restart/complete Guide, scenario loaded,
comparison executed, Full Policy trace expanded, results retained; real query,
source expansion, zero budget, no evidence, Documents and extracted text,
Evaluations, Audit, Julia limited session, logout and workspace change.
Existing browser suite: 50/50 passed, including temporary-corpus real upload,
prior-draft restoration and all Guide contracts. Visual sweep: 80 states passed.
No paid Ask call yet. Baseline screenshots and copy measurement are saved.
