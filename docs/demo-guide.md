# Present QueryTrace in five minutes

Run the application using the [README](../README.md), then open `/app/`. No answer-provider key is needed. The built-in Guide can be started, skipped, reopened or reset. All organizations, source documents and public accounts in the two bundled workspaces are fictional.

1. **Purpose and workspace.** Explain: “QueryTrace shows which source fragments a query can use, and the decision behind every inclusion or exclusion.” Start in Atlas Capital's PE deal room. Open Documents to inspect source text, minimum roles, dates and explicit replacement links. Change workspaces to show that Nimbus has its own roles, accounts, documents and evaluations.
2. **Identity and permissions.** As a guest, point out the laboratory and simulated-role labels. Sign in as `julia / demo-analyst` for enforced Analyst access. Her role is fixed by the server; inaccessible scenarios explain the required role and tools are disabled with a reason. Sign out and use `patricia / demo-admin` for administrative tools. Patricia's identity remains visible when she simulates Analyst; simulation does not change the logged-in identity.
3. **Query.** Use a configured example or ask “What is Meridian's ARR growth rate and net revenue retention?” Press Run. Show the executed query, final document/fragment/token counts and included text. Edit the input without running to demonstrate that the old result remains explicitly tied to its executed query. Run retrieves context; no generated answer exists yet.
4. **Compare and trace.** In guest laboratory mode or as Patricia, select Analyst and run Compare. Inspect top-k without filters, Permissions Only and Full Policy. The top-k baseline is k fragments, whereas filtered policies select up to k documents from 6 × k candidate fragments. Explain unauthorized inclusion counts and measured token differences without assuming every query saves tokens. Open Decision Trace: a fragment has a final outcome and reason, while a document may be partially included.
5. **Versions and budget.** Use the workspace's versions/freshness scenario. Point out the fixed corpus reference date, `superseded_by`, penalized candidates and actual final context. A penalized old candidate may later be excluded for budget. In Retrieval settings, set token budget to 0 and run: context becomes empty while the explanatory trace remains. Restore 2048 afterward. A clearly unrelated query should show insufficient evidence, not a confidence of 1.00.
6. **Evaluation and optional tools.** Open Evaluations: show completion/failure denominators and per-query results. Export JSON. Open Audit to inspect workspace, identity, effective role and parameters of interactive runs. Upload is available to an administrator when ingestion is enabled; use a throwaway corpus for a live upload. Ask remains visibly disabled without a provider. With an explicitly configured provider, an Ask click may incur charges and displays the sent context, additional prompt trimming, provider usage and mechanical citation checks.

For Nimbus, use `sofia / demo-employee`, `marcos / demo-manager` and `alex / demo-admin`. “What is the current on-call escalation process and database failover procedure?” is a useful starting question. Accounts shown by the live interface come from the current workspace; this guide is only a presentation aid.

## Present the limitations honestly

- An unsafe baseline is a laboratory comparison, not a supported way for a restricted authenticated user to bypass permissions.
- RRF scores are relative rank; the semantic evidence gate is a heuristic, not proof of relevance or factual correctness.
- A valid citation means its identifier belongs to sent context. It does not prove that a claim follows from that source.
- Evaluations describe their configured fixture queries. No “Certified” or general production-safety claim is made.
- Demo authentication, local file storage, in-process jobs/audit/rate limits and optional paid Ask remain explicit project boundaries.
- The automated Ask demonstration uses a deterministic provider. It is not evidence of a real Anthropic integration.

## Evidence to review

See the [remediation matrix](remediation-plan.md), [benchmark comparison](evaluation.md) and saved browser captures under [evidence/after](evidence/after). The browser regression suite performs interactions; screenshots complement those tests rather than substitute for them.

To reset the guide use **Guide → Restart guide**. To replay the initial welcome in a fresh browser profile, visit the app with no `qt_tutorial_v1` storage entry. Skipping or completing it persists across reloads.
