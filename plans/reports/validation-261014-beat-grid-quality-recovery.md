# Beat Grid quality recovery — bounded validation

**Decision: not qualified for production release.** The event merger had a reproducible rapid-hit loss and is repaired on `codex/beat-grid-quality-recovery`. Detector precision/recall, perceived synchronization, and live-session stability remain unverified or below target. No model parameters, audio buffering, production service, installer, or deployed site changed.

The subsequent private listening test also failed: the user heard late flashes, wrong instrument flashes and missed attacks. This is a **technical no-go for the current live, unbuffered learned-percussion path**, pending independent accuracy labels and a different synchronization mode. This report combines the verified merger repair and the bounded follow-up investigation.

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

## Real-world negative controls and first failure stage

The user's original local MONO recording was decoded to 44.1 kHz stereo PCM and replayed through the shipped AudioWorklet, ONNX model, peak classifier and React grid. For its first 13 seconds, which the user reported as percussion-free, raw learned detection produced Kick 0, Snare/Clap 0 and **Hat 1 at 8.001 s**. Its five uncalibrated class activations were `[0.0049, 0.0075, 0.0734, 0.2036, 0.4263]`; the final value is the cymbal class, mapped to Hat. Its novelty margin above the existing threshold was 0.0345. This is a typed false event **before** merger, scheduler or renderer. The measured rate on this short absent-class interval is 4.6 false Hat events per minute; it is not an estimate for a whole song. A prior saved prediction placed a Hat at 7.74 s, but the extraction/encoding offset between that file and this decode has not been verified, so the two times are not asserted to be the same acoustic instant.

The user's Bích Phương recording, first 13 seconds, produced Kick 0, Snare/Clap 0 and Hat 0 in the same isolated local path. This does not invalidate the older live-browser report of false flashes: the loaded extension, source clock and delivery mode of that session were not available for direct inspection. A separate eight-second drum-stem replay produced 26 learned events, and a full-mixture replay produced 23, without worker failure or queue buildup. Those are activity counts only; no human-checked positive onset list exists for them. Vocal-only input produced zero typed drums in this replay. Bass was not changed or scored.

The current model has an explicit no-event/abstain outcome, but no calibrated percussion-versus-nonpercussion probability. Each of the five classes is peak-picked independently, with cymbal and hat both mapped to Row 3. Peak groups and deduplication are per class and exact output timestamp; adjacent cymbal/hat peaks can therefore yield two Row 3 events. The saved predictions contain close pairs, but no independent labels establish whether those are one acoustic attack or two, so no speculative cross-class suppression was applied. The earlier merger repair still preserves valid 20–50 ms same-row attacks.

## Timing attribution and architecture limit

The eight-second real-model replays were instrumented at the existing worklet/worker boundary. For 26 drum-stem events, predicted-onset-to-available-audio lookahead was median 193 ms and p95 **213 ms**; worker inference was median 24 ms and p95 29 ms; Worklet→Worker, worker queue and Worker→Main were each at most about 1 ms at p95. Predicted-onset-to-main receipt was p95 **240 ms**, and predicted-onset-to-visible-DOM flash p95 **249 ms** in the instrumented run. The 23-event mixture showed p95 213 ms lookahead, 30 ms inference, 241 ms receipt age and 241 ms visible age. Stage percentiles are not additive; the event-age measurement is the end-to-end figure within this isolated path. The MONO false Hat alone had 173 ms lookahead and 210 ms receipt/visible age, which cannot support a percentile claim.

These timestamps share the browser's AudioContext clock for audio age; JavaScript wall-clock stage stamps have millisecond resolution. The harness bypasses the Companion bridge and event engine, so it does not measure browser-tab switching, speaker-to-pixel presentation, or physical A/V sync. A repeat of the default three-fixture run failed during Vite packaging with `EPERM realpath ... percussion-worker.js` in the sandbox; its earlier successful instrumented run remains saved in ignored local diagnostics. The focused scorer and 26 merger tests passed. No process was left listening on the harness port.

The 100-frame sliding window, five-frame step, ten-frame right context and future-frame peak finalization explain the dominant delay. With measured event lookahead already above 200 ms at p95, this implementation cannot meet a 50 ms **live unbuffered** audio-to-flash target by changing only transport or rendering. The older causal student failed the percussion accuracy gate and was not adopted. A precomputed EventTrack could avoid inference lookahead during playback, but same-source cached replay and physical display timing were not verified here. Controlled audio-only buffering might compensate, but Kora does not own the output clock for arbitrary provider video; delaying that path would risk lip-sync and provider-control violations. Neither strategy was presented as a passing mode.

## Reference integrity, bounded decision and remaining gates

The existing `percussion-human-annotations*.json` exports mark wrong flashes rather than complete audible-onset lists. The scorer now requires an explicit `purpose: "audible-onset-reference"` plus human verification and complete per-row arrays, and the existing private annotation page emits that purpose for newly checked exports. Older wrong-flash exports return `not-complete-onset-reference`; they cannot silently become precision/recall data. No complete frozen positive corpus was produced, so per-class precision, recall, F1, soft-hit loss and false-class confusion are **BLOCKED**, not zero. No detector thresholds, weights, peak logic or musical timestamps were changed. Without valid labels, a peak-picker change or second model would be unmeasurable against the requested gate and was not attempted.

| Gate | Final status | Evidence or limitation |
| --- | --- | --- |
| Rapid-hit integrity | **PASS** | Same eight local Hat events: 6/8 before, 8/8 after `fe050c8`; 26 focused merger tests pass. |
| Known absent-class control | **FAIL** | One learned Hat/cymbal semantic event in user-reported drum-free MONO 0–13 s; Bích Phương 0–13 s clean in this replay. |
| ≥90% precision and ≥85% recall per percussion class | **BLOCKED** | Wrong-flash markers are not complete references; positive onset labels and frozen validation split unavailable. |
| Live unbuffered synchronization ≤50 ms p95 | **FAIL** | Isolated predicted-onset-to-DOM p95 241–249 ms; full physical presentation remains unmeasured. |
| Cached/precomputed synchronization ≤50 ms p95 | **BLOCKED** | No same-source cached replay with physical measurement in this task. |
| 30-minute Companion/Web/Desktop stability, source switches and low-end CPU | **BLOCKED** | Only short isolated ONNX runs, no live Companion control or endurance profile. |
| Public redistribution | **BLOCKED** | Installed ADTOF-derived manifest specifies `CC-BY-NC-SA-4.0` and `local experiment only`; rights have not been cleared. |

Private source state: `codex/beat-grid-quality-recovery` with the repaired event engine at `fe050c8`; follow-up changes are diagnostic instrumentation, reference-scoring safety and this report. The user-owned private Kora process remained running. The computer-use runtime stopped Edge inspection because it could not determine that browser's current URL with sufficient confidence, so the actual loaded Companion ID, live capture mode, and user-session C0–C9 waterfall remain unverified. No production publication or updater change was made. Raw PCM, per-event traces and model timing data remain under ignored `scratch/`.
