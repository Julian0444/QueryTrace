# Uploads and corpus recovery

Upload requires an authenticated administrator and `ALLOW_INGEST=true` (the local default). A document role such as partner does not by itself confer administrative permission. Select the workspace before signing in. Upload accepts document title, date, minimum role, document type, sensitivity and tags; these are caller-supplied classifications, not inferred security labels.

The HTTP API returns `202` and a job ID. Poll `/ingest/jobs/<id>` or watch Upload until **Indexed**. A successful publication refreshes workspace counts, Documents, results and evaluation state in the frontend. Ask and evaluation caches use the new corpus version. A job failure is not a successful partial upload.

## Supported extraction

| Format | Preserved text | Limits |
|---|---|---|
| TXT | Decoded text | Must contain usable text |
| Markdown | Plain text, removing leading YAML frontmatter | Markdown is not executed |
| PDF | Extractable page text | No OCR; scanned/image-only PDFs are rejected; visual layout is not preserved |
| DOCX | Body paragraphs and tables in order, nested cell text, headers before body and footers after body | Headers/footers are deduplicated by part; not reconstructed page by page |

DOCX tables use row/cell separators to retain a reasonable reading order. Unsupported substantive objects—including images/charts, text boxes, footnotes/endnotes, embedded objects/documents, tracked changes and equations—produce an actionable `422` error instead of silently claiming complete extraction. Export a text-complete source or remove unsupported material intentionally. Extraction is about text, not faithful document layout.

Uploads are validated for filename extension, content signature, size, minimum text length, metadata and duplicate extracted content. All accepted formats become plain corpus text and use the same chunking/indexing pipeline. Check the endpoint schema at `/docs` for the current request fields and limits.

## Publication and recovery

Source text, metadata, FAISS, BM25 and chunk payloads are coordinated under a per-workspace lock and recoverable journal. Readers see the previous complete corpus or the new complete corpus. Injected publication failures restore the prior bytes; the next load recovers a journal left by an interrupted process. Retrying a failed upload succeeds without duplicate IDs or dangling index references.

Do not delete `.querytrace-transaction*` directories during recovery or edit indices while the application runs. They are internal transaction state. Use the API or CLI, which acquires the same locks. Keep a normal backup for operator error or disk loss; rollback is not a backup strategy.

## Directory import

```bash
python -m src.workspace create my-kb \
  --from-dir /absolute/path/to/files \
  --name "My knowledge base"
```

The CLI recursively finds supported files and applies the same extraction, deduplication and publication checks. It reports each ingested or skipped file. Default roles are viewer/editor/admin; imported documents start at the lowest rank and take their source file's modification date. Supply `--roles /absolute/path/to/roles.json` to define ranks. Review classifications and the temporal reference before presenting imported results.

No evaluation set, scenario or public account is required. Add those only when useful, using [configuration](configuration.md). A new custom workspace initially supports guest laboratory use; it is not private merely because it lacks demo accounts.
