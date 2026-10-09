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

## Recorded walkthrough

[Watch the H.264 MP4](evidence/ui-polish/video/querytrace-demo.mp4) · [English captions (SRT)](evidence/ui-polish/video/captions.srt) · [Playback page](evidence/ui-polish/video/index.html)

The recording shows the final UI using actual backend responses in the PE demo workspace. It is silent, with English captions added in a band below the application. No UI is composited or synthesized. No provider is called. The selected role is guest laboratory Analyst; these are fictional public data, not an authenticated private session.

Text description:

- The header identifies Atlas Capital's workspace and guest laboratory mode.
- The user types “What is Meridian's ARR growth rate and net revenue retention?” and runs Query.
- The result contains six documents, eight fragments and 2,013 estimated context tokens, against a 2,048-token budget. It explicitly says no answer was generated.
- The user expands the Meridian Form 10-K source excerpt, then opens Decision Trace and reads a real blocked fragment with its required role.
- Compare executes the same query and role. Top-k includes two documents that Full Policy blocks; its context is 2,390 estimated tokens versus 2,013 under Full Policy. Each policy's different candidate and selection limits remain visible. This single query is not a general savings claim.
- The user reopens Guide in the header. It remains available without an answer-provider key.

For a browser player from the repository root:

```bash
python -m http.server 8016 --bind 127.0.0.1 --directory docs/evidence/ui-polish/video
```

Open [the local player](http://localhost:8016/). Alternatively, open the MP4 in a local video player. Download the file if a repository browser shows it as a binary.

### Regenerate the recording

Install the README's Python/browser dependencies and FFmpeg with `libx264` and `drawtext`. Start a production application checkout on a free port with no answer-provider key:

```bash
ANTHROPIC_API_KEY='' python -m uvicorn src.main:app --host 127.0.0.1 --port 8015
# In another terminal, from the same checkout:
QUERYTRACE_SMOKE_BASE_URL=http://localhost:8015 \
  FFMPEG=/absolute/path/to/ffmpeg node tests/browser/record-demo.cjs
# After reviewing the exported MP4, regenerate the README animation:
FFMPEG=/absolute/path/to/ffmpeg node tests/browser/build-demo-preview.cjs
```

The script uses a fresh light-theme browser profile at 1440 × 900, verifies the served CSS against the checkout, checks Ask is disabled, performs real UI interactions, saves the cover, captions and backend response evidence, and encodes H.264/yuv420p with fast-start metadata. It derives caption counts from responses and fails if the expected permission difference disappears. It never changes fixtures, policies or thresholds. The caption font defaults to macOS Arial; override `QUERYTRACE_VIDEO_FONT` with an installed font file on another platform. Raw WebM and temporary caption text are removed after successful encoding. Review the exported MP4 before using it.

### GitHub playback

The README displays an animated GIF derived from the current MP4, preserving the full 59-second sequence and English captions at 1080 × 747 and 8 fps (about 3.8 MiB). This restores the moving preview that earlier README versions provided. The linked preview opens the supplied YouTube video; a separate MP4 download contains the current full-resolution walkthrough. The static [cover](evidence/ui-polish/video/cover.png) is retained for the local player.

The GIF is an image animation, not a video player with controls. A relative MP4 or an arbitrary `<video>` tag is not assumed to create a GitHub README player. [GitHub documents GIF support and video attachments](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files), recommends H.264, and limits video uploads on free plans to 10 MB.

No GitHub attachment has been uploaded. If a hosted player with controls inside GitHub is desired, upload this reviewed MP4 through GitHub's attachment UI in an authorized issue/PR/comment and use the actual returned attachment URL. Verify its rendering in the intended location before changing the README. The GIF, YouTube link, MP4 download and local player work without that step.
