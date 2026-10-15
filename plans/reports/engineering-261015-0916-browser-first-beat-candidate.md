# Browser-first private Beat Grid candidate

Date: 2026-10-15. Status: private implementation and bounded investigation delivered. Production decision: **NO-GO**.

## 1. Revision and delivery boundary

- Branch: `codex/beat-grid-quality-recovery`.
- Inspected base: `964b0abddfbda3506180c0026c44efe8a6f3cf2b`.
- Integrity/reference commit: `bd82edc86d9fd6dee974fd55d2d04750679c5ee3`.
- Implementation commit: `edf80f164a55e408151ec5a6cf5a4b36d24a82d1`.
- Final safety guard: `1c7a1c142087211ec0cebb3f60330a72a2f1efb9` (revokes actual delay when frames, a second media source or lost output ownership makes the session ineligible).
- Final tested code/contracts: `13c3c660eb1d4547815b1342fd25c2ca22818a2e`; the real-source test-tool update is `80a83dbd63da20fd73053ad47c3ff1585a6fc35d`.
- Final delivery revision and artifact hashes are recorded in the private [delivery manifest](../../scratch/browser-first-candidate/delivery.json) after the documentation commit. No push, PR, website, installer or extension-store publication was performed.

The private package is [browser-first-candidate](../../scratch/browser-first-candidate/), with [listening instructions](../../scratch/browser-first-candidate/Private%20listening%20guide.html), an unpacked extension and ZIP. The source flag stays false in ordinary packages; only `--private` rewrites it in isolated scratch output. The listening page uses production bridge/engine/scheduler/controller/renderer modules and real Companion IPC. Its `--serve` mode never supplies automated consent.

## 2. Capability matrix

The owning [decision and contracts](../../extensions/kanban-music/beat-mode.js) consider source facts, actual capture owner, Web/Desktop, capture/output proof, protected media, clock/generation/rate, detector qualification, calibration and consent. The corresponding [tests](../../extensions/kanban-music/beat-mode.test.js) fail closed for missing proof.

| Source/mode | Implemented behavior | Decision |
| --- | --- | --- |
| Independently verified exact recording/version/content hash plus fresh clock | Predictive EventTrack scheduling; strict verification binding; model cache denied | Experimental contract PASS; actual verified natural track BLOCKED because none exists |
| Ordinary uncached browser audio/video with current ADTOF | Generic degraded visuals; no qualified Kick/Snare/Hat claim | Fallback PASS; semantic detector FAIL |
| Authorized single audio-only browser source, no video/frames, active tab replacement, fresh rate-1 clock, measured budget and explicit delay/output consent | Immediate analysis; fixed delayed output; optional visibly unverified typed preview | Private experimental prototype PASS; physical/listening acceptance BLOCKED |
| YouTube video, unknown source/output, embedded frames, multiple active media elements | No independent audio buffering | Safety gate PASS; synchronized semantic mode unsupported |
| Desktop/native monitoring | No private output-delay ownership | Buffer unsupported; actual Desktop handoff BLOCKED |
| Spotify | New private capture/analysis/buffering denied before stream acquisition; no frontend Spotify cloud-analysis request | Policy-blocked |
| Protected media | Private capture/analysis/buffering denied | Unsupported |
| Multiple simultaneous grid owners | One active capture enforced in sampled checks; readiness can churn under competing renewals | Concurrent-owner mode FAIL/unsupported; use one grid owner |

Hostname does not establish audio-only status or buffering permission. No verified natural EventTrack or qualified low-latency detector was manufactured. The manifest verification schema and exact-source scheduling are tested; no ordinary provider route is promoted into a recording fingerprint.

## 3. Provider and model rights

