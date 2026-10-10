# Private percussion playback comparison

The causal candidate substantially reduces delivery delay, but it is **not accepted or adopted**. It still produces false percussion in MONO's drum-free intro and loses activity in several percussion-bearing mixes. Precomputed EventTracks render close to their declared media timestamps. The original ADTOF candidate and accepted delivery/rendering fixes are preserved. No production release or Phase 5 work was performed.

## Gates

| Gate | Result | Evidence and limit |
|---|---|---|
| First-playback timestamp-to-animation latency | PASS on the measured desktop/browser fixture | 68.1 ms median, 92.4 ms p95. This is delivery against the event's declared media timestamp, not independently verified acoustic onset latency. |
| Acoustic/perceptual timing and positive precision/recall | BLOCKED | Independently checked positive attack timestamps are unavailable. Teacher predictions are not ground truth. |
| Percussion accuracy | FAIL | MONO's user-identified drum-free 0–40 s produces 7 Kick, 5 Snare, 5 Hat events. Mixed percussion activity also remains deficient. |
| Precomputed range-cache operation | PASS locally | Validated sparse manifests/chunks feed the existing EventTrack engine, priority rules and media-clock scheduler. Uncached ranges remain misses. |
| Production rights | BLOCKED | Teacher-derived weights have unresolved non-commercial obligations; no redistribution or commercial clearance is asserted. |
| Sustained delivery | PASS on the measured fixture | 610 seconds, 3,314 semantic percussion animations, no errors or bridge drops, no inference backlog. |
| Weak-machine and production memory bounds | BLOCKED | No physical Celeron/i3 test is available; the probe retains full diagnostics and cannot establish production memory bounds. |

## Identical-audio comparison

All three runs use the exact same 20-second `nujabes-E.wav` bytes. The machine-readable comparison checks equal audio SHA256 values and exports typed event IDs and target playback timestamps on the same media-time axis. Models naturally predict different events/timestamps; those predictions are not substituted for reference labels.

| Path | DOM lag median / p95 | Animation lag median / p95 | Worker batch median / p95 | Rendered Kick / Snare / Hat |
|---|---|---|---|---|
| Original ADTOF, 100 ms cadence / 100 ms right context | 261.4 / 301.6 ms | 273.3 / 315.6 ms | 27.6 / 30.7 ms | 17 / 19 / 58 |
| Private causal student, 20 ms cadence / zero model lookahead | 58.5 / 80.3 ms | 68.1 / 92.4 ms | 0.7 / 1.1 ms | 45 / 31 / 34 |
| Precomputed ADTOF range, existing scheduler | 5.1 / 10.3 ms | 17.7 / 22.6 ms | No inference required for cached events | 18 / 18 / 60 |

The cached run keeps local recovery analysis alive in parallel; its local worker costs approximately 0.8 / 1.1 ms per batch. Cached event generation itself has already finished. Priority rejections in that run are expected: cached coverage suppresses lower-priority local events. The causal run has two same-row semantic duplicate rejections under the unchanged merger contract. All three have zero browser errors and zero probe bridge drops. Queue depth stays zero in these matched runs.

Timing comes from real HTML media playback/capture, the existing transport payloads, controller, DOM commit and animation telemetry in an isolated Edge profile. It does not measure physical speaker/display latency, the live YouTube provider bridge, or independent human acoustic attack times. No audible delay or artificial timestamp shift is introduced. The capture boundary remains uncalibrated. Prediction agreement exported in `comparison.json` is explicitly not human precision/recall.

## Why the earlier candidate had zero Hats

The earlier preserved browser trace contains Hat/Cymbal score maxima **0.405 / 0.387**, and maximum margins against its abstention head **−0.093 / −0.125**. Every Hat fails before routing: it cannot clear the candidate's fixed 0.5 acceptance level or its learned abstention score. The classifier maps columns 3 and 4 to Hat, with a regression test demonstrating independent repeated Hat events. There were no accepted raw Hats available for the renderer to lose.

