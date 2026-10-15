# Whiplash stress test and architecture decision

**Decision: production release remains NO-GO. Accuracy and physical synchronization remain BLOCKED.** The October 15 annotations are explicitly provisional. They support investigation, not official Precision, Recall or F1. A proved controller rounding loss was repaired; detector thresholds and weights remain unchanged. A fixture-owned buffered audio experiment improves software synchronization, without establishing physical acceptance. Nothing was deployed.

## October 15 follow-up: provisional annotations and actual pipeline

The original user export is preserved unchanged in private scratch storage. Its SHA-256 is `32e559741875798f7a3970814ce25a478a719a7765f5d291207eb12e4f2171ef`. All eleven exports have `verified:false` and null public row arrays, but six contain typed observations inside `draft`. Those observations were recovered without treating missing rows as absence. Source hashes and excerpt intervals match the prepared benchmark.

| Input with typed draft data | Raw observations | Repeated marks | Marks at excluded end boundary |
| --- | ---: | ---: | ---: |
| W1 | 81 | 0 | 1 |
| W3 | 38 | 4 | 0 |
| Levels | 8 | 0 | 1 |
| Trap | 84 | 5 | 0 |
| Rock | 54 | 1 | 1 |
| Weightless | 11 | 0 | 0 |

All **276 observations** remain `provisional-human-reference`, `verified:false`, `purpose:investigation-only`, and ineligible for official scoring. Ten repeated marks and three marks at exactly 12.000 seconds are preserved and flagged, not silently deduplicated or clamped. Empty W2 or other rows do not establish silence or complete coverage.

Each observation carries unassessed audibility, uncertain instrument identity, unverified timing and unknown onset uncertainty. Every excerpt has an explicit interval describing unknown coverage/timing; it is annotation uncertainty, not a claim that all sound in the interval is acoustically ambiguous. The review page now supports optional row confidence, estimated timing uncertainty and explicit masked/ambiguous intervals. Every export stays provisional even when preliminary completeness boxes are checked. Structured `provisionalRows` preserve typed observations independently of those boxes, and the original draft text remains available.

The official scorer rejects provisional data before any matching, even if a conflicting field says `verified:true`. It also refuses old completeness-only exports. A separately verified subset must explicitly identify `verified-ground-truth`, complete coverage of all three rows, independent listening/waveform review, reviewer/method, matching source/PCM hashes, resolved ambiguity, and a reviewed onset-uncertainty bound of at most **10 ms**. This is an evaluation policy for a ±50 ms scoring window, not a measured property of the submitted clicks. The current guard run returns **zero verified inputs and eleven pending inputs**, with no accuracy metrics.

A separate [verification queue](../../scratch/whiplash-provisional-investigation/verified-subset.pending.json) contains **no verified entries**. A truthful verified acoustic subset could not be created from this incomplete, imprecisely timed export. An independent reviewer must establish a smaller unambiguous interval, accurate sample/waveform onset positions and complete row coverage before it is promoted; otherwise it stays pending. No model prediction is copied into reference notes.

### Investigation evidence without accuracy claims

[The investigation script](../../scripts/inspect-provisional-percussion.mjs) exactly reproduces the unchanged classifier's saved outputs for all eleven activation streams before inspecting cases. Its ±150 ms navigation windows are review aids, not matching tolerances or measured human-error bounds. It never assigns unmatched model predictions as false positives, calculates official accuracy, or changes thresholds.

Examples from the private [case ledger](../../scratch/whiplash-provisional-investigation/review-cases.json):

- W1 Snare mark **4.092 s**: the strongest nearby Snare novelty is 0.0649 against the unchanged 0.24 criterion, with Kick and Hat emissions near 4.05 s. This localizes a potential classification/identity problem upstream of transport; it does not prove an audible Snare was missed or that brass caused the activation.
- W1 simultaneous marks near **5.684 s**: nearby Kick and Snare novelty remain below their respective criteria. This is a useful passage for resolving weak-hit masking, onset placement and instrument identity before considering any detector change.
- W1 Hat mark **6.811 s**: nearby Hat/Cymbal novelty maxima are 0.0807 / 0.2290 against 0.22 / 0.30; Snare events occur in that window. The evidence narrows the investigation to the learned activation/peak path or provisional label interpretation, not downstream loss of an already emitted Hat.