The current [Spotify Developer Policy](https://developer.spotify.com/policy), effective 15 May 2025, restricts analysis of Spotify content, model ingestion and synchronization with visual media in III.6/13/14; IV also limits streaming/commercial uses. Together with the [Developer Terms](https://developer.spotify.com/terms), this leaves permission and distribution scope unresolved for Kora. Browser capture, local inference and lack of a new Spotify API call are not treated as exemptions. No Spotify-specific analysis or delay workaround was enabled.

The [ADTOF upstream license](https://github.com/MZehren/ADTOF/blob/master/LICENSE) is CC BY-NC-SA 4.0. The [PyTorch port](https://github.com/xavriley/ADTOF-pytorch) and local model notice do not establish a complete production redistribution clearance chain. Existing local weights SHA-256 is `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`. Local evaluation is the present scope; commercial/public release rights remain BLOCKED. Packaging locally is not publication. The normal legacy package/model behavior already existed at the inspected base and was not broadened or declared cleared by this private work.

Generated signals are CC0 and contain no third-party recordings. User-supplied music remains private investigation material; ownership of a downloaded file is not a redistribution license. No protected PCM, source URL, credentials or browsing metadata is included in the committed reports or diagnostic envelopes. The [YouTube terms](https://www.youtube.com/static?template=terms) were reviewed; the browser test establishes behavior only, not a product-wide rights clearance. It uses normal browser playback/capture without source downloads or player/DRM internals.

## 4. Corpus and reference integrity

The 276 preliminary observations remain `provisional-human-reference`, with unknown completeness, confidence/timing uncertainty, duplicate/boundary issues and ambiguous intervals retained. W2's empty marks remain unknown coverage. The Downloads source export is unchanged. Official scoring refuses these files even if a legacy field claims verification. Unmatched predictions are review candidates, not definite false positives. No threshold was fitted to those timestamps.

[prepare-beat-corpus.mjs](../../scripts/prepare-beat-corpus.mjs) freezes deterministic 44.1 kHz stereo signals before evaluation: development spaced drums; frozen rapid Snare pairs, weak overlapping mixtures and silence. There are 18 development and 62 frozen synthetic attacks. Exact sample onsets establish controlled timing/resolution only. Manifest SHA-256: `e56f9219ef19ce45e88e4d1607a59a8f0f07184c068cb32f3bfa977ba18034b6`.

The existing 11 hashed natural excerpts cover Whiplash W1/W2/W3, MONO, Bich Phuong, Levels/EDM, Trap, Rock, Pop, piano and Weightless. No independently reviewed complete natural labels or licensed, independently labelled isolated stems were available. The [separate verification queue](../../scratch/whiplash-provisional-investigation/verified-subset.pending.json) has zero verified entries. Instrument/timestamp/coverage verification cannot honestly be inferred from model output or incomplete manual clicking. A compact expert-reviewed natural subset remains BLOCKED; no request for hundreds of new user labels was substituted for it.

The local Whiplash file is bound to source SHA-256 `c8626d3902002e0b2dca318fe8211565ccd4603e7467b998e307918291be675f`, approximately 115.38 seconds, 44.1 kHz stereo. Its artist/recording identity is not independently confirmed; the filename is not a verified version identifier. W1/W2/W3 refer to this file's 8–20, 60–72 and 95–107 second windows.

## 5. Bounded A/B/C result

[comparison.json](../../scratch/browser-first-corpus/comparison.json) records exact inputs, splits, denominators, per-row timing and the two real ONNX runs. Synthetic counts below use one-to-one ±50 ms matching; they are not official natural-music scores.

| Controlled input | Kick TP/FP/FN | Snare TP/FP/FN | Hat TP/FP/FN | A versus B |
| --- | --- | --- | --- | --- |
| Spaced development | 6/0/0 | 6/0/0 | 6/6/0 | Identical |
| Rapid frozen pairs | 0/0/0 | 6/0/2 | 0/5/0 | Identical |
| Weak overlapping frozen mixture | 18/0/0 | 12/0/6 | 18/0/0 | Identical |
| Frozen silence | 0/0/0 | 0/0/0 | 0/0/0 | Identical |

A is unchanged ADTOF. B is one deep-valley onset/peak refinement, with unchanged class thresholds. B restores two accepted Snare activation impulses 20 ms apart in the controlled classifier case; a broad plateau still yields one. The real synthetic audio still loses the second 20/30 ms Snare attacks and hallucinates five Hat events in 12 seconds of Snare-only audio (25 absent-Hat events/minute). Weak-mixture Snare recall is 12/18. B does not fix those acoustic errors. Real inference batch p95 was approximately 19–20 ms on these short isolated runs, but predicted-onset-to-visible-DOM p95 was about 200–241 ms. B is not causal and cannot repair model lookahead by picking peaks earlier.

C admission was bounded to reviewing the trained [Inverse Drum Machine](https://github.com/bernardo-torres/inverse-drum-machine). Its Apache-2.0 repository and supplied checkpoints are useful leads, but the inspected [inference entry](https://github.com/bernardo-torres/inverse-drum-machine/blob/main/idm/inference.py) processes complete file/tensor input and does not establish a compatible, stateful causal browser artifact or measured target-device latency. No C model was admitted or run; no substitute JavaScript picker was represented as trained causal detection. Qualification is BLOCKED, not evidence that no causal models exist.

Decision: retain B only as a private experimental resolution refinement. **Detector NO-GO** for supported semantic delivery: independent natural accuracy, legitimate release scope and latency/CPU qualification are not established, and controlled errors already miss the targets.

## 6. Known false/rapid-hit cases

Identical-activation A/B replay across all 11 natural inputs adds/removes zero events. Counts are W1 69, W2 84, W3 87, MONO 1, Bich Phuong 1, Levels 62, Trap 63, Rock 77, Pop 63, piano 0 and Weightless 11. Activation artifact SHA-256 is `ff2f5cb4bcc0292ee86d566203d9914794f12820b15b3f6a0804362c13e23f11`. These are prediction counts, not musical truth or precision/recall denominators.

The known MONO Hat prediction remains in B. Degraded mode withholds all unqualified typed events, including legitimate attacks; that prevents the false flash from being presented but is **not** a classifier accuracy improvement. Experimental preview can still show it. No provisional unmatched prediction is labelled a definite false positive. The earlier exact-20 ms controller roundoff fix and 1 ms same-source/40 ms cross-source merger are preserved and regression-tested.

Actual Edge/Companion playback also exercised all 11 WAV-hashed local excerpts through the file picker and real tab capture: all had healthy capture observations, zero retained old-source delay after the new capture owner was established, and no unqualified typed counters. Sampled withheld K/S/H predictions were W1 52, W2 67, W3 69, MONO 1, Levels 54, Trap 51, Rock 66, Pop 51, piano 0, Weightless 9 and Bich Phuong 1. These are partial diagnostic counts affected by capture startup and snapshot coverage, not complete-event or accuracy denominators. The [actual music artifact](../../scratch/browser-first-candidate/real-msedge-music.json) contains no official precision/recall/F1.

## 7. Actual Companion timing waterfall

Real loaded Companion ID: `loofmccgnbcpglckgkcpnflkkelakloi`; version `0.3.24`, version name `0.3.24 browser-first-v1 private`. Tested installed browsers: Chrome `155.0.8059.41`, Edge `155.0.4283.45`. Tests use isolated headless profiles and Chrome's supported extension-testing action API. No user profile is changed. Removing Playwright's default extension-disable/audio-mute flags was necessary. A returned installation ID was not accepted until the loaded manifest and actual capture were observed.

The actual path is media element → tabCapture/getUserMedia → offscreen audio graph → worklet/model/classifier → capture queue → extension worker/Chrome IPC → real app parser → event engine/scheduler/controller → renderer. It replaces neither capture permission nor Chrome IPC with an adapter. Bounded snapshots retain original audio timestamps, target deadlines, worker-batch duration, queue depth and event/receipt/commit/render IDs. [runtime-summary.json](../../scratch/browser-first-candidate/runtime-summary.json) reports the available spans. The extension-worker intermediate hop is included in the measured offscreen→app IPC span; it is not separately timestamped as a complete C0–C9 ledger. Periodic windows are sampled and cannot prove a complete missed-event rate. DOM error is the earliest **retained** semantic render record per ID; it can be later than the first visible flash. Its outliers are not automatically missed musical attacks or a physical timing measurement.

The 1,804.009-second Chrome run retained 172 snapshots. Actual worker batches: p95 28.7 ms / p99 32.4 ms (8,232 retained batches). Sampled offscreen→app IPC: p95 2 ms / p99 3 ms (1,780 matched IDs). Earliest retained semantic DOM record versus predicted output target: p95 27.6 ms / p99 47.8 ms (2,523 IDs); 25 retained IDs exceed 50 ms and the maximum is 300.5 ms. The Edge 93.919-second smoke run retained 115 DOM IDs with p95 29.8 ms / p99 31.6 ms, plus one >50 ms outlier. Receipt→DOM spans deliberately include waiting for the delayed target; they are not pure React cost. None of these values establishes first-pixel completeness, musical onset correctness or physical speaker→pixel timing.

## 8. Buffered audio-only prototype

Actual generated CC0 audio is captured with browser-reported active tab ownership and restored through exactly one Companion output branch. Analysis connects before the delay. The private graph requests audio only; the prior unnecessary video-track stop made Chrome report capture stopped despite continuing audio, invalidating ownership proof. This was diagnosed on the actual path and repaired without dropping the ownership requirement.

Delay is calculated from at least 32 observed events: p99 plus 40 ms headroom, rounded upward in 10 ms steps, bounded to 80–500 ms. It is frozen for the enabled experiment. Initial smoke runs independently selected 260 ms in Chrome and 280 ms in Edge; the guarded endurance session selected 270 ms. No worker stall increases the buffer. Calibration and withheld/reset prediction counts are visible.

Configuration requires the same owner/capture/generation and a paused, eligible source, plus rights/output/intentional-delay consent. The toolbar invocation starts authorized local analysis; the later checkbox explicitly authorizes buffered use. Automation consents only for the generated routing test and does not assert human hearing. Model failure leaves output connected. Graph transitions fade before disposal; physical click/pop/echo acceptance is not claimed. Pause clears queued events/replaces the DelayNode. Original-audio cutoffs reject in-flight pre-boundary inference, while a fresh internal epoch rejects already-sent stale IPC. Seek/source/generation/rate changes revoke the experiment. A final negative-case regression found that the pause-retention predicate also had to require a paused, still-eligible source; otherwise a newly added frame/second media source could leave the actual delay active while the capability said degraded. The one-line guard and three regressions repair that mismatch. Async regressions prove old results drop and fresh results still deliver.

## 9. YouTube video

An actual playing, unmuted YouTube video (`jNQXAC9IVRw`) was captured in Edge through Companion. The observed media had readyState 4 and advanced playback time; capture/output/clock proof was healthy. The decision stayed `degraded` / `detector-unqualified`, with `bufferMs:0`, `allowSemantic:false`, `allowTypedPreview:false`, and no video eligibility. The existing nonsemantic renderer remained available. No guessed BPM pattern was emitted as Kick/Snare/Hat, and no independent video-audio delay was inserted. This is a behavioral fallback pass, not a music-accuracy, user-hearing or ≤50 ms semantic pass. The [actual lifecycle artifact](../../scratch/browser-first-candidate/real-msedge-lifecycle.json) retains the result.

## 10. Lifecycle and endurance

Actual Edge checks passed pause/resume, seek and rate revocation, offscreen restart, app reload, network failure/recovery, source switching/navigation and tab closure. Pre-toolbar capture rejection was observed. Sampled competing-source checks had one active capture, but a repeated competing-app readiness test timed out: simultaneous owners can churn, so that mode is unsupported. Direct detector-worker failure injection was attempted with safe target identification; the debugging interface returned an unnamed worker and timed out on inspection. It was not killed blindly. Actual worker-failure/recovery and Desktop handoff remain BLOCKED; unit tests cover model startup failure, retained audio and stale-runtime rejection.

The Chrome run completed **1,804.009 seconds**, with all 172 snapshots in `experimental-buffered`, a fixed 270 ms output delay, capture/clock health true and actual output delay matching reported status. Maximum retained queue depth was zero. App JS heap ranged approximately 5.6–31.0 MiB; the 175 OS resource snapshots measured aggregate browser private bytes up to 841.0 MiB and summed working sets up to 1,170.1 MiB (shared pages can be counted in multiple working sets). CPU was approximately 90.7% of one logical core over the sampled interval. No browser-budget qualification is claimed.

Reported playback-position versus wall-time deviation reached 505.6 ms; mixed discovery/clock anchors and polling mean this is not speaker drift. The final worker retry streak was zero and no worker-failure record was retained, but sparse windows do not prove zero watchdog events for the entire run. Stage counters include 3,397 `EVENT_LATE` records across generic and typed diagnostic activity; these are not 3,397 missed attacks. A complete deduplicated missed/late musical-event rate is unavailable. Physical glitches, speaker/pixel drift and hearing remain unmeasured.

Provenance matters: the soak loaded ZIP SHA-256 `d618799b616f008859fcf53e5170042de7b1048e97174cffa52c677566ed4ac3`. The subsequent one-line eligibility-retention guard does not alter this steady single-source audio path; its final ZIP is `625a548deb0c02466c8605b88007c0300ac9db7d0bd98c3a6413cbb2f07c54e3`. The final guard was separately validated on actual Edge output when a frame or second playing media element appeared: both status and the real offscreen output returned to zero delay. The final package did not receive a second full soak. This distinction remains visible instead of attributing an old artifact's exact checksum to new source.

Only owned test processes were monitored. Servers/browsers/monitors exited, deterministic test ports were checked free, and 21 owned temporary browser profiles were removed after verifying their absolute paths stayed under the private scratch directory. Raw result JSON, corpus and listening artifacts remain available. Headless rendering and concurrent regression/build jobs limit transfer of CPU/timing results to an ordinary interactive device.

## 11. Final validation and review

Final code/contracts at `13c3c66`: 881/881 Vitest tests across 114 files; 15/15 Node reference/review tests; typecheck PASS; local normal/private extension packaging PASS; production web build PASS; lint zero errors with 25 existing warnings. The final provenance test was added after the preceding 880-test full pass, then the entire 881-test suite passed. Main entry is approximately 713.5 KiB against 976.6 KiB budget. Local packaging creates files only and performs no deployment. Desktop installer signing/publication was not run.

The required read-only review found an in-flight preview/reset race. The fix uses original-audio cutoffs and internal epochs across both inference and already-sent IPC, with asynchronous rejection and fresh-event recovery assertions. A wording concern was corrected so buffered-use authorization is not confused with the earlier toolbar analysis action. The suggestion to alter normal legacy release behavior was kept as an existing release blocker rather than broaden this private-only change; base source verifies that behavior predates this work. The delivery manifest records final validation after the documentation/summary commit.

## 12. Private user acceptance

**Initial usability check FAILED; retry PENDING.** The user reported no visible flashes for local audio or YouTube after loading Companion. The screenshots show `degraded` mode; they do not establish enabled buffered preview. The private page correction and bounded rendering check are recorded below. The user has not accepted the candidate by listening. The [private guide](../../scratch/browser-first-candidate/Private%20listening%20guide.html) explains loading the unpacked Companion, starting the local server, selecting authorized Downloads audio locally, calibrating, pausing, opting into the bounded delay/preview and reporting approximate track times. No file upload or external audio service is used. A failed listening report remains failed regardless of fixture/unit results.

## 13. Concrete decision

Deliver the private candidate for **one authorized audio-only tab and one grid owner**, with explicit experimental delay and visibly unverified predictions. Use honest degraded visuals for ordinary video/uncached unqualified playback. Keep Spotify policy-blocked, native/unknown-output buffering unsupported, and model-generated caches outside verified mode.

Production semantic accuracy: **FAIL/NO-GO**. Verified natural reference and model release rights: **BLOCKED**. Physical p95 ≤50 ms, click/pop/echo and user listening: **BLOCKED/PENDING**. Real worker-failure injection, Desktop handoff and concurrent-owner readiness: **BLOCKED/FAIL**. Controlled integrity, actual browser capture, bounded audio prototype and YouTube degraded safety behavior have supporting evidence; none closes the failed or blocked accuracy gate. No speculative threshold/model tuning loop or deployment follows this decision.

## 14. Private review visibility follow-up — 2026-10-15

The private page previously exposed only the raw event path and a collapsed, small experimental control. In `degraded`, instrument rows intentionally stay idle; the global border animation peaked at 0.3 opacity. The full-width grid amplified the appearance of static white cells. This explains why the page could look broken without proving a capture or detector failure in the user's browser. The first local screenshot has no private control; the YouTube screenshot does. Neither proves enabled instrument preview, and YouTube remains ineligible for that preview.

The private page now distinguishes missing capture, missing private capabilities, video restrictions, disabled preview and enabled preview. It provides an Open source tab action, expands the existing consent control, places a compact dark grid above it, labels the decorative feedback and displays preview event counts. The private grid stays idle until actual capture connects; playback-clock fallback alone cannot light it. A scoped border pulse is more visible after capture connects. The normal player's disclosure remains collapsed by default. No classification threshold, source eligibility, consent, verified-reference contract or accuracy gate changed.

Actual isolated Edge 155 testing with generated CC0 percussion exercised the toolbar capture action and the checkbox/button flow. Before capture it asserted zero decorative and instrument flashes despite an advancing playback clock. After capture, before consent, it observed viewport-visible decorative animations and zero instrument flashes. After consent the final run observed three viewport-visible colored instrument animation starts and advancing onset counters in a 624 px grid. The result records the calibrated intentional delay. Both animation checks require nonzero opacity, visible style and full viewport bounds; decorative checks sample beyond the initial transparent frame. These are bounded rendering/routing observations, not accuracy, physical timing or human-hearing evidence. See [result JSON](../../scratch/browser-first-candidate/real-msedge-review.json) and [preview screenshot](../../scratch/browser-first-candidate/review-msedge-preview.png). Run against an existing review server with `KORA_CANDIDATE_REUSE_SERVER=1`, `KORA_CANDIDATE_REVIEW=1`, `KORA_CANDIDATE_BROWSER=msedge`, `KORA_CANDIDATE_SECONDS=0` and `node scripts/verify-private-companion.mjs`.

Validation: 68 focused renderer/engine/capability/private-sync tests pass; touched TSX lint, typecheck, script syntax and private Vite build pass. Read-only review found and resolved the uncaptured decorative feedback and decorative visibility assertion gaps; re-review found no remaining concrete defect. The browser control plugin failed to load with a local `EPERM` error, so this test used the repository's isolated Edge harness and did not inspect or alter the user's browser. Its temporary browser processes exited; the existing user review server (PID 22692, ports 5173/5174) remains available. User retry and actual listening acceptance remain pending.

## 15. Disabled activation follow-up — 2026-10-15

The user reported that all four boxes were checked and the top playback button said Play, yet calibrated-delay activation remained disabled. The diagnostic identified unavailable calibration. The user subsequently confirmed activation and supplied a screenshot showing `experimental-buffered`, 280 ms and visible instrument predictions. Local activation usability is confirmed; musical accuracy and listening acceptance are not established. The control now lists every unmet activation condition beside the button and links that explanation with `aria-describedby`. Pause, capture identity, buffer eligibility and consent requirements are unchanged. Missing clock/capture proof, source/output restrictions, playback rate and calibration limits have actionable messages.

Four focused activation tests pass, including all consent checked while playing, successful same-source pause transition, lost capture and failed calibration. Typecheck, touched-file lint, script syntax and private-page build pass. The updated actual Edge test checks consent while playing, pauses through the grid's real media command and waits 15 seconds across multiple capture leases before activating. Capture identity remains stable, the control reports Ready, activation succeeds, and three viewport-visible instrument animations are observed. The [review artifact](../../scratch/browser-first-candidate/real-msedge-review.json) records `reviewActivation.captureRetained:true`. This did not reproduce the earlier transient calibration failure; the user's later screenshot confirms successful activation.

## 16. Subsequent platform testing scope

The user explicitly requested YouTube/other-platform testing after confirming local activation. The [platform live-preview follow-up](engineering-261015-1911-platform-live-preview.md) records the new private, zero-delay, explicitly consented unverified mode. This extends the former video-decorative-only decision for private testing. It does not qualify the detector, permit video buffering or authorize production publication. The original v1 ZIP is retained as `scratch/browser-first-candidate/kora-music-companion-v1.zip`; its hash and the historical soak evidence above remain tied to that version.
