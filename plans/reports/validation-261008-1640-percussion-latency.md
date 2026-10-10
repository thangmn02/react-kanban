# Learned percussion timing and delivery repair — private listening handoff

A private candidate is implemented and checked. It reduces typical latency and
repairs two proven delivery losses, but **does not meet the 80 ms median / 120 ms
p95 target**. Model accuracy and user listening acceptance remain open. No Melody
work, Phase 5, publication, source separation or server/model changes followed.
The prior [learned candidate report](validation-261008-1528-learned-percussion.md)
and original bundle are preserved.

## Changes and scope

- Private bundle cadence: 100→50 ms, with the same 100-frame window, 100 ms
  right context, preprocessing, pretrained weights and class thresholds.
- Timestamped local Kick/Snare/Hat debounce now compares playback targets,
  rather than treating two distinct attacks delivered together as duplicates.
  A failing regression reproduced loss of the second Snare/Hat attack at 50 ms
  spacing. Bass/untimed arrival debounce, cache bypass and 40 ms merger semantics
  are preserved.
- Semantic-only rendering retains a drum row's existing 150 ms flash across
  another row's batch. Previously a committed cell could be removed in 1–3 ms;
  a failing test and actual DOM removal trace reproduce this. Each origin is
  committed once. Earlier expiry cannot erase a replacement event. Owner/pause
  changes cancel pending flashes. Row mapping, 5×8 geometry, Bass/Melody
  presentation and the normal decorative renderer are unchanged.
- Opt-in private feature/worker diagnostics expose batching, inference, raw
  scores and peak decisions without changing the Phase 0 event trace contract.
  Observer exceptions cannot interrupt semantic delivery. Normal capture does
  not collect these raw activation diagnostics or PCM.

Implementation owners: `extensions/kanban-music/percussion-{runtime,features,worker}.js`,
`src/features/music/useMusicBeatSync.ts`, `src/features/music/SemanticBeatPattern.tsx`.
Private packaging/evaluation: `scripts/package-percussion-listening.mjs`,
`scripts/evaluate-percussion-timing.py`, `scripts/check-percussion-delivery.mjs`,
`scripts/summarize-percussion-delivery.py`, `scripts/score-percussion-annotations.mjs`.
Earlier unrelated working-tree changes are preserved; this pass was not committed.

## Measured latency and architectural limit

Owned isolated Edge 154, real local HTMLMediaElement playback/captureStream,
actual AudioWorklet/WASM inference and existing normalization/controller/scheduler/DOM.
Bridge payloads are replayed into the UI, so extension background/native network
transport and the user's YouTube tab are not certified by this probe. Animation
start is measured against the authoritative HTML media clock, not with a physical
speaker/display sensor. Source audio is supplied locally; no downloads/uploads.

| Replay | Raw / DOM / animation starts | DOM median / p95 | Animation median / p95 |
|---|---:|---:|---:|
| Original, Nujabes 12 s | 56 / 56 / 56 | 269 / 308 ms | 271 / 321 ms |
| Final, same Nujabes fixture | 57 / 56 / 56 | 239 / 311 ms | 248 / 322 ms |
| Final, Voodoo People 12 s | 102 / 101 / 101 | 233 / 266 ms | 247 / 273 ms |
| Final, Voodoo repeated 60 s | 540 / 536 / 534 | 234 / 266 ms | 244 / 277 ms |
| Final, Nujabes with 4× capture-main-thread slowdown | 55 / 55 / 55 | 239 / 402 ms | 248 / 411 ms |

Matched median improvement is about 22 ms at animation start; matched p95 is
essentially unchanged. A previous cadence-only replay gave a ~30 ms DOM median
improvement. Browser capture/resampling/window alignment and runtime variation
produce slightly different raw counts between runs; these are not recall scores.
The 60 s stress fixture repeats a known clip; it is not an independent quality set
or an hours-long playback certification.

| Final 60 s stage | Delay / measurement |
|---|---|
| Capture boundary | PCM correlation estimate ~29 ms, similarity .982; uncalibrated |
| Centered feature window | 2048/2 samples at 44.1 kHz = 23.22 ms |
| Trained model right context | 100 ms, retained |
| Frame-batch slot wait | 0–40 ms in 10 ms steps; previously 0–90 ms |
| ONNX inference | 26.7 ms median / 31 ms p95 |
| Worker queue wait | 0 ms median / 1 ms p95; max observed waiting depth 0 |
| Feature→worker / worker→main | Each 0 ms median / 1 ms p95 |
| Peak/group confirmation | 50 ms median / p95 |
| Producer→UI bridge | 7 / 23 ms, includes capture queue plus private payload replay |
| UI receive→controller acceptance | 0 / 1 ms |
| Accepted→state commit | 2 / 2 ms |
| State→cell DOM commit | 1 / 3 ms |
| DOM→animation start | 11 / 15 ms |

