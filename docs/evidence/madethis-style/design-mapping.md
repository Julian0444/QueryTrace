# MadeThis → QueryTrace visual mapping

Prepared before frontend edits, 2026-10-09. Reference: https://www.madethis.com/.
Source: live browser inspection, computed styles and screenshots in `reference/`.
This is **manual reference evidence, not a Taste extraction**.

| Reference trait | QueryTrace component | Observed value | Adaptation |
|---|---|---|---|
| Cream page, white reading surfaces | Page, results, forms, login, Guide | `#FCFBF7`, `#FFFFFF`; sand `#F2EFEB` | Keep all section positions and widths; sand only for supporting surfaces. |
| Warm ink hierarchy | Body, labels, titles, primary actions | Body `#373532`, warm gray `#4D4841`, charcoal `#2B2627` | A darker muted text token maintains readable small labels. |
| Light serif headings | Product title, document titles, Compare headings, Guide | Inria Serif 400, tracking −.02em; section titles 24px | Keep the existing responsive type scale; do not import the landing hero's 48px size. |
| Quiet sans-serif UI | Navigation, roles, query, tables, captions | Inter 400/500, 14–16px, tracking −.02em | Use 600 for meaningful emphasis; technical IDs/code retain system monospace. |
| Fine warm borders and square controls | Cards, buttons, inputs, table wrappers | `#E5E4DF`, stronger `#D6D3CF`; buttons 1px radius, pricing cards 2px | Strengthen input boundaries and focus for accessibility. No new framing or reordering. |
| Charcoal primary / outlined secondary | Run query, upload, Guide actions, Sign in | Charcoal/cream, sand hover on secondary; 150ms color transition | Preserve disabled/loading states, add an immediate visible keyboard ring; no decorative movement. |
| Pastel selected tabs | Role selection, policy selection, Compare policy headers | E-commerce blue `#DFEAF6`; Agency green `#D2E2C4` | Blue denotes selection/info; lighter green accompanies success. Rose/ochre status variants are QueryTrace adaptations, always labeled. |
| Sparse elevation | Login, welcome and Guide | Main content has no shadows; floating header/login have subtle elevation | Keep tables/results flat; reserve a restrained warm shadow for overlays. |
| Thin ruled sections | Summary, Documents, Audit, Evaluations | 1px separators | Preserve rows, columns, ordering, real data and existing breakpoints. |
| No observable dark-theme toggle | Entire dark UI | Reference includes charcoal sections, but no observed dark theme | Derive warm charcoal surfaces, cream text and accessible pastel statuses; explicitly our adaptation. |

The reference login uses a third-party authentication widget (Inter, 6px controls,
stronger shadows), unlike its 1px marketing actions. QueryTrace keeps its own
account chooser and uses the shared small-radius application system.

No logos, client imagery, decorative objects, marketing copy, statistics, landing
layout or reference dependencies are transferred. Fonts are self-hosted official
Google Fonts distributions with SIL Open Font License files. Taste is never a
runtime dependency.
