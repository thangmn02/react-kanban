# Hybrid Beta integration and Melody completion

Status: delivered PRIVATE_LOCAL_BETA with explicit limits. M1 Web/actual Desktop four-row playback passed; M2 real Web/Companion software comparison is PARTIAL; M3 exact saved Lead playback passed on Web. Native fifth-row follow-up remains unverified after Computer Use input guards; live CNN/new full-song or live Lead/physical sync/rights gates remain blocked or unverified. Final tests, build, packaging audit and read-only review passed; implementation commit `15dc6bb174c43b5b5ab95b462daad61edafb6c81`. Base: `a8ca6f4f659d08411b472569cbf69808155d5340`; branch `codex/beat-grid-quality-recovery`.

## Accepted outcome

Provide opt-in **Beat Grid Hybrid — Beta** inside the existing Music/Focus UI on Web and Desktop. Own one local audio clock; reuse frozen H0 percussion and existing Bass, preserve local-source generations, lifecycle, prior modes and Original/Short Attack choice. Then measure real Companion baseline versus offline delivery, investigate online CNN constraints, and connect eligible exact-source saved Lead analyses through the existing Melody wire contract. No model search, tuning, deployment, provider downloads or public rights promotion.

## Milestones and acceptance

1. **M1:** private local build only, existing MusicPlayer and beat engine/scheduler/controller; exact validated local analysis bridge, retained-source selector and local file lookup; frozen H0 plus existing independent Bass; Web and actual Desktop tested separately. Missing runtimes/caches explicit. Preserve provider capture protections.
2. **M2:** same-grid trace instrumentation and export. Actual Companion A capture comparison; version online CNN experiments separately, measure future-context/global-reference limitations and drift without fitting thresholds. Expose live Hybrid unavailable if evidence/rights do not qualify it. Physical synchronization remains unverified without external evidence.
3. **M3:** audit actual Lead implementation/runtime and existing caches first. Bind eligible saved analyses to exact audio hashes, keep pitched-note/articulation distinctions and dominant-monophonic policy; test real playback and lifecycle. Record a concrete blocker for unsupported full-song or live analysis rather than fabricating events.
4. License/packaging audit, narrow and full regressions, independent read-only review, docs and exact delivery receipt/commits. Preserve M1 if later gates are blocked.

## Architecture audit findings

- Music UI: `MusicPlayer.tsx`, discovery/controller selection: `useBrowserMusic.ts`.
- Event source precedence/cache: `beat-event-engine.ts`; timing: `beat-scheduler.ts`; state acceptance: `useMusicBeatSync.ts`; visual rows: `BeatPattern.tsx`/`SemanticBeatPattern.tsx`.
- Browser Bass: existing `extensions/kanban-music/beat-detector.js` (150–400 Hz); native monitored Bass uses `src-tauri/src/beat.rs` (60–250 Hz). Local owned WebAudio should reuse the existing browser detector unchanged, disclosed consistently on both platforms.
- Frozen H0: `full-song-hybrid.mjs` calls canonical Python `hypothetical_hybrid`, no rewrite. Existing full-song store validates exact saved A/B results and raw coverage.
- Lead: existing event/provenance contracts and cache adapter are operational. `docs/server-beat-analysis.md` references server/audio-analysis and scripts absent from this checkout. Existing ignored `src-tauri/target/lead-pulse/fixtures.json` contains saved Lead events. Source/cache/runtime validation is required before reuse.
- Desktop: Tauri/WebView2; use private development build with local bridge proxy, without widening distributed CSP or shipping weights/endpoints.

## Boundaries, verification and rollback

Freeze numerical/model/H0 identities before edits. Add source-bound local transport/client seams rather than a parallel scheduler/controller. Default-off build/runtime opt-in; never transfer selected bytes outside loopback or fetch arbitrary URLs. Keep saved music/checkpoints/traces ignored. Test simultaneous Bass+drums, seek/pause/source invalidation, cache failure, renderer parity, reduced motion, normal workflows and production package exclusion. Roll back this sprint's commits to remove the Beta; caches remain reusable.

Report: [delivery](../reports/engineering-261018-1525-hybrid-beta-melody.md). User requested English conversation; acceptance instructions will also use English.

## Execution evidence

- Private receipts: ignored `scratch/hybrid-beta/`. Server command `node scripts/serve-hybrid-beta.mjs`, deterministic port 1420; process receipt owns its PID. Preparation worker is idle. Isolated test browsers/load workers closed; temporary production audit server 4381 stopped. Desktop was restored and left on the exact saved piano source, paused.
- Actual Web checks cover four independent rows, frozen IDs/timestamps, Original/Short continuity, seek/pause/source switch and Beta-off restoration. Actual Tauri/WebView2 observations at 82.8 and 172.7 seconds establish separate Desktop playback evidence; physical timing remains unverified.
- CNN diagnostic `C1-running-reference-centered-diagnostic-v1` reuses frozen checkpoint and saved baseline logits. Minimum steady future audio 104.49 ms; Rằng Hat edges 565→577 with 29 removed/41 added original frames. This is a Python diagnostic, not sustainable browser live CNN qualification.
- Actual live A capture exposed app SPA query updates incorrectly closing the owner capture. `tabLoading` now invalidates source navigation only; app pagehide, receiver failure, leases and tab closure still release capture. The corrected real app run has 60 accepted/committed and 57 animated semantic events, zero added delay. Software animation p95: local H0 35–36 ms, live A 210 ms. Two-worker CPU scenario: local 37–39 ms, live A 229 ms. Headless timing is not physical synchronization; Desktop per-stage/refresh-rate comparison remains incomplete.
- Twelve existing Lead references validated exact original hashes and no overlaps; registered separately without slot changes or neural inference. Similarly titled HSKT/Nujabes full-song PCM does not match the saved references. Web tests cover pitched-note piano, mixed vocal articulation and rejecting title-only full-song substitution. Missing generating server/Modal scripts block new full-song/live Lead inference.
- Read-only review found and resolved Beta-off renderer scope and injected transport pagehide cleanup. Final review of source-loading safety, bounded telemetry, exact Lead binding and duration trails reports DONE with no material regression.
- Final QA: 927 tests /117 files; 8 Node H0/store tests; 6 Python cache tests; lint 0 errors/31 warnings; TypeScript/build and bundle budget PASS. Final Web lifecycle and saved Lead checks PASS. Ordinary production UI/API/private-preview exclusion audit PASS; existing restricted ADTOF remains in its unchanged resource inventory. No new installer or deployment.
- Background proxy did not establish a hidden visibility state: immediate state remained visible, exported histories empty, animation samples sparse. Do not qualify it as a real hidden-tab test. No independent acoustic scoring or physical synchronization gate passed.