The training target construction was also wrong for uncalibrated teacher activations: `nonpercussion = 1 - max(raw teacher score)` can label an accepted low-valued Hat peak as predominantly nonpercussion. Before the user's stop-training clarification, this was corrected to train on accepted teacher pseudo-attacks and explicit negative controls. The final candidate's Hat maximum on Nujabes is 0.824; it produces 51 Hats over the 30-second control and 34 rendered Hats in the matched 20-second browser run. That resolves the zero-stream symptom; it does **not** resolve accuracy. No further training or threshold variants followed the stop instruction.

## Candidate and controls

One 43,638-parameter temporal convolution model uses three left-padded layers with dilations 1, 2 and 4, a 290 ms past receptive field, five instrument score slots and a learned nonpercussion head. The existing 44.1 kHz feature frontend still requires 23.22 ms of centered-window audio. Model future-feature dependence is zero; offline/streaming parity error is zero with identical startup silence. PyTorch/ONNX maximum error is 1.49e−7. The fixed seed, 20 epochs, training provenance and model hash are saved privately. There is no source separation or audio download.

Training uses three calibration families (H.S.K.T., Chân Ái and the existing Chinese-pop control). Their stem/full-mix variants are all marked calibration, including variants not individually used in training. MONO, Bích Phương, Nujabes, Hysteria, Voodoo People, Levels and Caravan remain outside that training split. Positive labels are ADTOF pseudo-labels. Model-separated negative stems may contain residual percussion and are proxy controls, not independently perfect absence annotations.

The listening set has **26 excerpts**, generally 20 seconds; Bích Phương retains the exact 13-second reported intro. It includes the named music, vocal/melodic/bass-only proxies, guitar, pop, rock, EDM, ambient/piano and Caravan jazz. The dedicated trumpet-only, isolated roll and dense-cymbal human labels remain unavailable. No track-specific production rule was introduced.

| Control, full evaluated duration | Preserved ADTOF Kick / Snare / Hat | Causal Kick / Snare / Hat |
|---|---|---|
| MONO drum-free intro, 40 s | 0 / 1 / 1 | 7 / 5 / 5 |
| Bích Phương drum-free intro, 13 s | 0 / 0 / 0 | 0 / 0 / 0 |
| Nujabes full mix, 30 s | 27 / 29 / 85 | 64 / 47 / 51 |
| Hysteria, 30 s | 65 / 40 / 73 | 23 / 9 / 14 |
| Voodoo People, 30 s | 87 / 84 / 115 | 67 / 20 / 56 |
| Levels excerpt, 30 s | 0 / 0 / 17 | 7 / 1 / 3 |
| H.S.K.T. full mix, calibration, 30 s | 47 / 27 / 72 | 65 / 52 / 59 |
| Chân Ái full mix, calibration, 30 s | 26 / 16 / 15 | 30 / 20 / 20 |
| Caravan, holdout, 30 s | Not previously benchmarked | 116 / 71 / 80 |

Counts locate regressions and density changes; they do not establish recall. In MONO's reported drum-free interval the causal false-event rates are **10.5 / 7.5 / 7.5 per minute**, exceeding the two-per-minute acceptance ceiling for every row. Bích Phương stays dark. All 49 evaluated controls, confidence/margin-bearing events and per-track counts remain in private `results.json`; the report does not hide mixed-track failures behind aggregate retention.

No independently verified positive Kick/Snare/Hat timestamp file was supplied. Positive per-row precision, recall, F1 and acoustic timing errors therefore remain unavailable. The listening interface accepts editable human timestamps and explicit full-excerpt verification; it never prepopulates predictions as truth. Its exported annotations can be scored with the existing one-to-one matcher. Button marks include human reaction delay and must be replayed/edited before verification.

## Preservation, rights and review

Bass detector code, Melody code, priority merger and render scheduler were not changed. Melody remains disabled in the listening build. The cached listening fixtures include previously recorded Bass timestamps without retraining Bass; they are not a Bass quality claim. The five-row/eight-cell semantic renderer and accepted animation lifetime/debounce fixes remain intact.

The reference ADTOF ONNX hash remains `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a` in both original model and preserved baseline bundle. Only private config opts into the student. Neither its weights nor the private cache/audio are included in a published Companion or app update.

