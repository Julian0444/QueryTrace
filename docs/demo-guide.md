# Present QueryTrace in five minutes

Run the application using the [README](../README.md), then open `/app/`. No answer-provider key is needed. The built-in Guide can be started, skipped, reopened or reset. All organizations, source documents and public accounts in the two bundled workspaces are fictional.

1. **One question.** Choose **Start tour** or **Guide**. The guide uses a compatible question from the active workspace, or asks for one if no example is configured. **Retrieve evidence** runs Full Policy without calling a model. The returned counts unlock **Compare this evidence**.
2. **Same question and role.** **Compare policies** uses the successful retrieval’s question, role, candidate limit and token budget. Read the actual document difference, including the explicit no-difference outcome. Restricted accounts continue with their permitted Full Policy evidence; they never execute unfiltered baselines.
3. **Decision and source.** **Read decision and source** opens Full Policy’s complete trace and shows a disclosed decision with the exact first selected fragment beside the guide. Document, outcome and reason are visible before technical references. An empty result explains why there is no source to read.
4. **A variation.** Enter a different question and choose **Retrieve evidence**. The original comparison remains available. **Continue without a variation** is an explicit omission, recorded in the closing title.
5. **What happened.** The closing summary uses the responses from this run. **Finish guide** is available only after the evidence steps. Generation, accounts and Tools are optional continuations. **Generate answer** calls the configured provider and may incur a cost; the guide never calls it.

**Back** revisits completed steps without rerunning requests. **Exit** pauses at any point, including loading. Reopening **Guide** resumes the in-memory run. **Restart guide** clears its progress and requires fresh successful results; it does not delete useful results on the page. Exiting restores a pre-existing draft, settings, view and results. Starting from an empty page keeps the guide’s useful results. A page reload deliberately discards tutorial response data; reopening then starts with a fresh evidence check. Only progress metadata is persisted, never source text or authenticated results.

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

To reset an ongoing or completed guide use **Guide → Restart guide** (shown after the first result). To replay the initial welcome in a fresh browser profile, visit the app with no `qt_tutorial_v1` storage entry. Skipping or completing it persists across reloads.

## Recorded walkthrough

[Play the MP4](media/demo/querytrace-demo.mp4) · [Chapter player](media/demo/index.html) · [Timed transcript](media/demo/transcript.md) · [English SRT](media/demo/captions.srt) · [English WebVTT](media/demo/captions.vtt)

The October 25 recording is historical: it predates the result-backed tutorial and current action labels. It is silent, with English captions in a dedicated band below the application. It follows one continuous session from a question to inspectable evidence, then compares policies and demonstrates an authenticated account. Opening and closing cards frame the story. The corpus, documents and accounts are fictional.

### Story and checkpoints

| Step | What the viewer sees | What this demonstrates |
|---|---|---|
| Question | Atlas Capital; Guest · Simulated Analyst; a typed Meridian question | The workspace, identity and task are explicit before execution. |
| Context | Six documents, eight fragments; 2,013 of 2,048 estimated tokens | Retrieval returns context. It has not generated an answer. |
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
