# Candidate-6A: Checkpoint 1 (contour tracking)

**Status: Checkpoint 1 measured. Phase 2 (role scoring) and owner-labelled modern-genre references are next. Nothing committed; not for release.**

## Baseline (frozen)

Candidate-5 is commit `bf99540` (`kora-lead-salience-v1`), ZIP `fb82f602…a6265`. Its rebuild matches byte for byte; the transform keeps candidate-5 output unchanged.

## 6A design

`extensions/kanban-music/lead-contour-tracker.js` (`kora-lead-contour-v1`):

1. **Front end.** Candidates come from 22 kHz analysis with a 2048-point FFT, giving a 93 ms window, an 11.6 ms hop and MIDI 40–96.
   - Up to 5 candidates per frame, each with ≥6 partials and its own fundamental.
   - Partials above 3 kHz must stand ≥9 dB above their neighbourhood, which rejects cymbal and noise "partials".
2. **One owner line.** It follows the strongest candidate within ±12 semitones of its 1.5 s register.
   - An outside line must be ≥1.3× stronger for a cumulative 0.5 s before it takes over.
   - A line that returns within 3 s keeps its identity.
3. **No backlog.** Attacks that began before the current owner was decided are dropped. Attacks not decidable within 150 ms are dropped.
4. **Source is optional.** The runtime has no instrument priority. The label is Vocal only at ≥0.6 confidence, otherwise Unknown. It is carried separately as `sourceTypeConfidence`, next to `contourConfidence`.

**Not done here (from the earlier critique):** linking candidates into persistent independent voices was tried twice and lost. Voices wandered (5 s) or fragmented (0.4 s), and their owner sat on the melody only 8–15% of the time.

## Checkpoint 1: development set

5 MusicDelta mixes, scored against MELODY2 with INTERVALS. Only these were used for tuning.

| Metric | Candidate-5 | 6A |
|---|---:|---:|
| Ownership on melody (exact pitch) | .365 | **.373** |
| Octave errors (up / down) | .033 / .048 | .037 / .048 |
| On-melody run length p50 / p90 (fragmentation) | 35 / 174 ms | **58 / 197 ms** |
| False switches (single-source tracks) | — | 0.8 / min |
| Correct abstention | .806 | **.829** |
| Precision / recall | .492 / .500 | **.554 / .525** |
| F1 at ±50 ms / ±25 ms | .496 / .325 | **.539 / .392** |
| False events on a wrong line / with melody silent | 32 / 35 | **22** / 34 |
| Acquisition p50 / p90 | **52 / 342 ms** | 99 / 1225 ms |
| Decision latency p95 | **81 ms** | 105 ms (cap 150) |
| CPU (one core, Node) | **0.9%** | 1.65% |

## False Melody on the owner's non-melodic stems ("all i need")

Events per minute; any event here is false.

| Stems | Candidate-5 | 6A |
|---|---:|---:|
| Drums (loops, fills, 808s) | 3 | 3 |
| FX (sweeps, noise, impacts) | 10.5 | 6.4 |
| Pads / ambience | 88 | 85 |
| MusicDelta drum-only (development) | 19 | 15 |

Pads fool both candidates. That is the Phase 2 target ("a sustained pad is not Lead").

## Real Kora Windows

- **Setup:** Owner Preview `kora.exe` SHA `199171E0…60F4`, built with test-only `KORA_OWNER_PREVIEW_LOOPBACK=1`, plus Kora Local `VITE_OWNER_PREVIEW_LOOPBACK`. Production code paths are unchanged. Loopback player with the 145 s labelled playlist; isolated test Chrome; Enhanced Beat Sync ON.
- **Time mapping:** the delivered media times include a constant +120 ms. Every candidate is scored with the same shift; the maximum-match sweep gives 0.11–0.12 s for both.

| | Candidate-5 | 6A (frozen, ZIP `e717a9c0…`) |
|---|---:|---:|
| Melody events received | 289 | 262 |
| Precision / recall | .61 / .59 | **.66 / .59** |
| F1 at ±50 ms / ±25 ms | .60 / .34 | **.63 / .44** |
| Companion → Kora (p50 / p95) | 2 / 5 ms | 3 / 5 ms |
| Fifth-row flashes without an event | 0 | 0 |

**Delay OFF:** 0 events and 0 flashes on every row, because the candidate keeps typed rows dark. Real-time worklet decision latency is p50 84 ms and p95 ~105–120 ms. Shown without delay, flashes would land about that late.

## Piano

- **SwingJazz piano lead** (human MELODY2, about 1.17 kHz): ownership is 0 for both candidates. The 3 kHz partial rule that removed drum false positives also removes this high piano's upper partials. Onset precision is .57 for 6A against .46 for candidate-5.
- **Gymnopédie and the second solo-piano clip** (agreement with saved MELODIA output, not truth): 6A .50 / .34 against candidate-5 .45 / .37. 1 switch each.

**Open:** high piano leads need a better high-band test than a prominence threshold.

## Source labels (leave-one-track-out)

- **Vocal:** 90% correct when confident.
- **Piano, guitar, wind:** never confidently correct.
- **Runtime:** Vocal/Unknown only, and never used for ownership.

## Next

1. **Owner labels.** The owner taps about 8 Downloads clips in `scratch/live-lead-261031/label-lead.html`, covering EDM synth lead, trap hook, sampled hook, processed R&B vocal, piano, sax, guitar-backed vocal and pad-only.
2. **Phase 2 role scoring.** First target: pads and accompaniment, where both candidates false-fire about 85 times a minute on pad stems.
3. **Phase 3.** Ownership state machine metrics.
4. **Final held-out.** One run over MusicDelta plus the owner-labelled clips.