A separate controlled **activation-stream** probe emits only one accepted event for two 0.9 Snare impulses 20 ms apart; 30/50/100 ms pairs emit both. The classifier's two-frame neighborhood/grouping explains this algorithmic limitation. These are not independently verified acoustic attacks in Whiplash, so this does not count natural musical misses or justify threshold tuning. Candidate B/C remain unevaluated against official musical accuracy.

### Confirmed controller loss and repair

The prior event-merger repair is preserved. A new regression through the actual controller, both directly and through the event engine, sent eight independent local events at 20/30/50/100 ms separations. At timestamps **10.000 and 10.020 s**, floating-point subtraction is slightly less than `.02`; the controller discarded the boundary hit. The unchanged code delivered **7/8**, even though the merger preserved the events.

[The controller repair](../../src/features/music/useMusicBeatSync.ts) allows one nanosecond of arithmetic roundoff at its existing 20 ms comparison. It does not change learned thresholds, onset timestamps, the event engine's 1 ms same-source reconciliation or cached-event handling. The identical regression now delivers **8/8** with and without the engine; a separately tested 10 ms same-row duplicate is still rejected. These tests prove transport behavior, not musical correctness of detector events.

### Production-module pipeline replay

[The expanded harness](../../scripts/verify-beat-pipeline.mjs) drives a real PCM-backed MediaStream through the production capture engine, feature extractor, ONNX worker, classifier, public message-envelope parser, event engine, scheduler, controller and normal renderer. Its only adapters replace capture permission/input acquisition and Chrome IPC with local PCM and an in-process message envelope. It does not test real extension IPC, provider clock acquisition, OS native capture or physical presentation. The capture analysis runs in monitor-only mode while a separate fixture-owned audio branch controls playback.

| Input | Detector events | Observed bright semantic flashes | First downstream loss | Predicted onset→DOM p95 / p99 |
| --- | ---: | ---: | --- | --- |
| W1 | 68 | 68 | None observed | 251.6 / 252.1 ms |
| W2 | 83 | 83 | None observed | 250.0 / 250.1 ms |
| W3 | 89 | 89 | None observed | 240.8 / 248.9 ms |
| MONO | 1 | 1 | None observed | One event, not a reliable percentile |
| Trap | 68 | 67 | Controller `debounce` | 251.1 / 251.3 ms for visible events |

All 309 detector events have trace IDs; all 308 observed flashes have their own event identity. No trace-ring eviction or worker failure was reported. The Trap loss is precisely located: two model Hat-row events at **9.880 and 9.890 s** survive the merger, and the controller rejects the second under its existing sub-20 ms policy. The reference cannot establish whether this is a duplicate Hat/Cymbal interpretation of one sound or two genuine attacks. That policy was retained rather than silently reversing an unverified musical decision.

Whiplash predicted-onset→model-receipt p95 is 238.5–241.4 ms. Model-receipt→visible-DOM p95 is about 11.6 ms. The detector/finalization path still dominates; faster React alone does not repair the synchronization problem. Stage percentiles are not additive. The full private [trace export](../../scratch/whiplash-pipeline-proof/result.json) records each onset, capture send, receipt, scheduling, acceptance/first drop and visible-DOM observation. Repeated renderer records for geometry cells are not counted as additional musical events.

The stream graph's FFT phase and startup context differ from the earlier direct-buffer harness, so detector counts differ slightly across replays. These counts are not an A/B accuracy comparison. The PCM hashes and unchanged model hash are recorded. The playback clock continues through a short silence drain to observe final decisions; real end/pause behavior remains a separate lifecycle gate.

### Bounded audio-only buffering experiment

The fixture's own output branch uses an actual **320 ms DelayNode**. Analysis receives the original PCM immediately, and event scheduling uses the delayed playback clock. The fixed bound was chosen from the observed ~252 ms unbuffered p99 plus ~68 ms headroom, not from provisional click positions. Original model onset timestamps and source start remain preserved; the export separately records the expected delayed audible target.

| Whiplash window | Visible events | Predicted source-onset→DOM p95 | Delayed AudioContext-target absolute error p95 / p99 |
| --- | ---: | ---: | ---: |
| W1 | 68/68 detector events | 332.2 ms | 12.2 / 20.8 ms |
| W2 | 83/83 detector events | 331.5 ms | 11.5 / 19.6 ms |
| W3 | 92/92 detector events | 340.4 ms | 20.4 / 21.0 ms |

