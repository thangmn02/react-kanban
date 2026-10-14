# Beat Grid quality recovery — bounded validation

**Decision: not qualified for production release.** The event merger had a reproducible rapid-hit loss and is repaired on `codex/beat-grid-quality-recovery`. Detector precision/recall, perceived synchronization, and live-session stability remain unverified or below target. No model parameters, audio buffering, production service, installer, or deployed site changed.

## Baseline and active path

- Base: `fe9b99d` on `main`; source Web/Desktop `0.1.31`, Companion `0.3.24`. The installed `C:\Users\thang\AppData\Local\Kora\kora.exe` identifies as `0.1.31`; inspected installed Companion folders contain `0.3.24`. Which extension is loaded in the user's current browser was not observable in this run.
- For uncached captured music, Companion tab/native capture feeds a 44.1 kHz AudioWorklet, 10 ms spectrogram frames, an ONNX ADTOF-derived percussion worker, peak postprocessing, Companion transport, the event engine, scheduler, and React semantic cells. Bass uses its separate local detector. Cached chunks take priority and carry their own typed EventTrack events. The 100-frame inference window, 5-frame step, and 10-frame right context remain unchanged. Model weights are tagged `CC-BY-NC-SA-4.0` and `local experiment only` in the model manifest.
- Production-bundle verification with the existing `scripts/verify-beat-runtime.mjs` ran the real worklet, ONNX/WASM model and renderer in headless Edge 155 on local PCM; it does **not** exercise a real Companion or event-engine transport. Eight seconds of an isolated drum sample yielded Kick 14, Clap 12, Hat 0; a mixture yielded Kick 14, Clap 7, Hat 2; a vocal stem yielded zero typed drum events. The test inputs have no independently checked onset labels, so these are activity counts, not accuracy scores. The exact user-reported MONO drum-free excerpt has one saved 12-second model Hat prediction at 7.74 s; it is not an independent ground-truth evaluation.

## Confirmed loss and repair

`beat-event-engine.ts` previously treated any two same-row events within 40 ms as duplicates, including independent local predictions. A fixed sequence of eight local Hat events with separations of 20, 30, 50 and 100 ms produced **6/8** rendered semantic events before the change. With same-source reconciliation limited to a 1 ms quantized-onset match, the identical test produces **8/8**. Sequence numbers still reject retransmission; cached event IDs still reject repeated chunk entries; cache/local views of one attack still reconcile within 40 ms. A cache event 25 ms after an already delivered local event remains a single flash. Simultaneous Kick, Clap and Hat retain distinct row identities. This proves a pipeline-loss repair, not that all eight synthetic events are musically correct. Three close same-class pairs in the saved 14-excerpt prediction export are potential beneficiaries; those model predictions are not ground truth.

Changed files: `src/features/music/beat-event-engine.ts` (source-aware duplicate tolerance), its focused test file (rapid local attacks, quantized duplicate, cross-row and cache/local regression), and `docs/beat-event-cache.md` (delivery contract). No detector, thresholds, model weights, Bass, scheduler, or renderer changed.

## Timing and stability evidence

| Path and sample | Detector event age p95 | DOM-bright flash age p95 | Failures / maximum worker queue |
| --- | ---: | ---: | --- |
| Production bundle, 8 s drum stem, 26 events | 240.2 ms | 241.0 ms | 0 / 0 |
| Production bundle, 8 s mixture, 23 events | 241.0 ms | 242.6 ms | 0 / 0 |

The model/inference/postprocessing path accounts for nearly all observed lateness in this isolated replay; the normal React visual step adds relatively little. These values compare the audio context position with event/visible-DOM state. They are **not** physical speaker-to-pixel measurements, and this harness bypasses real Companion transport and the event engine. The 50 ms synchronized-mode gate therefore does not pass. Changing timestamps to receipt time or delaying video/provider audio would conceal or worsen the mismatch; neither was done. No synchronized audio-only mode was validated. The isolated 8-second runs show continuing inference with zero reported failures and no queue growth, but do not establish 30-minute Web/Desktop, source-change, low-end-hardware, or clean-install stability. CPU and process-memory endurance data were not collected.

## Accuracy and release gates

The files `percussion-human-annotations.json` and `percussion-human-annotations (1).json` in Downloads contain 26 entries each, mostly unverified. The few marked verified for MONO, Levels and Weightless are, per the user's clarification, timestamps of **wrong flashes**, not complete reference lists of audible Kick/Snare/Hat onsets. They cannot support one-to-one precision, recall, F1, soft-hit loss, or a per-class confusion matrix. The earlier zero-Hat isolated-drum result likewise cannot be called a Hat miss without annotated Hat hits. No model or peak threshold was tuned from these incomplete labels.

| Gate | Status | Reason |
| --- | --- | --- |
| Event integrity | **PASS for the demonstrated rapid-hit and handoff cases** | Red-to-green regression 6/8 → 8/8; cache/local and cross-row tests pass. |
| Kick/Snare/Hat ≥90% precision and ≥85% recall | **BLOCKED** | No complete independent onset annotations for representative positive and negative excerpts. |
| Physical synchronization ≤50 ms p95 | **FAIL / BLOCKED** | Isolated DOM p95 ≈241–243 ms; no physical speaker-display measurement or compatible buffered mode. |
| 30-minute live stability, Web/Desktop parity, low-end hardware | **BLOCKED** | No sustained authorized live source and device measurements in this run. |
| Production redistribution | **BLOCKED** | Existing ADTOF-derived weights carry noncommercial share-alike metadata; distribution rights need resolution before release. |

Verification: 26 focused event-engine tests passed after the final edit; the broader suite passed **841/841** before the final constant rename and cache-offset test adjustment. `pnpm build` passed, including typecheck and Companion packaging. `pnpm lint` exited successfully with 25 pre-existing React-hook warnings and no errors. Raw production-runtime output remains in ignored `scratch/beat-runtime-proof/result.json`; saved model predictions remain under ignored `src-tauri/target/`. No large generated trace is tracked.

To reproduce the integrity regression: run `pnpm test -- src/features/music/beat-event-engine.test.ts`. To rerun the isolated production-bundle measurement: run `node scripts/verify-beat-runtime.mjs`. A production-release decision requires complete independent onset labels for the requested diverse excerpts, live Companion/Web/Desktop timing including physical display observation, a 30-minute session, and model redistribution clearance. Until then, retain this as a reviewable repair branch rather than claiming the Beat Grid quality program is complete.