Capture correlation is an estimate, not a calibrated physical capture delay.
Other probes estimated ~49–58 ms with lower similarity; do not subtract any of
these estimates from production timestamps. The feature/context/confirmation
floor is approximately **173 ms before inference, transport and paint** for the
unchanged decision rule. A target below 120 ms is not feasible with this profile.

A bounded 20 ms cadence / 40 ms or 20 ms context test was rejected: MONO's
40-second false count rose from 3 to 9 or 22, and vocal-only H.S.K.T. from 0 to
2 or 13. No thresholds were relaxed. Four convolution layers need future
feature context and the recurrent model is bidirectional; removing it is not a
safe timing fix. The smallest existing alternative is EventTrack events ready
ahead of playback. A first uncached live session would require a suitably trained
causal percussion model, or an explicitly approved playback delay. Neither was
introduced; no timestamp shift or playback delay hides the current lag.

## Missing-event breakdown

**C — emitted but dropped:** fixed the reproduced arrival-time debounce loss.
The final 60 s run received 166 Kick / 160 Snare / 214 Hat events; 166 / 160 /
210 were accepted and committed. Four Hat events were explicitly rejected by
the unchanged same-type merger, rather than disappearing. No producer drops,
worker backlog or schedule-late rejections occurred in that run.

**D — visual loss:** before the row-lifetime repair, 524 accepted/committed
events produced 495 animation-start records. DOM observations show the missing
cells removed within 1–3 ms. Afterward, 536 commits produced 534 starts:
165/166 Kick, 159/160 Snare and 210/210 Hat. Both remaining cells were committed
at the end of the 60 s media and removed 13 ms later during the recorded
`CAPTURE_STOP: ended`, so pause/end lifecycle still takes precedence. The final
12-second dense and artificially delayed checks render all accepted events.

**A/B — model versus peak decisions:** still unresolved for the user's audible
misses without independent timestamps. Fourteen same-source 12-second excerpts
have offline raw activations, accepted peaks and browser producer/DOM diagnostics.
The JavaScript classifier reproduces the Python decisions exactly on all 14.
For Voodoo, 31 Snare maxima pass the operating point and 70 positive local maxima
are below it; 22 hat-class and 30 cymbal-class maxima pass, while 52/45 are below.
Adjacent maxima may merge; those counts do not identify true misses. MONO has
zero accepted Kick/Snare and one cymbal-derived Hat in its first 12 s. No calibration
uses these unlabelled maxima as positive ground truth. The model still emits false
low-bass kicks in some negative controls; improved supervised class calibration
or fine-tuning requires independently labelled positives and negatives.

In the earlier 4× delay probe, three producer events were explicitly rejected as
`late` before UI receipt, and remained visible in capture telemetry. The final
4× probe has no producer drops; all 55 reach animation. This demonstrates recovery
and observable late handling, not low-end CPU certification. No scheduler policy
was changed and late events are not called synchronized.

## Negative controls and preserved activity

All 48 exact existing inputs were replayed with 50 ms batching. Across 21 negative
controls: original DSP 1,675 → original learned 66 → final learned **63**
false percussion events, a 96.24% reduction from DSP. Kick / Snare / Hat below;
these are detector event counts, not precision/recall/F1. A=vocal, B=melodic
instrument, C=bass, F=provided non-drum sum; fixture roles never become production
source mappings.

| Negative control | Original learned | Final learned |
|---|---:|---:|
| H.S.K.T. A / B | 0/0/0 each | 0/0/0 each |
| H.S.K.T. C / F | 12/0/0 each | 11/0/0; 12/0/0 |
| Chân Ái A / B | 0/2/0; 0/0/0 | unchanged |
| Chân Ái C / F | 18/1/0; 13/0/0 | unchanged |
| Nujabes A / B / C | 0/0/0 each | unchanged |
| Nujabes F | 1/0/0 | unchanged |
| Chinese pop A / B | 0/0/0 each | unchanged |
| Chinese pop C / F | 3/0/0; 1/0/0 | 3/0/0; 0/0/0 |
| Nujabes guitar / H.S.K.T. other | 0/0/0 each | unchanged |
| Gymnopédie | 0/0/0 | unchanged |
| Bích Phương, user-annotated 0–13 s | 0/0/0 | unchanged |
| MONO, user-annotated 0–40 s | 0/1/2 | 0/1/1 |

