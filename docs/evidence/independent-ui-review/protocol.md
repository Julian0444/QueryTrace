# Independent UI review protocol

Candidate: `97530876c3eb7ac7e447e90c5aca35c14ecf1895` (2026-10-25).

The owner suspects unnecessary buttons and competing UI elements obscure what the product is trying to demonstrate. Independently use the live app as a new visitor before reading implementation, old reports or the other reviewer's output. Record your initial understanding of the product, your expected next action and what competes for your attention. Then assess whether the main story—question, evidence, policy decisions—is clear and convincing. Functional correctness alone does not establish readiness.

## Method

Use a separate browser tab/context and only your assigned test server. Actually navigate, click, type, inspect screenshots and test the application; a source-only review or existing passing tests is insufficient. Source inspection may support a finding after observing it. Do not modify product code, shared settings or the other reviewer's files. Do not read credentials, unrelated tabs, other projects or private data. Do not send external messages, push, merge, deploy, install software, or spawn additional agents. Write only your own review and evidence directory. Do not read the other review until your report is complete.

Record the actual model and harness, viewports, dates, environment limitations and coverage. Label each finding `observed bug` or `design judgment`. Do not invent a quota of findings. Include severity, user impact, exact steps, observed versus expected result, and evidence. Screenshots must be inspected and saved when the available browser tool supports saving them. If unsupported, say so and retain the tool observation/reference; do not pretend a file exists. Distinguish blockers from optional preferences. Identify controls to keep, combine, move into context, or remove, explaining the user task each serves. End with the three most valuable changes and an explicit merge recommendation.

## Coverage

1. Initial visit without the guide; primary purpose and next step; Query versus Ask; visual hierarchy, copy and action density.
2. Both built-in workspaces and their example scenarios. Compare roles and all three policies; inspect evidence, full text, policy trace and comparison. Verify changed query/role/workspace/policy/budget cannot misrepresent stale results.
3. Guide: start, next/back, skip, reopen/restart, finish, keyboard and scroll behavior; retain drafts/results sensibly.
4. Documents, Evaluations, Audit and Upload: purpose and placement, empty/loading/error/success states, validation and recovery. Test an existing fictional document fixture only.
5. Anonymous session and demo sign-ins for low/middle/high roles in both workspaces, sign-out, invalid login and permission boundaries. Login discovery and role labels should make sense.
6. Ask disabled/enabled, deterministic answer/citations, provider failure/retry and limited context. Do not spend on a real provider.
7. Desktop, tablet and narrow mobile (target widths 1440, 1024 or 768, and 375 when tools support it), light/dark, keyboard focus, overflow, sticky elements and modals. Report unavailable checks honestly.
8. Check empty and restricted test fixtures only as state probes. Extra test workspaces, intentional simulated answer text and injected failure messages are fixture facts, not production defects by themselves.

## Isolated fixtures

The server uses real application retrieval, policy, auth, ingestion, evaluation and frontend code with copied fictional corpora. Only the paid answer provider is stubbed. Ports have independent server state.

- Astra: `http://localhost:8038/app/`
- Opus: `http://127.0.0.1:8039/app/`
- PE identities: `julia` / `demo-analyst`, `victoria` / `demo-vp`, `patricia` / `demo-admin`.
- SaaS identities: `sofia` / `demo-employee`, `marcos` / `demo-manager`, `alex` / `demo-admin`.
- PE question: What is Meridian's ARR growth rate and net revenue retention?
- SaaS question: What is the current on-call escalation process and database failover procedure?
- Safe upload: `tests/browser/fixtures/meridian-table.docx` in the candidate worktree. Only the isolated corpus may be changed.
- Additional fixture workspaces: custom-no-evals, restricted-test, empty-test, private-test. Private fixture logins: private-reader or private-admin / local-test-password.

A POST to your server's `/__test/control` is allowed for test setup. `{}` resets fake Ask state and disables the fake provider; `{"enabled":true}` enables it; `{"enabled":true,"provider_error":true}` injects a provider error; `{"enabled":true,"context_cap":100}` limits context. `{"evaluation_failure":"partial"}` or `{"evaluation_failure":"all"}` injects evaluation faults. Use the browser for product actions; these setup calls are the only exception. GET `/__test/state` inspects the fake provider calls. No private credential profile or real provider should be loaded.

## Deliverables

Write `report.md` in your assigned reviewer directory, with a coverage table (observed, not tested or blocked), prioritized findings, a control inventory, screenshot references and readiness verdict. Keep first-impression notes distinct from subsequent exploration. Send a brief progress message when you have substantive findings. Be candid about limitations and disconfirm your strongest hypotheses before reporting them.
