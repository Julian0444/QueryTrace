# QueryTrace demo — recording notes

[Watch the MP4](querytrace-demo.mp4) · [Chapter player](index.html) · [Timed transcript](transcript.md) · [Presentation and recording guide](../../demo-guide.md)

A silent, captioned demonstration of the actual local application. Captured October 10, 2026 (Pacific time); final playback and delivery checks completed October 25, 2026. The application source is `950cef5105f2bd45bd82a3a777becdb1f1a749d6`. The new capture scripts and player are included with this media bundle.

## Format and story

- H.264 MP4, 1920 × 1080, 25 fps, approximately 1:53; 3,263,124 bytes (3.11 MiB). No audio track.
- Nine workflow chapters plus opening and closing cards. English captions are embedded below the interface and also supplied as [SRT](captions.srt) and [WebVTT](captions.vtt).
- A continuous 1600 × 800 browser capture is scaled to 1920 × 960, with a 120-pixel caption band. Only the title cards and caption band are editorial additions.
- [README animation](preview.gif): five real excerpts, approximately 25 seconds, 1080 × 608, 200 frames at 8 fps; 1.59 MiB. It is a highlight reel, not the complete video.
- [Cover](cover.png): extracted from the Compare chapter. The earlier YouTube recording remains linked separately in the repository README.

The narrative moves from a question to retrieved context, source text and permission decisions, then compares policies, exports JSON, checks a benchmark and audit records, signs in as a restricted Analyst, and changes workspace. The [transcript](transcript.md) supplies every caption with its time.

| Start | Chapter |
|---|---|
| 0:00 | QueryTrace |
| 0:03 | 01  Start with a question |
| 0:12 | 02  Inspect the context |
| 0:22 | 03  Read the evidence |
| 0:31 | 04  Follow the decision |
| 0:44 | 05  Compare the policies |
| 1:00 | 06  Check the benchmark |
| 1:09 | 07  Keep the execution record |
| 1:17 | 08  Enforce an actual identity |
| 1:35 | 09  Bring another workspace |
| 1:49 | Inspect. Compare. Trace. |

## What the recording actually verifies

The recorder uses real backend responses and checks five served frontend hashes against the source checkout. The only intercepted routes are guards for `/ask` and `/ingest`; neither was attempted. The captured context contains six documents and eight fragments, using 2,013 estimated tokens within a 2,048-token budget. The expanded Form 10-K contains the figures named in the caption.

The unfiltered Top-k comparison returns two documents that Full Policy blocks, with 2,390 versus 2,013 estimated tokens. The baseline and filtered policies use different selection limits; this is not a general token-savings claim. Downloaded comparison JSON is asserted equal to the actual response. The benchmark screen shows all 12 PE fixture queries completed and zero unauthorized returns under Full Policy.

Julia's query has `effective_role: analyst` and `simulated: false`. Her Documents view exposes six of sixteen sources. Switching to Nimbus clears the preceding result. The recorder fails on unexpected browser errors, failed requests, missing expected results or any attempted model call/upload.

The fictional corpora and public demo accounts are intentional. Guest roles are simulations; authenticated roles are enforced by the server. Run retrieves context and does not generate an answer. The separate earlier [real Haiku integration check](../../evidence/taste-redesign/ask/verification.json) remains historical evidence; this recording makes no claim to demonstrate a generated answer or general answer quality. No private account, API key or real private document appears in the capture.

## Review and reproducibility

The full export was played at normal speed in Chromium and through CUA's in-app browser. Saved chapter checkpoints were visually inspected for readable source text, labels, captions and policy alignment. The player has also been checked at 375 px; its video height fits the viewport and its chapter buttons remain accessible. The GIF was decoded and representative frames reviewed.

- [Final local validation](validation.json): backend/browser tests, benchmarks and media checks.
- [Recording evidence](demo-run.json): actual responses, identity, asset hashes, scenes, export check, duration and MP4 SHA-256.
- [Playback review](playback-review.json): exact reviewed hash, complete playback, dimensions, decoding state, dropped frames, chapter navigation, desktop/mobile axe results and horizontal overflow check.
- [Preview derivation](preview.json): input/output hashes and five source segments. GIF timing is quantized to centiseconds, so decoded duration is 25.01 seconds.
- `review-00.png` through `review-10.png`: one exported playback checkpoint per chapter.

An interrupted first review had no completion report and was not counted as a pass. The final review distinguishes a browser-cancelled MP4 range (`ERR_ABORTED`) during seeking from failed playback; any such cancellation is retained in its report. Other network errors, decoding errors or failure to reach the end still fail validation. The local server supports HTTP byte ranges, including suffix ranges and 416 responses for invalid ranges, so chapter seeks work reliably.

From the repository root, run `node tests/browser/serve-demo.cjs` and open [localhost:8036](http://localhost:8036/). Use `node tests/browser/review-video.cjs` for full playback validation. The [demo guide](../../demo-guide.md#reproduce-the-recording) gives dependencies, environment overrides, rehearsal, encoding, preview generation and troubleshooting. Keep the player on loopback; no hosting or upload is part of these instructions.

MP4 SHA-256: `41e0900db621ddbbd31ba1755fcbd749af2cd4eb2b00844b49053fd10abfd671`.

The application policies, fixtures and backend were not changed for this recording. The browser profile was fresh; normal Query/Compare operations did add in-memory audit entries. The final media has not been published externally.
