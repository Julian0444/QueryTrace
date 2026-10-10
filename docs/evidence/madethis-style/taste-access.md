# Taste access and reference provenance

Checked on 2026-10-09. No authenticated Taste MCP tools are available in this
session. No Taste credential is exposed in the environment and no Taste MCP
entry exists in the user configuration. Plugin discovery did not return Taste.
No extraction was submitted: there is no submission ID, `cache_hit`,
`completed_at`, credit charge or Taste-generated design system to report.
The observations in this directory come from the live reference browser.

## Configure outside the repository

Use the documented OAuth connection from a local terminal:

```sh
codex mcp add taste-engine --url https://mcp.tastelabs.com/mcp
```

Complete sign-in in the browser. Alternatively, provision
`TASTE_ENGINE_API_KEY` through a private environment/secret manager and connect
with `--bearer-token-env-var TASTE_ENGINE_API_KEY`. Do not put the key in project
files, terminal output or chat. MCP uses Bearer authentication; direct HTTP uses
`X-API-Key` at `https://api.tastelabs.com`.

After connecting, reuse a current completed MadeThis extraction if available.
Otherwise submit only `https://www.madethis.com/` with `force=false`, without
`sections` or `map`, poll until completed (stop on failure), and read the requested
sections in small groups. Check the original `completed_at` on cache hits. No
other brand search, subscription or credit purchase is needed for this scope.

The external adherence verifier was **not run**. No public candidate URL was
authorized, and no SSH tunnel or deployment was opened. Local functional tests,
accessibility checks and screenshots are the verification evidence; no visual
similarity score is claimed. QueryTrace has no Taste runtime dependency.

## Official documentation reviewed

The web reader could not open several pages; their official `.md` representations
were read successfully from the same documentation host.

- [Quickstart](https://docs.tastelabs.com/quickstart)
- [Submissions, asynchronous status and caching](https://docs.tastelabs.com/concepts/submissions)
- [Design-system sections](https://docs.tastelabs.com/concepts/design-system)
- [MCP and authentication](https://docs.tastelabs.com/ai-tools/mcp)
- [Brand adherence](https://docs.tastelabs.com/concepts/brand-adherence)
- [Agent skills](https://docs.tastelabs.com/ai-tools/skills)

No Taste skill was installed or allowed to alter the requested application
layout. The required local review and implementation continued without access.
