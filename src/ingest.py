"""
ingest.py — document ingestion pipeline for QueryTrace.

Exposes format extractors plus the orchestrator `ingest_document()`:
- extract_text(file_bytes, filename) -> str   (dispatcher: .pdf/.txt/.md/.docx)
- extract_text_from_pdf(file_bytes) -> str
- generate_next_doc_id(metadata_path) -> str
- sanitize_filename(title) -> str
- compute_content_hash(text) -> str
- ingest_document(file_bytes, title, date, min_role, doc_type, sensitivity,
                  tags, superseded_by=None, workspace=None,
                  filename="upload.pdf") -> dict

Every upload is verified against its file signature (magic bytes) before
extraction — a lying extension (PDF bytes named .txt, text named .docx) is a
415, not a parser crash. Extracted text is content-hashed (sha256 over
whitespace-collapsed, lowercased text) and stored as `content_hash` in the
metadata entry; re-uploading identical content into the same workspace is a
409 pointing at the existing doc_id.

Writes extracted text as a .txt file under corpora/<slug>/documents/
(matching the indexer contract), appends an entry to the workspace's
metadata.json, and triggers a full FAISS + BM25 rebuild for that workspace
via src.indexer.build_and_save(workspace).

Valid min_role / doc_type values are workspace-defined (roles.json and the
manifest's doc_types) — there are no hardcoded corpus vocabularies here.
Sensitivity is a corpus-independent enum.

A reentrant process/file lock and recovery journal coordinate readers and
writers so failed publication restores metadata, document and all indices.
"""

import hashlib
import io
import json
import os
import re
import uuid
from dataclasses import replace
from datetime import datetime
from typing import Iterable, Optional

import pdfplumber

from src import indexer
from src.storage import corpus_lock, corpus_transaction
from src.workspaces import Workspace, get_workspace, invalidate_workspace_cache

VALID_SENSITIVITY = frozenset({"low", "medium", "high", "confidential"})

SUPPORTED_EXTENSIONS = (".pdf", ".txt", ".md", ".docx")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Backwards-compat alias (pre-Fase-3 name, when only PDFs were accepted).
MAX_PDF_BYTES = MAX_UPLOAD_BYTES
MIN_EXTRACTED_CHARS = 50
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_PDF_SIGNATURE = b"%PDF-"
_ZIP_SIGNATURE = b"PK\x03\x04"


class IngestError(ValueError):
    """Raised when ingest input is invalid or extraction fails."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract concatenated page text from a PDF byte stream.

    Returns whitespace-joined text across pages. Raises IngestError on
    unreadable PDFs or when extracted content is shorter than
    MIN_EXTRACTED_CHARS (scanned/image-only PDFs typically yield nothing).
    """
    if not file_bytes:
        raise IngestError("Uploaded file is empty.", status_code=400)
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as e:
        raise IngestError(f"Unreadable PDF: {e}", status_code=422) from e

    text = "\n\n".join(p.strip() for p in pages if p and p.strip())
    if len(text) < MIN_EXTRACTED_CHARS:
        raise IngestError(
            "No extractable text in PDF (scanned/image-only PDFs are not supported).",
            status_code=422,
        )
    return text


def _decode_text_bytes(file_bytes: bytes) -> str:
    """Decode plain-text bytes: UTF-8 first, latin-1 as a lossless fallback."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1")


_FRONTMATTER_RE = re.compile(r"\A---\s*\n.*?\n---\s*\n", re.DOTALL)


def extract_text_from_txt(file_bytes: bytes) -> str:
    return _decode_text_bytes(file_bytes)


def extract_text_from_md(file_bytes: bytes) -> str:
    """Markdown is treated as plain text, minus a leading YAML frontmatter block."""
    return _FRONTMATTER_RE.sub("", _decode_text_bytes(file_bytes))


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract paragraphs, nested tables, headers and footers in document order.

    Unsupported rich objects are rejected rather than silently discarded.
    """
    import docx  # local import: lxml is heavy and only .docx uploads pay for it

    try:
        document = docx.Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise IngestError(f"Unreadable .docx file: {e}", status_code=422) from e
    from docx.oxml.ns import qn

    # These elements can contain substantive content outside supported text.
    unsupported = {
        "drawing": "images/charts",
        "pict": "images/text boxes",
        "txbxContent": "text boxes",
        "altChunk": "embedded documents",
        "footnoteReference": "footnotes",
        "endnoteReference": "endnotes",
        "object": "embedded objects",
        "del": "tracked deletions",
        "ins": "tracked insertions",
        "oMath": "equations",
    }
    parts = [document.part] + [
        r.target_part
        for r in document.part.rels.values()
        if not r.is_external and ("header" in r.reltype or "footer" in r.reltype)
    ]
    for part in parts:
        root = part.element
        for tag, label in unsupported.items():
            namespace = "m" if tag == "oMath" else "w"
            if any(True for _ in root.iter(qn(f"{namespace}:{tag}"))):
                raise IngestError(
                    f"DOCX contains unsupported {label}. Export a text-complete PDF or remove these elements before upload.",
                    status_code=422,
                )

    def blocks(container):
        for block in container.iter_inner_content():
            if isinstance(block, docx.text.paragraph.Paragraph):
                if block.text.strip():
                    yield block.text.strip()
            else:
                for row in block.rows:
                    cells, seen = [], set()
                    for cell in row.cells:
                        if cell._tc in seen:
                            continue
                        seen.add(cell._tc)
                        cells.append(" / ".join(blocks(cell)))
                    yield " | ".join(cells)

    sections = []
    seen_parts = set()
    for section in document.sections:
        for header in (section.header, section.first_page_header, section.even_page_header):
            if header.part.partname not in seen_parts:
                seen_parts.add(header.part.partname)
                sections.extend(blocks(header))
    sections.extend(blocks(document))
    for section in document.sections:
        for footer in (section.footer, section.first_page_footer, section.even_page_footer):
            if footer.part.partname not in seen_parts:
                seen_parts.add(footer.part.partname)
                sections.extend(blocks(footer))
    return "\n\n".join(sections)