The original [ADTOF repository](https://github.com/MZehren/ADTOF) explicitly identifies CC-BY-NC-SA-4.0; the [PyTorch port](https://github.com/xavriley/ADTOF-pytorch) describes conversion of those pretrained weights. Distillation is not assumed to remove those obligations. Training-audio commercial rights are also not established. Keep both candidates private until appropriate rights are secured.

Scoped review checked private-only routing, schema validation, independent classes, source teardown and startup causality. The simplifier made readability-only edits; its sandboxed test attempt could not start because of temporary-file rename restrictions. The tests were rerun successfully outside that restriction. A new test's unknown-JSON type error was corrected, and type checking passes.

## Listening and reproduction

Open [the private comparison](http://127.0.0.1:5173/src-tauri/target/percussion-closure/listen.html?musicDebug=1&musicFourRows=1). Its selector compares cached ADTOF, causal student and the preserved streaming ADTOF reference. Pause other audible music to compare the excerpt by itself. Native media controls use the real timeline, playback rate and volume. Export render traces or independent annotations from the page.

The optional unpacked student Companion is `src-tauri/target/percussion-closure/companion`, named **Kora Music Companion — Causal Closure Test**, version 0.3.14 with a private test name. The comparison page can run without importing it. Original reference: `src-tauri/target/percussion-latency/candidate`; preserved original bundle: `src-tauri/target/percussion-latency/baseline-companion`.

Reproduction commands are owned by `scripts/train-causal-percussion.py`, `evaluate-causal-percussion.py`, `package-percussion-listening.mjs`, `prepare-percussion-closure-listening.mjs`, `check-percussion-delivery.mjs`, `check-percussion-listening.mjs` and `summarize-percussion-comparison.mjs`. Do not retrain automatically. Private machine-readable artifacts live under `src-tauri/target/percussion-closure`: `comparison.json`, the three `matched-*.json` traces, `results.json`, `model/training.json`, `streaming-parity.json`, `listening-check.json` and `annotations.template.json`.

Regression validation: **104 test files / 747 tests passed**. Focused post-review tests and type checking passed. Scoped JavaScript/TypeScript lint and Python syntax checks passed. The verification web build passed with existing chunk-size/plugin-timing warnings; no release was published. Playback checks observed zero new flashes while paused, successful seek/resume, source switching, cached semantic rendering and human-annotation export.

## Sustained resource addendum

The final isolated Edge run repeated the same 20-second audio for **610 seconds**, with pause/resume, backward/forward seek and playback-rate changes early in the run. It produced 3,346 raw percussion events and 3,314 DOM/animation events. There were zero browser errors, zero bridge drops and zero maximum inference queue depth. The ten complete minute bins contain 320, 325, 324, 328, 329, 327, 325, 333, 319 and 330 animations, followed by 54 in the final partial minute: no unrecovered delivery freeze was observed. The unchanged merger reports 32 semantic duplicates; the scheduler reports two resets. Source switching was checked separately in the private listening-page lifecycle test.

Worker batch time is **0.7 / 1.1 ms median/p95**, with **3.66% measured inference busy time**. Timestamp-to-animation lag is **70.4 / 87.7 ms median/p95** over the sustained run. UI/capture-page task durations are 50.58 / 29.34 seconds over 610 seconds; these are browser task measurements, not whole-system CPU percentages.

Sampled capture-page heap p95 is **43.0 MiB**, maximum 57.2 MiB. Final CDP heap readings after extracting/serializing complete traces are approximately 71.9 MiB for UI and 187.7 MiB for the capture page. The probe intentionally retains raw scores, transport traces, animations and pending-delivery promises for export. Those figures therefore do not isolate production working memory or prove a leak-free memory bound. Weak-device testing remains open. The original sustained attempt was invalidated by a development-server reload while implementation files were edited; the final run above was repeated after edits stopped and completed successfully. Its owned browser closed normally; the existing preview server remains available for listening.

Evidence: private `browser-sustained.json` and `sustained-summary.json`. This is a repeated local excerpt, not a ten-minute natural track, live-provider endurance test or physical audio/display measurement.

## Unresolved decisions

The smallest available choices are to continue private cached-range listening with the preserved teacher, or separately authorize work with independently labeled training data and appropriately cleared model/audio rights. The current causal student must not be adopted merely because its timestamp delivery is fast. User listening, positive labels, brass/roll references, real weak-machine testing and production rights remain open. No further model iteration, Melody work, Phase 5 or production release starts automatically.
