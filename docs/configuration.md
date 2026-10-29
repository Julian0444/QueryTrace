# Configuration, accounts and local operation

## Supported local setup

Serve the frontend through FastAPI at `/app/`, on the same origin as the API. `localhost` and `127.0.0.1` both work, but are different cookie hosts: stay on one hostname for a session. The session cookie is HttpOnly, SameSite=Lax and Secure when the request uses HTTPS. A fixed signing secret preserves sessions across server restarts; without one the service generates a process-local secret and warns.

For a separate frontend development origin, set the `querytrace-api-base` HTML meta value to the API origin and explicitly allow the frontend origin in `QUERYTRACE_ALLOWED_ORIGINS`. Do not use a wildcard or expect cross-site cookies to work automatically. The verified mode is same-origin serving over local HTTP. HTTPS/proxy deployment and separate-origin hosting were not exercised in this remediation.

| Variable | Default / purpose |
|---|---|
| `QUERYTRACE_DEFAULT_WORKSPACE` | `pe-deal`; must resolve to a valid workspace at startup |
| `QUERYTRACE_SECRET_KEY` | Unset: temporary signing secret; set for stable sessions |
| `QUERYTRACE_ALLOWED_ORIGINS` | Empty: same-origin serving; optional comma-separated CORS allowlist |
| `ALLOW_INGEST` | `true` locally; false disables upload even for administrators |
| `BLOCKED_DISCLOSURE` | Workspace setting, normally `count`; ordinary sessions receive withheld counts instead of blocked names |
| `ANTHROPIC_API_KEY` | Unset: Ask disabled, retrieval remains available |
| `ASK_MODEL` | `claude-haiku-4-5`; configured provider model identifier |
| `ASK_MAX_TOKENS` | 600 output tokens |
| `ASK_MAX_CONTEXT_TOKENS` | 4,096 local context-text token estimate; additional to selection budget |
| `ASK_TEMPERATURE` | `0.2`; `none` omits the provider parameter |
| `ASK_TIMEOUT_SECONDS` | 30 |
| `ASK_MAX_PER_MINUTE` | 6 per client IP |
| `ASK_MAX_PER_MINUTE_GLOBAL` | 30 per process |
| `ASK_CACHE_TTL_SECONDS` | 3,600; maximum 256 cached responses |
| `FASTEMBED_CACHE_PATH`, `TIKTOKEN_CACHE_DIR` | Optional local model/tokenizer cache paths; use absolute paths |

These values are operator configuration. Do not expose secrets in frontend code, commits or screenshots. Live Ask can incur provider charges. The deterministic browser harness removes any exported provider key and replaces the model call.

## Workspace files

```
corpora/my-kb/
  workspace.json
  roles.json
  metadata.json
  documents/*.txt
  users.json          # optional
  evals.json          # optional
artifacts/my-kb/       # generated indices
```

`workspace.json` includes a display name, description and optional `doc_types`, `scenarios`, `example_queries`, `role_hints`, `blocked_disclosure`, `is_demo` and `lab_enabled`. A custom corpus may omit scenarios and users entirely. `is_demo: true` declares that accounts and content are public demonstration material. Only those workspaces, or users individually marked `public_demo: true`, publish account cards/password hints. Private account credentials are never returned by metadata endpoints.

**`lab_enabled` defaults to true for backward-compatible laboratory use.** Set it to false before using a private corpus and configure authenticated users. Guest requests to protected corpus endpoints are then rejected. Public workspace names and role/count metadata remain discoverable; this project does not implement confidential tenant discovery.

`roles.json` maps role keys to integer `access_rank` values. Higher ranks inherit lower-rank document access. `metadata.json` contains a `documents` array; each document requires a unique ID, existing plain text filename, known `min_role` and valid ISO date. `superseded_by` records explicit replacement, independent of age. Invalid defaults or malformed core configuration fail with actionable errors.

`users.json` contains a `users` array with `username`, `name`, `role`, `password_sha256` and `is_admin`. These are demonstration credentials; SHA-256 password storage is not an appropriate production password database. Private users can sign in through the username/password form without becoming public demo cards. Administrative permission controls tooling; it does not elevate a lower document role above its actual access rank. Corpus-wide comparisons, evaluations and audit require full documentary access as well as administrative permission. A restricted administrator can still upload and use governed queries within their role.

`evals.json` contains `queries`, each with `id`, `query`, `role` and `expected_doc_ids`. `forbidden_doc_ids` is optional historical annotation, never the authorization source. Missing evaluation configuration yields `unavailable`; an empty query set yields `not_run`. Neither prevents querying a valid corpus.

## Operational scope

Use one server worker. Audit, jobs, caches and rate limits are held in process memory and reset on restart. Corpus writes use POSIX file locks and a recovery journal on the same host. The application is not a multi-tenant identity provider or distributed storage service.

The Render blueprint selects `main`: repository history shows PR #4 (`404b53c`) merged the previous `feat/ToDeploy` branch, and `origin/HEAD` identifies main. This review does not push or deploy. After Docker became available, the container build, non-root runtime, configurable port, browser sessions, upload/restart persistence and offline retrieval were verified on Linux ARM64. [Docker commands, evidence and storage scope](docker-validation.md).