No observed Whiplash software error exceeded 50 ms in this run. The MONO event also remains present and is now scheduled with the delayed clock: synchronization does not fix instrument classification. These are **AudioContext-to-DOM observations**, not speaker-to-display measurements. They do not qualify physical p95, actual acoustic onset labels, long stalls, pause/seek continuity, devices or release readiness. The buffered run's detector counts are not evidence of better accuracy; the detector was unchanged.

**Architecture direction:** bounded pre-analysis buffering is technically promising for a genuinely Kora-owned audio-only player. It introduces 320 ms of playback delay in this experiment and needs authoritative output-clock, lifecycle and physical verification before product support. It is not applied to arbitrary tab/native/provider video audio. Independently verified cached events remain another unqualified option; no verified EventTrack was manufactured from ADTOF or the provisional marks. Live unbuffered ADTOF remains a NO-GO for a synchronized claim.

### Follow-up artifacts and validation

- [Normalized provisional references](../../scratch/whiplash-provisional-investigation/provisional-references.json), [case ledger](../../scratch/whiplash-provisional-investigation/review-cases.json) and [scoring guard result](../../scratch/whiplash-provisional-investigation/scoring-guard-result.json) retain uncertainty and produce no official accuracy scores. The user's Downloads file is unchanged.
- [Pipeline summary](../../scratch/whiplash-pipeline-proof/summary.json) and [buffered summary](../../scratch/whiplash-pipeline-proof/summary-buffered.json) accompany raw per-event exports. Run `node scripts/verify-beat-pipeline.mjs` on free localhost port 1432. Optional `KORA_BEAT_PIPELINE_INPUTS=W1,W2,W3,mono,trap` selects fixtures; `KORA_BEAT_PIPELINE_DELAY_SECONDS=0.32` selects the private buffered experiment, saved separately as `result-buffered.json`. Audio and traces remain ignored private artifacts.
- Run `node scripts/inspect-provisional-percussion.mjs --annotations <export-path> --benchmark scratch/whiplash-benchmark --output scratch/<private-investigation-directory>`. It validates audio identity and classifier replay before creating review cases. Do not mistake its navigation windows or emitted counts for one-to-one matching results.
- The 59 focused hook/merger/scheduler checks pass. Final validation passes **845/845 Vitest tests across 111 files**, plus **15/15 Node scorer/export/normalization tests**. App typecheck, Companion packaging, local production build and bundle budget pass; the main entry is 705.5 KiB against a 976.6 KiB budget. Lint exits successfully with zero errors and the same 25 existing warnings. Build output retains its Vite configuration/chunk-size warnings. The full suite initially found two outdated scoring fixtures; they were updated to supply the now-required independent-review evidence while retaining their one-to-one matching, semantic-row and missing-label assertions. Logs remain in private `scratch/whiplash-provisional-investigation/`.
- Local diagnostic processes used port 1432 (PIDs 32632, 31952, 18564) and closed their browsers and servers on completion. No review server or new background watcher is retained. No audio/model assets were committed or uploaded; no production service or deployment changed.

## October 14 baseline context

The sections below preserve the earlier isolated baseline and its historical gates. The follow-up above supersedes its annotation-export policy and adds production-module and buffering evidence. It does not promote the historical or current reference gate to PASS.

## Recording and independent references

The source is the supplied `Downloads/Whiplash.mp3`, 2,770,579 bytes, 44,100 Hz stereo MP3. FFmpeg 7.1 reports a container duration of 115.41 seconds and decodes 115.3799546485 seconds. Source SHA-256:

`c8626d3902002e0b2dca318fe8211565ccd4603e7467b998e307918291be675f`