def _extension(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def check_magic_bytes(file_bytes: bytes, extension: str) -> None:
    """Verify the file signature matches the declared extension.

    The content-type header and the extension are both caller-controlled; the
    first bytes of the payload are not. Mismatch → 415.
    """
    if extension == ".pdf":
        # The PDF header must appear near the start (spec tolerates a small
        # amount of leading junk; 1024 bytes is the conventional window).
        if _PDF_SIGNATURE not in file_bytes[:1024]:
            raise IngestError(
                "File does not look like a PDF (missing %PDF- signature).",
                status_code=415,
            )
    elif extension == ".docx":
        if not file_bytes.startswith(_ZIP_SIGNATURE):
            raise IngestError(
                "File does not look like a .docx (missing ZIP signature).",
                status_code=415,
            )
    elif extension in (".txt", ".md"):
        head = file_bytes[:1024]
        if b"\x00" in head or head.startswith(_PDF_SIGNATURE) or head.startswith(_ZIP_SIGNATURE):
            raise IngestError(
                f"File does not look like plain text (binary content in a {extension} upload).",
                status_code=415,
            )


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Dispatch extraction on the file extension after a magic-bytes check.

    Supported: .pdf (pdfplumber), .txt (UTF-8/latin-1), .md (frontmatter
    stripped), .docx (python-docx). Unsupported extension → 415; signature
    mismatch → 415; unreadable/too-short content → 422.
    """
    if not file_bytes:
        raise IngestError("Uploaded file is empty.", status_code=400)
    ext = _extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise IngestError(
            f"Unsupported file type {ext or '(none)'!r}; "
            f"expected one of {', '.join(SUPPORTED_EXTENSIONS)}.",
            status_code=415,
        )
    check_magic_bytes(file_bytes, ext)
    if ext == ".pdf":
        text = extract_text_from_pdf(file_bytes)
    elif ext == ".txt":
        text = extract_text_from_txt(file_bytes)
    elif ext == ".md":
        text = extract_text_from_md(file_bytes)
    else:
        text = extract_text_from_docx(file_bytes)
    text = text.strip()
    if len(text) < MIN_EXTRACTED_CHARS:
        raise IngestError(
            f"Not enough extractable text (need at least {MIN_EXTRACTED_CHARS} characters).",
            status_code=422,
        )
    return text


def compute_content_hash(text: str) -> str:
    """sha256 over whitespace-collapsed, lowercased text.

    Normalization makes the dedup robust to layout-only differences (the same
    document re-exported with different line wrapping hashes identically).
    """
    normalized = " ".join(text.split()).lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _next_doc_id(metadata: dict) -> str:
    """Return the next doc_NNN id given a loaded metadata dict."""
    max_n = 0
    for entry in metadata.get("documents", []):
        m = re.match(r"doc_(\d+)$", entry.get("id", ""))
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f"doc_{max_n + 1:03d}"


def generate_next_doc_id(metadata_path: Optional[str] = None) -> str:
    """Return the next doc_NNN id based on the current metadata file."""
    if metadata_path is None:
        metadata_path = get_workspace().metadata_path
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    return _next_doc_id(metadata)


def sanitize_filename(title: str) -> str:
    """Produce a safe base filename (no extension) from a user title.

    Lowercase alphanumerics and underscores only, collapsing runs of other
    characters to a single underscore, trimmed to 60 chars. Falls back to
    'document' if the result is empty. Guarantees no path separators or
    traversal sequences.
    """
    s = (title or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = s.strip("_")[:60]
    return s or "document"


def _validate_inputs(
    title: str,
    date: str,
    min_role: str,
    doc_type: str,
    sensitivity: str,
    valid_roles: Optional[Iterable[str]] = None,
    valid_doc_types: Optional[Iterable[str]] = None,
) -> None:
    """Validate ingest form fields against a workspace's vocabularies.

    valid_roles / valid_doc_types default to the default workspace's
    (roles.json keys and the manifest's doc_types).
    """
    if valid_roles is None:
        valid_roles = get_workspace().roles.keys()
    if valid_doc_types is None:
        valid_doc_types = get_workspace().manifest.get("doc_types", [])
    valid_roles = sorted(valid_roles)
    valid_doc_types = sorted(valid_doc_types)
    if not title or not title.strip():
        raise IngestError("title must not be empty.")
    if not DATE_RE.match(date or ""):
        raise IngestError("date must be in YYYY-MM-DD format.")
    # The regex only checks shape — "2024-99-99" would pass, get written to
    # metadata.json, and permanently 500 every freshness-scored /query.
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise IngestError(
            "date must be a real calendar date (e.g. 2024-02-29 is valid, 2024-99-99 is not)."
        )
    if min_role not in valid_roles:
        raise IngestError(f"min_role must be one of {valid_roles}.")
    if doc_type not in valid_doc_types:
        raise IngestError(f"doc_type must be one of {valid_doc_types}.")
    if sensitivity not in VALID_SENSITIVITY:
        raise IngestError(f"sensitivity must be one of {sorted(VALID_SENSITIVITY)}.")


def _unique_filename(base: str, doc_id: str, directory: str) -> str:
    """Return a filename that does not already exist in `directory`.

    Appends the doc_id when the plain base collides.
    """
    candidate = f"{base}.txt"
    if not os.path.exists(os.path.join(directory, candidate)):
        return candidate
    return f"{base}_{doc_id}.txt"


def _check_duplicate(metadata: dict, content_hash: str) -> None:
    """Raise 409 if identical content already exists in this metadata.

    Idempotency: identical content (post-normalization) in the same workspace
    is a conflict, not a new document. Pre-Fase-3 entries have no
    content_hash and never match.
    """
    for existing in metadata.get("documents", []):
        if existing.get("content_hash") == content_hash:
            raise IngestError(
                f"Duplicate content: identical to existing document "
                f"{existing.get('id')} ({existing.get('title', 'untitled')!r}).",
                status_code=409,
            )


def prepare_ingest(
    file_bytes: bytes,
    title: str,
    date: str,
    min_role: str,
    doc_type: str,
    sensitivity: str,
    tags: list,
    superseded_by: Optional[str] = None,
    workspace: Optional[Workspace] = None,
    metadata_path: Optional[str] = None,
    corpus_dir: Optional[str] = None,
    filename: str = "upload.pdf",
) -> dict:
    """Synchronous half of the ingest: validate, extract, hash, dedup-check.

    Everything that should fail the HTTP request immediately (400/409/413/
    415/422) happens here, before any state is mutated. Returns a `prepared`
    dict that finalize_ingest() consumes (possibly on a worker thread).
    """
    if workspace is None:
        workspace = get_workspace()
    if metadata_path is None:
        metadata_path = workspace.metadata_path
    if corpus_dir is None:
        corpus_dir = workspace.documents_dir
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise IngestError(
            f"File exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB size limit.",
            status_code=413,
        )
    _validate_inputs(
        title,
        date,
        min_role,
        doc_type,
        sensitivity,
        valid_roles=workspace.roles.keys(),
        valid_doc_types=workspace.manifest.get("doc_types", []),
    )
    if not isinstance(tags, list):
        raise IngestError("tags must be a list of strings.")
    clean_tags = [t.strip() for t in tags if isinstance(t, str) and t.strip()]

    text = extract_text(file_bytes, filename)
    content_hash = compute_content_hash(text)

    # Early dedup so the uploader gets the 409 on the request itself, not
    # buried in a failed job. finalize_ingest re-checks under the lock (the
    # authoritative check) in case a concurrent job landed the same content
    # between this read and the job's turn on the worker.
    with corpus_lock(os.path.dirname(os.path.abspath(metadata_path))):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        _check_duplicate(metadata, content_hash)

    return {
        "workspace_slug": workspace.slug,
        "workspace_root": workspace.root,
        "artifacts_dir": workspace.artifacts_dir,
        "metadata_path": metadata_path,
        "corpus_dir": corpus_dir,
        "text": text,
        "content_hash": content_hash,
        "title": title,
        "date": date,
        "min_role": min_role,
        "doc_type": doc_type,
        "sensitivity": sensitivity,
        "tags": clean_tags,
        "superseded_by": superseded_by,
    }


def finalize_ingest(prepared: dict, on_stage=None) -> dict:
    """Heavy half of the ingest: persist + reindex, with rollback on failure.

    Runs under the module lock (serialized with any other writer). `on_stage`
    (if given) is called with 'embedding' / 'indexing' as the reindex
    progresses — the job store hooks in here.

    If anything fails after the .txt / metadata entry landed on disk, both are
    rolled back so no orphan document survives a failed job, then the error
    re-raises.
    """
    metadata_path = prepared["metadata_path"]
    corpus_dir = prepared["corpus_dir"]
    text = prepared["text"]

    # Explicit paths remain supported for isolated CLI/test callers.
    base_ws = get_workspace(prepared["workspace_slug"])
    root = os.path.dirname(os.path.abspath(metadata_path))
    artifacts_dir = prepared.get("artifacts_dir", base_ws.artifacts_dir)
    if root != os.path.abspath(base_ws.root):
        artifacts_dir = os.path.join(root, "artifacts")
    with corpus_lock(root):
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        _check_duplicate(metadata, prepared["content_hash"])
        doc_id = _next_doc_id(metadata)
        file_name = _unique_filename(sanitize_filename(prepared["title"]), doc_id, corpus_dir)
        doc_path = os.path.join(corpus_dir, file_name)
        entry = {
            "id": doc_id,
            "file_name": file_name,
            "title": prepared["title"].strip(),
            "type": prepared["doc_type"],
            "date": prepared["date"],
            "min_role": prepared["min_role"],
            "sensitivity": prepared["sensitivity"],
            "superseded_by": prepared["superseded_by"],
            "tags": prepared["tags"],
            "short_summary": text[:200].strip(),
            "content_hash": prepared["content_hash"],
        }
        ws = replace(
            base_ws,
            root=root,
            metadata_path=metadata_path,
            documents_dir=corpus_dir,
            artifacts_dir=artifacts_dir,
            index_path=os.path.join(artifacts_dir, "querytrace.index"),
            index_docs_path=os.path.join(artifacts_dir, "index_documents.json"),
            bm25_path=os.path.join(artifacts_dir, "bm25_corpus.json"),
            metadata=metadata,
        )
        try:
            with corpus_transaction(
                root, [metadata_path, doc_path, ws.index_path, ws.index_docs_path, ws.bm25_path]
            ):
                os.makedirs(corpus_dir, exist_ok=True)
                with open(doc_path, "w") as f:
                    f.write(text)
                metadata.setdefault("documents", []).append(entry)
                metadata["corpus_revision"] = uuid.uuid4().hex
                indexer._atomic_write_json(metadata_path, metadata, indent=2)
                indexer.add_document(ws, entry, text, on_stage=on_stage)
        finally:
            # Both rollback and commit invalidate while still holding the lock.
            invalidate_workspace_cache(prepared["workspace_slug"])
            from src.retriever import invalidate_caches
            from src.ask import invalidate_cache

            invalidate_caches(prepared["workspace_slug"])
            invalidate_cache(prepared["workspace_slug"])

    return entry


def ingest_document(
    file_bytes: bytes,
    title: str,
    date: str,
    min_role: str,
    doc_type: str,
    sensitivity: str,
    tags: list,
    superseded_by: Optional[str] = None,
    workspace: Optional[Workspace] = None,
    metadata_path: Optional[str] = None,
    corpus_dir: Optional[str] = None,
    filename: str = "upload.pdf",
    on_stage=None,
) -> dict:
    """Extract, persist, and reindex a new document in one workspace.

    Synchronous composition of prepare_ingest() + finalize_ingest() — the
    single-call path used by tests and the bring-your-own-corpus CLI. The
    HTTP endpoint calls the two halves separately (prepare in the request,
    finalize on the job worker).

    Returns the metadata entry that was appended. Raises IngestError on
    validation failure, signature/extraction failure, or duplicate content
    (409, detail names the existing doc_id).
    """
    prepared = prepare_ingest(
        file_bytes,
        title,
        date,
        min_role,
        doc_type,
        sensitivity,
        tags,
        superseded_by=superseded_by,
        workspace=workspace,
        metadata_path=metadata_path,
        corpus_dir=corpus_dir,
        filename=filename,
    )
    return finalize_ingest(prepared, on_stage=on_stage)
