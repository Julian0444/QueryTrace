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
- Browser regression tests use a deterministic provider. A separate [bounded real Haiku UI check](evidence/taste-redesign/ask/verification.json) records one request and a cached repeat; it does not establish general answer quality.

## Evidence to review

See the [remediation matrix](remediation-plan.md), [benchmark comparison](evaluation.md) and saved browser captures under [evidence/after](evidence/after). The browser regression suite performs interactions; screenshots complement those tests rather than substitute for them.

To reset the guide use **Guide → Restart guide**. To replay the initial welcome in a fresh browser profile, visit the app with no `qt_tutorial_v1` storage entry. Skipping or completing it persists across reloads.

## Recorded walkthrough

[Play the MP4](media/demo/querytrace-demo.mp4) · [Chapter player](media/demo/index.html) · [Timed transcript](media/demo/transcript.md) · [English SRT](media/demo/captions.srt) · [English WebVTT](media/demo/captions.vtt)

The current walkthrough is silent, with English captions in a dedicated band below the application. It follows one continuous session from a question to inspectable evidence, then compares policies and demonstrates an authenticated account. Opening and closing cards frame the story. The corpus, documents and accounts are fictional.

### Story and checkpoints

| Step | What the viewer sees | What this demonstrates |
|---|---|---|
| Question | Atlas Capital; Guest · Simulated Analyst; a typed Meridian question | The workspace, identity and task are explicit before execution. |
| Context | Six documents, eight fragments; 2,013 of 2,048 estimated tokens | Run retrieves context. It has not generated an answer. |
| Source | Expanded Form 10-K: 34.2% ARR growth, 118% net revenue retention | The underlying source text remains readable and inspectable. |
| Trace | Included, excluded and blocked fragments; a fragment requiring VP | Full Policy applies the chosen role. A document can be partially included. |
| Compare | Three policies; two unauthorized documents in Top-k; 2,390 versus 2,013 tokens | Baselines reveal different selection behavior. Their selection limits differ. |
| Export | Compare's JSON download | The exported object matches the actual comparison response. |
| Evaluations | 12 / 12 configured PE queries completed | The measured fixture benchmark has no Full Policy unauthorized returns. This is not a production guarantee. |
| Audit | Workspace, identity, role and policy in local execution records | Interactive runs leave inspectable records. In-process records reset on server restart. |
| Identity | Julia signs in; an authenticated Analyst query; six accessible documents out of 16 | The server enforces the account's role. Ten other documents are withheld. |
| Workspace and Guide | Sign out, switch to Nimbus, reopen Guide | Workspace switching clears earlier results and changes roles and corpus. |

Exact chapter times are supplied in [chapters.json](media/demo/chapters.json), the MP4 chapter metadata and the [transcript](media/demo/transcript.md). [Recording notes and validation](media/demo/README.md) distinguish observed behavior from broader product claims.

### Watch locally

From the repository root:

```bash
node tests/browser/serve-demo.cjs
```