The local file has no artist/album tags. Its duration is consistent with the [soundtrack's 1:55 listing](https://open.spotify.com/album/6g42oKg0CnLrN7UWZAAj7K), and the [label-provided recording](https://www.youtube.com/watch?v=-jAtHf9RA4w) identifies Hank Levy and the 2014 soundtrack. This supports a provisional identification, not proof that the local bytes encode that exact performance. The user must confirm the recording identity. No remote audio was downloaded.

| Draft excerpt | Decoded source interval | Intended review |
| --- | --- | --- |
| W1 | 8–20 s | Ensemble/brass interference and simultaneous rows |
| W2 | 60–72 s | Dense percussion, weak attacks and close attacks |
| W3 | 95–107 s | Irregular meter, rests and transitions |

These fixed exploratory windows were selected before inference. They have **not** been verified as the fastest passage, a 7/4 example, or complete coverage of the requested phenomena. The reviewer should reject unsuitable windows. No claim is made that Whiplash contains measured 20/30/50/100 ms acoustic pairs.

The user confirmed they can review new excerpt annotations. The private [review page](../../scratch/whiplash-benchmark/review.html) contains original decoded audio, a waveform, slow playback, editable excerpt-relative timestamps, combined Hat/Cymbal labels, optional audible subtypes and explicit ambiguous/masked-event fields. It shows no model predictions. Rows begin unknown, not empty. Verification requires explicit complete-row checks, source identity, coverage notes, reviewer identity and resolved ambiguity. Draft export/import preserves work; export before closing. Marking while playing includes human reaction delay and needs correction by replay.

No reference notes have yet been asserted or frozen. The two existing Downloads annotation exports remain wrong-flash markers, not complete references. After review, record the exact exported reference-file SHA-256 before any Candidate B/C comparison. If the draft windows change, regenerate the audio and baseline for the new intervals first.

Private [manifest](../../scratch/whiplash-benchmark/manifest.json) SHA-256:

`c6fc864fc3748b27f21c4ac6143e4aa03ba24ff3894fb7dffb908c7e57b6dd50`

The manifest binds nine source-file hashes, complete decoded-PCM hashes, eleven excerpt PCM/WAV hashes, decoder version and exact offsets. Review WAVs are 16-bit conversions of float32 inference PCM with the same sample timeline; amplitude is rounded/clamped for WAV playback. An independent second preparation reproduced identical manifest bytes. Source and excerpt hashes and all sample lengths were checked.

## Candidate A baseline and failure attribution

The real shipped feature extractor, AudioWorklet, ONNX/WASM worker, classifier and React grid ran in headless Edge 155.0.4283.45. Eleven separate, non-looped fixtures supplied 134 seconds of music. All 518 emitted events were observed as bright semantic DOM flashes; no worker failure, activation/event-export truncation, or reported queue growth occurred. This establishes delivery in this **isolated diagnostic**, not musical accuracy or full production delivery.

The harness bypasses real Companion capture/transport, the media bridge, event engine, scheduler and controller. Those stages cannot be exonerated by this replay. The isolated input also starts each excerpt without the preceding song context; a later full-pipeline accuracy comparison must hold context and edge policy fixed across candidates. All original audio onset labels remain unknown until independent review.

| Excerpt | Predicted Kick / Snare / Hat | Reference TP/FP/FN | Predicted-onset→DOM p95 / p99 |
| --- | --- | --- | --- |
| W1 | 19 / 23 / 27 | BLOCKED | 240.7 / 241.7 ms |
| W2 | 31 / 18 / 35 | BLOCKED | 238.7 / 240.0 ms |
| W3 | 36 / 38 / 13 | BLOCKED | 239.4 / 259.9 ms |

These are prediction activity counts, not stress-test scores. Brass misclassification, masked true hits, natural rapid-hit suppression and absent-class false-event rates within Whiplash cannot be attributed without the complete reference. Per-class accuracy, confidence intervals and dense-passage acceptance remain BLOCKED.

The known MONO 0–13 s control reproduces one Hat/Cymbal event at **7.740 s relative to the source**, with class activations `[0.004864, 0.007473, 0.073432, 0.203608, 0.426301]` and peak margin 0.034538. Given the user's earlier identification of this interval as drum-free, this is a detector/classifier false event before downstream transport. Its observed rate is 4.62 false Hat events per absent-class minute on this short interval only. The PCM hash exactly matches the previous MONO fixture. The source-origin instrumentation removes AudioContext startup time from musical timestamps; original event, decision, receipt and DOM clock values remain preserved.

The newly identified `Những Lời Hứa Bỏ Quên.mp4` control produces one Hat/Cymbal event at 4.700 s. Its PCM hash differs from the earlier Bích Phương fixture that produced zero events. These are different inputs; this result does not reverse the earlier verified result and cannot be labelled a false positive without review.

## Latency and synchronization architecture

| Whiplash stage, p95 | W1 | W2 | W3 |
| --- | ---: | ---: | ---: |
| Available audio minus predicted onset | 213.2 ms | 213.2 ms | 213.2 ms |
| Classifier decision-frame minus predicted onset | 50.0 ms | 50.0 ms | 50.0 ms |
| Worklet→Worker | 1 ms | 1 ms | 1 ms |
| Worker queue | 0 ms | 1 ms | 1 ms |
| ONNX inference | 20 ms | 19 ms | 27 ms |
| Worker→Main | 1 ms | 1 ms | 1 ms |
| Predicted onset→Main receipt | 240.2 ms | 229.4 ms | 238.6 ms |

Stage percentiles are not additive. Decision-frame lookahead is an audio-index distance, not a wall-clock model completion time. The raw export retains frame activations and, for every emitted event, predicted onset, source-relative onset, decision frame, available audio, worker wall-clock stamps, main receipt and visible-DOM audio clock. No onset was relabelled as receipt time. Source start is scheduled explicitly and the harness drains 500 ms after the observation duration to finalize tail attacks.

| Mode | Decision and applicable sources |
| --- | --- |
| A: live unbuffered | **NO-GO for a synchronized claim with current ADTOF.** The observed ~239–241 ms Whiplash DOM p95 greatly exceeds 50 ms. Arbitrary captured music may remain an explicitly delayed detection path, but these results do not qualify it as synchronized. |
| B: controlled audio-only buffering | **BLOCKED.** Only applicable where Kora owns the audible output path and clock. No buffering experiment or bound was validated. Existing tab/native/provider capture must not silently acquire independent audio delay, especially with video. |
| C: independently verified cached EventTrack | **BLOCKED; conditional target architecture for controlled playback.** Advance scheduling can avoid inference lookahead when the exact recording has independently verified events and an authoritative playback clock. No such verified track or physical presentation measurement exists here. ADTOF cache predictions are not reference notes. |

No synchronized mode is accepted for release. Physical speaker-to-display p95/p99, missed physical deadlines and user-listening acceptance remain BLOCKED. Headless muted playback cannot measure them. Pause, seek, capture replacement, rapid events and stale-backlog handling have focused software coverage; that does not replace live source-switch or Desktop integration measurements.

## Bounded candidates and general-music regression

| Candidate | Per-class precision/recall | Decision |
| --- | --- | --- |
| A: existing ADTOF | BLOCKED without complete references | Timing baseline measured; known MONO failure retained |
| B: one onset-guided peak-selection change | Not evaluated | Gate 1 is not frozen; no speculative threshold/peak change |
| C: one verified lower-latency alternative | Not evaluated | No frozen comparison corpus or qualified alternative established; the old causal JavaScript implementation is not accepted as a trained model |

The candidate budget remains unused beyond A. No tuning loop has been opened. A detector choice cannot be inferred from visual activity.

| Regression input and source interval | Predicted Kick / Snare / Hat | Accuracy decision |
| --- | --- | --- |
| MONO, 0–13 s | 0 / 0 / 1 | Known negative-control failure; complete reference pending |
| Bích Phương candidate, 0–13 s | 0 / 0 / 1 | Identity and reference review pending |
| Avicii — Levels, 45–57 s | 7 / 22 / 33 | BLOCKED |
| Lil Uzi Vert — XO Tour Llif3, 45–57 s | 16 / 8 / 39 | BLOCKED |
| Muse — Hysteria, 45–57 s | 26 / 18 / 33 | BLOCKED |
| Coldplay — Yellow, 45–57 s | 18 / 8 / 37 | BLOCKED |
| Satie — Gymnopédie No.1, 0–12 s | 0 / 0 / 0 | No false activity observed; drum-free reference confirmation pending |
| Marconi Union — Weightless, 0–12 s | 11 / 0 / 0 | BLOCKED; predictions do not establish genuine Kick |

Pooled Whiplash activity is 86 Kick / 79 Snare / 75 Hat; regression activity is 78 / 56 / 144. These totals are not pooled precision/recall. Independent general-music regression acceptance and per-class coverage are BLOCKED until references are complete. A few negative controls cannot certify class recall or prevent overfitting.

## Integrity, runtime, rights and packaging

The rapid-hit repair remains unchanged. All **42** event-engine/scheduler tests pass, including distinct 20/30/50/100 ms local events, retransmission and cache reconciliation, simultaneous rows, seek/pause/capture recovery and stale-backlog rejection. These controlled events test delivery, not acoustic discrimination at those separations.

Model bytes were verified against manifest SHA-256 `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`. The manifest still declares `CC-BY-NC-SA-4.0`, `local experiment only`, 100 input frames, five-frame steps and ten-frame right context. Model redistribution/production rights are **BLOCKED**, not cleared by this local test. Private audio, model assets and raw traces remain ignored; no installer, updater, production site or remote service was changed.

The current 134-second diagnostic does not establish 30-minute real Companion/Web/Desktop stability, CPU/memory endurance, supported-device performance, source-switch or capture-recovery integration. A prior saved 30-minute repeated-stem diagnostic exists, but is neither a fresh Whiplash endurance run nor full integration acceptance. These requested gates remain BLOCKED.

Seven reference-export/scorer tests pass; changed JavaScript lint and diff checks pass. Initial pnpm canonicalization, Vite worker resolution and Vitest temporary-directory permissions failed in the sandbox. Vitest passed with workspace-local temporary storage; the authorized local Vite diagnostic passed outside the filesystem sandbox. The Browser skill's module import separately failed with `EPERM`, so interactive review-page browser QA is **unverified**; its export-integrity logic was tested with jsdom. A Windows newline mismatch found in the generated manifest digest was fixed by hashing the actual on-disk bytes and verified by independent regeneration.

The diagnostic processes logged PID 33424 for the exploratory run and 38188 for the aligned run, port 1431, in this checkout. Both harness sessions completed and closed their browser/server; ports 1431 and 1432 have no remaining listener from this work. No background review server was started.

## Artifacts and reproduction

- Preparation: [prepare-whiplash-benchmark.py](../../scripts/prepare-whiplash-benchmark.py), using `python scripts/prepare-whiplash-benchmark.py --downloads <Downloads-path> --ffmpeg <ffmpeg-executable> --output scratch/<new-private-directory>`. Existing output is deliberately not overwritten.
- Review: open [review.html](../../scratch/whiplash-benchmark/review.html) in a normal browser, review W1/W2/W3 first, and export `whiplash-onset-references.json`. Keep the WAV files beside the HTML. Only explicitly reviewed complete rows may be checked; pending/ambiguous drafts are allowed.
- Baseline: [candidate-a-aligned-runtime.json](../../scratch/whiplash-benchmark/candidate-a-aligned-runtime.json), [summary](../../scratch/whiplash-benchmark/candidate-a-summary.json), and [source-relative predictions](../../scratch/whiplash-benchmark/candidate-a-predictions.json). The earlier exploratory `candidate-a-runtime.json` lacks a source origin and is not the scoring export.
- Runtime harness: [verify-beat-runtime.mjs](../../scripts/verify-beat-runtime.mjs). Copy prepared `.f32` fixtures into `scratch/instrument-proof` with prefix `whiplash-benchmark-`; set `KORA_BEAT_PROOF_INPUTS` to their comma-separated names and `KORA_BEAT_PROOF_FULL_INPUT=1`, then run `node scripts/verify-beat-runtime.mjs`. The harness records source origins, raw activations, timing and model identity; do not run it while port 1431 belongs to another process. Its default result file is `scratch/beat-runtime-proof/result.json`.
- Focused checks: `node node_modules/vitest/vitest.mjs run src/features/music/beat-event-engine.test.ts src/features/music/beat-scheduler.test.ts`; `node --test scripts/score-percussion-annotations.test.mjs scripts/whiplash-annotation-review.test.mjs`.

## Final gate decisions and unresolved questions

| Gate | Status |
| --- | --- |
| Reproducible local input preparation | PASS within the stated private diagnostic scope |
| Gate 1: confirmed recording, representative excerpts and frozen complete labels | BLOCKED on independent review |
| Gate 2: every musical error attributed through the actual full pipeline | BLOCKED for musical correctness and real IPC; production-module replay attributes controlled controller loss and the observed Trap-row drop |
| Gate 3: accepted detector; Whiplash and independent regression scores | BLOCKED; no unsupported precision/recall PASS |
| Gate 4: supported physically synchronized mode | BLOCKED; buffering improves software clock alignment, while physical/output/lifecycle verification is outstanding |
| Rapid-hit merger/controller regression | PASS for the demonstrated 20/30/50/100 ms delivery cases; classifier acoustic resolution is not certified |
| Physical/user acceptance, 30-minute integration, supported devices and release rights | BLOCKED |
| Production-quality release | NO-GO |

Unresolved: Does the local Whiplash file match the intended 2014 recording, and do the windows cover the requested musical cases? What independent listening/sample-level review can establish a small complete verified subset with a defensible timing bound? Does the 10 ms Trap-row pair represent one acoustic attack or two? Which genuinely owned audio output path and physical measurement setup can validate buffering, lifecycle continuity and device performance? The user's provisional clicks are not required to resolve these questions by themselves.
