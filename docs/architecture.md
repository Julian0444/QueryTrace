# Architecture and result contracts

QueryTrace is a single FastAPI service serving a vanilla frontend at `/app/`. Corpus configuration lives in `corpora/<slug>/`; FAISS, chunk metadata and BM25 artifacts live in `artifacts/<slug>/`. It uses local MiniLM embeddings, lexical BM25, reciprocal rank fusion (RRF), document authorization, freshness and greedy budget selection. Ask is an optional final provider call.

## Selection pipeline

1. Resolve the workspace and effective identity. A signed session is bound to one workspace. Non-administrators use their authenticated role and full policy. Administrators may simulate roles no higher than their own document access. Unfiltered baselines, corpus-wide evaluations and full-trace audit require full document access; an administrative flag alone does not grant that access. Guest laboratory access is an explicit workspace capability.
2. Retrieve ranked **fragments**. `naive_top_k` retrieves at most k fragments; `whole_corpus` retrieves all indexed fragments. Filtered policies retrieve up to 6 × k fragments and select at most k unique documents. All three quantities are disclosed; k has different, explicitly named units.
3. Refresh permission/version metadata from the authoritative corpus metadata. Filter permissions using role access ranks, failing closed on unknown roles or documents.
4. For filtered policies, compare the maximum cosine similarity of permitted candidates with 0.25. If no candidate meets the threshold, return an `insufficient_evidence` trace. This query-level heuristic prevents obviously unrelated queries from receiving misleading context. It does not verify every included fragment or establish claim support.
5. Full policy scores freshness against the **latest document date in the active corpus**, using exponential decay with a 365-day half-life and a 0.5 multiplier for an explicitly superseded document. This stable fictional-corpus reference is not today's date. A newer document only replaces another when `superseded_by` says so; age alone is not replacement.
6. Pack permitted fragments by ranking/freshness score, recording token-budget and unique-document-limit exclusions separately. A superseded candidate can be penalized and then excluded; no old content is forced into the result.
7. Build the decision trace and execution envelope. The frontend renders the returned query and parameters, not the current unsent input.

`score` is a normalized **relative RRF rank** within a candidate set. It is not a probability, confidence level or absolute relevance measure. `semantic_similarity` is a separate embedding cosine value. The evidence threshold is a documented heuristic, with measured false-abstention trade-offs in [evaluation](evaluation.md).

## Accounting

Each selected item is a fragment with `doc_id`, `chunk_id`, content and a local `cl100k_base` token estimate. Parent-document cards sum fragment token counts. The terminal fragment invariant is:

```
retrieved_count = included_count + blocked_count + dropped_count
```

After Ask's additional prompt cap:

```
retrieved_count = included_count + blocked_count + dropped_count + prompt_excluded_count
```

`dropped_by_budget` is a backward-compatible field name. Its `reason` can be `token_budget`, `document_limit` or `insufficient_evidence`; do not infer the reason from the field name. `demoted_as_stale` annotates candidates and is **not** a terminal category.

`document_summaries` has one row per observed parent document, with included/dropped/blocked fragment counts, included tokens and `included`, `partial`, `excluded` or `blocked` status. A document can have included and excluded fragments. Legacy document counters for individual outcomes overlap; they must not be summed as an exclusive partition. Blocked identities are redacted for ordinary authenticated users; aggregate withheld counts remain.

A trace's `result_status` distinguishes `ok`, `empty_corpus`, `insufficient_evidence`, `blocked_by_permissions` and `budget_exhausted`. Service failures are HTTP errors, not successful empty retrievals. The UI preserves explanatory traces when context is empty.

Every response includes an execution envelope: workspace, corpus version, authenticated identity/role, effective role, simulation flag, policy, k, requested and effective budget. Identity, workspace and role changes clear existing UI results. Input-only edits label an existing result as belonging to the previously executed query.

## Ask and citations

Ask runs the same selection pipeline, then applies `ASK_MAX_CONTEXT_TOKENS` in selected order. It stops before the first fragment that would exceed the cap. The response distinguishes the initial selection from the actual context sent. Context, trace, citations and final token counts describe the sent fragments. Prompt exclusions remain inspectable. An empty final context does not call the provider.

Local token estimates count selected text and exclude prompt instructions, metadata wrappers and model-specific tokenization. Provider-reported input/output usage is a separate field; cached answers explicitly indicate that no new model call occurred.

Citation validation extracts each identifier inside individual and grouped brackets, including mixed valid/invalid groups. An identifier is valid only if it belongs to the sent context. This is **mechanical membership validation**, not semantic fact checking. Model output is rendered through a small escaped Markdown renderer; raw HTML remains text and links allow HTTP(S) only.

The bounded TTL cache key includes workspace, normalized query, role, policy, k, selection budget, corpus version and provider/prompt configuration. Cached responses retain the query originally executed and are redacted for the current authorized viewer. A successful upload changes the corpus version and invalidates workspace caches.

## Coherent corpus publication

Readers and writers share a per-workspace reentrant thread lock plus a POSIX file lock. A transaction records backups of every affected source/metadata/index artifact in a staged journal before mutating live files. All affected files are published under the lock. A commit marker distinguishes a finished publication from an interrupted one. Errors restore previous files; the next reader recovers an unfinished journal after a process interruption. Caches refresh with the published corpus generation.

The implementation is intentionally local and proportionate: no database, distributed queue or new service. Fault injection verifies rollback after metadata, FAISS, BM25 and payload publication, subsequent ingestion without duplicates, a killed subprocess, and readers waiting for a transaction. This does not claim a tested machine power-loss guarantee or safe mutation by unrelated programs bypassing the lock. Use the provided CLI/API for writes.

## Frontend and tutorial

Query, Compare, Documents, Evaluations, Audit and Upload share workspace and capability metadata from the backend. The five-step Guide starts with a configured compatible question (or a user question), then requires successful retrieval, same-input comparison, and opening a decision/source before completion. Restricted accounts explicitly omit unfiltered comparison. Own-question variation can be skipped explicitly. Counts and explanations come from the responses; the tutorial does not change corpus or selection rules.

The guide lives in document flow rather than covering mobile controls. Local storage (`qt_tutorial_v1`, payload version 2) stores only status and step, not results or source text. Paused runs resume in memory; after reload, evidence must be executed again. Prior drafts, settings, view and results are restored on exit, and in-flight responses are invalidated. Starting without prior work retains useful tutorial results. Resetting progress does not erase those results. Native focus, local trace scrolling, source readers and both themes are covered by browser checks.

## Deployment boundaries

- Demo authentication uses public sample passwords and signed cookies, not production identity management. Administrative capabilities and document roles are separate axes. `lab_enabled` must be reviewed before adding private data.
- Jobs, rate limits, audit and caches are process-local. Run one application worker for coherent operational history and limits. Local file locks coordinate corpus publication across processes, but they do not turn these other facilities into distributed services.
- Corpus storage requires a writable local POSIX filesystem. Windows-native file locking is not implemented. Multi-host filesystems and distributed deployment were not validated.
- Guest lab results deliberately expose unfiltered data for comparison. Ordinary session responses redact blocked document names by default.
- No OCR, semantic citation verification, production prompt-injection defense, identity federation or automatic policy classification is claimed.
- API and frontend use the same origin by default. Optional cross-origin configuration requires an explicit origin allowlist and compatible cookie hosting; arbitrary cross-site cookies are not enabled.