Open [the chapter player](http://localhost:8036/). Chapter buttons seek and play; normal video controls support pause, scrubbing and fullscreen. Captions are embedded in the picture, so enabling the optional WebVTT track will show the same text again. The transcript is available for reading without playback. A standalone MP4 player also works; chapter support depends on the player.

Serve the directory over HTTP for chapter navigation. Opening `index.html` with a `file:` URL can prevent the browser from fetching `chapters.json`. The included server binds to loopback and supports HTTP byte ranges, which reliable MP4 seeking requires. If port 8036 is occupied, set `QUERYTRACE_VIDEO_PORT` and use the same port in the player/review URL. A generic static server without range support may play from the beginning but fail to seek.

### Reproduce the recording

Install the README's Python and browser dependencies first. FFmpeg must provide `libx264` and `drawtext`. The default fonts are macOS Arial and Arial Bold; on another platform set `QUERYTRACE_VIDEO_FONT` and `QUERYTRACE_VIDEO_TITLE_FONT` to installed font files.

Start the actual app from the checkout being recorded. A provider key is unnecessary:

```bash
# Terminal 1 — keep this running. The first query may download the local model.
ANTHROPIC_API_KEY='' python -m uvicorn src.main:app --host 127.0.0.1 --port 8035
```

In another terminal, from the same repository root:

```bash
# Fast rehearsal: real endpoints and assertions, without video or reading pauses.
QUERYTRACE_DEMO_REHEARSAL=1 \
  QUERYTRACE_VIDEO_OUTPUT_DIR=/tmp/querytrace-demo-rehearsal \
  node tests/browser/record-demo.cjs

# Record and encode. Use a new directory to preserve an earlier take.
FFMPEG=/absolute/path/to/ffmpeg node tests/browser/record-demo.cjs

# Derive a 25-second animated highlight reel from the final MP4.
FFMPEG=/absolute/path/to/ffmpeg node tests/browser/build-demo-preview.cjs
```

The defaults are `http://localhost:8035` and `docs/media/demo`. Override them with `QUERYTRACE_SMOKE_BASE_URL` and `QUERYTRACE_VIDEO_OUTPUT_DIR` on each command when needed. Encoding also creates the cover, SRT, WebVTT, chapter metadata, transcript and `demo-run.json`. The repository includes the standalone player; if recording to another directory, copy `index.html` there before serving it.

The recorder opens a fresh browser profile, skips the welcome, selects the PE workspace and uses light mode. It captures a 1600 × 800 browser viewport, scales that view to 1920 × 960, then adds a 120-pixel caption band to produce a 1920 × 1080 H.264/yuv420p MP4 at 25 fps. Reduced motion is enabled. The application images, policies and responses are not composited or modified. The opening/closing cards and caption band are editorial additions.

It compares five served frontend asset hashes with the checkout, asserts successful real API responses and verifies the downloaded JSON. Captions use measured response values where counts or tokens appear. A route guard aborts `/ask` and `/ingest`; the recording fails if either is attempted. All workflow responses come from the actual backend. No fixture, policy or threshold is changed, and the user's browser profile is untouched. Query/Compare do add normal in-memory audit entries on the running server.

Raw WebM and temporary encoding files are removed only after a successful export. A failed run leaves diagnostic files and exits nonzero; fix the concrete cause before recording again. Common causes are a stopped server, a different checkout being served, missing FFmpeg filters/fonts, or a changed corpus invalidating an expected result. Do not edit metrics to make a take pass.

### Validate before sharing

With the chapter player server running:

```bash
node tests/browser/review-video.cjs
```

For a different port/directory, also set `QUERYTRACE_VIDEO_PLAYER_URL` and `QUERYTRACE_VIDEO_OUTPUT_DIR`. The review script checks the MP4 hash, chapter boundaries and navigation, plays the complete video at normal speed, verifies dimensions/duration and records playback errors and dropped frames. It saves one checkpoint image per chapter, runs axe on the player at desktop and 375 px, and checks horizontal overflow. These checks do not assess the explanation or visual quality; watch the full export and inspect the source text, trace, policy numbers, caption timing and final identity state yourself. Remove obsolete checkpoint images when replacing a take with fewer chapters.

The evidence bundle contains the recording responses, asset hashes, exact MP4 hash, player review and preview derivation. Do not version credentials, cookies, headers, personal filesystem paths or real private documents. If the app, corpus or recording changes, regenerate and review the media together; an earlier playback report does not validate a new MP4.

### README preview and publication

The README animation is a **25-second highlight reel**, not the complete walkthrough: five real five-second excerpts show context, source, trace, comparison and identity. It retains the English caption band at 1080-pixel width and 8 fps. The complete MP4 and chapter player remain the primary deliverables. The static cover comes from the Compare chapter.

The supplied [YouTube walkthrough](https://www.youtube.com/watch?v=N0zUpEQrKhE) is the earlier published version and remains linked separately. The new recording is local and has not been uploaded to YouTube or another host. Repository browsers may download the MP4 as a binary; the README uses a GIF rather than relying on an embedded HTML video player. Older recordings remain under their original evidence directories as historical artifacts.