MONO's final false rates are Kick 0, Snare 1.5 and Hat 1.5 per absent minute;
Bích Phương is 0 for all three. These short ranges do not establish universal
false-positive rates. Low-bass false kicks remain a known limitation.

| Drum-positive fixture | Original learned | Final learned |
|---|---:|---:|
| H.S.K.T. drums / full mix | 43/27/97; 47/27/75 | 43/29/96; 47/27/72 |
| Chân Ái drums / full mix | 26/16/12; 27/15/16 | 26/17/13; 26/16/15 |
| Nujabes drums / full mix | 26/26/90; 26/29/84 | 26/28/91; 27/29/85 |
| Hysteria | 65/40/71 | 65/40/73 |
| Voodoo People | 83/81/119 | 87/84/115 |
| Take Five | 20/44/106 | 20/48/114 |
| Levels excerpt | 0/0/18 | 0/0/17 |
| XO Tour Llif3 | 53/25/114 | 53/27/114 |

No soft-hit loss or true-hit recall is inferred from total retained events.

## Accuracy gate, performance and verification

The user chose personal listening instead of supplying checked timestamps.
Fourteen original listening controls and an unverified annotation template are
prepared under `src-tauri/target/percussion-latency`. **Independent positive
precision/recall/F1 and model-hit timing error are not available.** The scorer
requires complete typed human annotations, uses one-to-one ±50 ms matching and
does not score model-labelled or unverified references. Every template remains
`verified:false`; unknown labels are null, not empty negative references.

- Final full suite: **102 files / 743 tests passed**; scoped ESLint and production
  build/typecheck passed. Existing large-chunk build warning remains.
- Re-exported PyTorch/ONNX parity: max errors `9.50e-8`, `1.19e-7`; identical
  model SHA256 `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
- Fourteen Python/JS peak-decision cases match exactly. Cadence feature regression
  confirms identical feature values/timestamps with earlier packet delivery.
- Browser queue never grows in the measured probes. Production bounds remain:
  3 waiting blocks, 100 feature frames, 16 classifier frames, ≤5 semantic cells,
  1,024 identity entries and Phase 0's 2,048-record telemetry ring.
- Worker inference wall-time utilization rises from ~28% to ~55% of one worker's
  available second. This is a utilization proxy, not measured machine CPU load.
  Final 60 s main-thread task time: capture 4.88 s, UI 7.29 s. 4× emulation targets
  the capture main thread and does not throttle the inference worker equivalently.
- Capture-realm heap proxy p95: ~34 MB for 12 s and ~115 MB for the 60 s diagnostic
  fixture; final CDP JS heap ~12.3 MB capture / 12.9 MB UI. The longer probe includes
  a larger inline WAV, captured PCM and retained diagnostics. These values neither
  prove a production leak nor certify total browser/worker RAM or weak hardware.
- Owned Edge profiles close in `finally`. The preexisting preview PID 3132,
  `127.0.0.1:5173`, remains for user testing; no duplicate server was started.

## Local test handoff and stop

Load unpacked:
`C:\Users\thang\OneDrive\Documents\react-kanban\react-kanban\src-tauri\target\percussion-latency\candidate`.
Name: **Kora Music Companion — Timing Test**, manifest version 0.3.14. The label
distinguishes it from the normal extension and original Learned Percussion Test.
Disable those other copies first, refresh the music/Kora tabs, then open
`http://127.0.0.1:5173/beat-grid?musicDebug=1&musicFourRows=1`.
Browser tab capture may need one toolbar click on the playing music tab.
Confirm increasing typed counters and `Path: local` when assessing local inference.

Original preserved folder: `src-tauri/target/percussion-latency/baseline-companion`.
The original `src-tauri/target/learned-percussion/companion` also remains unchanged.
Private review audio: `src-tauri/target/percussion-latency/listen.html`.
Raw exports/stage summaries, 48-case results, classifier parity, annotation template
and check logs are in that ignored output directory; no private media/weights are
added to source control. Commands are owned by the scripts listed above.

**Stop for user listening.** Remaining gates: perceptual lag, independently
verified Snare/Hat accuracy, low-bass false kicks, weak-device performance and
model commercial licensing (CC-BY-NC-SA-4.0). Do not declare Phase 4 complete,
publish this model, expand the benchmark or resume Melody/Phase 5 automatically.
