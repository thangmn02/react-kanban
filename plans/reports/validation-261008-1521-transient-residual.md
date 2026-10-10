# Bounded transient-residual repair result

**Implemented and evaluated, but rejected for adoption.** None of the three
bounded variants achieved both the requested negative-control suppression and
real-percussion preservation. The user-facing detector remains exactly the
pre-pass working snapshot. This is an implementation result, not a completed
quality repair or listening release. Automatic tuning has stopped.

## Implementation

The candidate wraps the unchanged onset generator. It computes positive
per-frequency-bin innovation against preceding spectral background, then
whitens it. The background rises with a 90 ms time constant and releases over
350 ms, retaining sustained tonal energy across short gaps. All evidence is
causal; the gate adds no look-ahead or timestamp shift.

The final variant extracts a spatial-median noisy spectral floor before
whitening, using a three-bin neighborhood for the low body and seven bins
elsewhere. Class evidence combines transient strength, breadth, sharpness and
noisy innovation. Kick compares transient low-body evidence with transient
mid-frequency evidence, rather than requiring dominance over the whole mix.
Different convincing class candidates can establish 1.2 seconds of presence.
Every emitted event still requires its own original candidate and residual
evidence. Presence cannot manufacture an event. These are acoustic predicates,
not calibrated class probabilities.

No song/artist identity enters the detector. No common onset threshold, Bass,
renderer, merger, scheduler, cache, routing, Melody or server model was changed.
The earlier rejected gate and all existing diagnostics remain preserved.

## Exact evaluation set

The same 48 cached real-audio spectrum inputs were replayed: 26 stem/control
inputs and 22 original excerpts. The 21 negative controls include vocals,
melodic instruments, bass-only inputs, mixtures omitting drums and the two
user-reported drum-free intros. Four aligned drum stems and 19 broader mixes
provide positive/stress evidence. No new separation or model inference ran.
Some broad mixes contain sections without drums, so activity retention is not
true-hit recall. Independent saved model-event matches are reported below.

| Version | False percussion, 1,675 before | False reduction | Drum-stem activity retained | Full-mix activity retained |
|---|---:|---:|---:|---:|
| Previously rejected gate | 63 | 96.2% | 96.4% | 43.0% |
| Residual v1 | 24 | 98.6% | 51.5% | 17.1% |
| Residual v2 | 380 | 77.3% | 84.2% | 57.3% |
| Residual v3, spatial noisy floor | 391 | 76.7% | 78.3% | 56.5% |

The stricter first residual gate repeated the masking loss. The second variant
replaced its class evidence predicates with residual breadth/attack support;
the third changed the residual construction to remove narrow harmonics before
whitening. Neither recovered a large majority of mix activity while maintaining
the approximately 90% negative-control reduction target. No failed candidate
was made the default.

Final variant counts are Kick / Snare / Hat, compared with the pre-pass working
detector. All controls are 30 seconds unless indicated.

| Negative input | Before | Residual v3 |
|---|---:|---:|
| H.S.K.T. vocals | 7 / 72 / 64 | 3 / 11 / 10 |
| Chân Ái vocals | 45 / 91 / 96 | 23 / 33 / 23 |
| Nujabes vocals | 7 / 76 / 33 | 4 / 2 / 2 |
| Chinese-pop vocals | 15 / 45 / 52 | 6 / 15 / 18 |
| H.S.K.T. piano | 4 / 0 / 0 | 0 / 0 / 0 |
| Chân Ái piano | 1 / 0 / 0 | 0 / 0 / 0 |
| Nujabes piano | 13 / 0 / 0 | 1 / 0 / 0 |
| Chinese-pop near-silent piano | 0 / 0 / 0 | 0 / 0 / 0 |
| Nujabes guitar | 50 / 4 / 0 | 4 / 0 / 0 |
| H.S.K.T. other instrumental stem | 5 / 0 / 0 | 0 / 0 / 0 |
| Gymnopédie piano | 21 / 0 / 0 | 1 / 0 / 0 |
| H.S.K.T. bass-only | 46 / 14 / 0 | 0 / 0 / 0 |
| Chân Ái bass-only | 20 / 1 / 0 | 0 / 0 / 0 |
| Nujabes bass-only | 25 / 0 / 0 | 7 / 0 / 0 |
| Chinese-pop bass-only | 18 / 1 / 0 | 1 / 0 / 0 |
| H.S.K.T. mixture without drums | 45 / 60 / 64 | 19 / 17 / 16 |
| Chân Ái mixture without drums | 28 / 84 / 94 | 10 / 26 / 22 |
| Nujabes mixture without drums | 52 / 73 / 33 | 13 / 9 / 3 |
| Chinese-pop mixture without drums | 47 / 64 / 51 | 20 / 26 / 19 |
| Bích Phương, 0–13 seconds | 0 / 0 / 0 | 0 / 0 / 0 |
| MONO, 0–40 seconds | 31 / 68 / 55 | 7 / 12 / 8 |

Separated stems may contain leakage; near-silent piano controls are weak
evidence. MONO still produces 27 false percussion events, versus 154 before,
an 82.5% reduction. It does not satisfy the intended sparse/dark behavior.

| Drum-only input | Before | Residual v3 | Retained |
|---|---:|---:|---:|
| H.S.K.T. | 44 / 64 / 87 | 42 / 57 / 58 | 80.5% |
| Chân Ái remix | 26 / 44 / 36 | 20 / 20 / 19 | 55.7% |
| Nujabes | 26 / 92 / 89 | 21 / 82 / 59 | 78.3% |
| Chinese pop | 69 / 70 / 68 | 66 / 61 / 55 | 87.9% |

The four drum stems retain 560 of 715 events. At −6 dB they retain 395 of 611
(35.4% additional loss); at −12 dB, 191 of 365 (47.7% additional loss). Losses
at the original level cannot be dismissed as uncertain soft-hit losses.

## Strong-reference recovery

One-to-one matching uses ±80 ms and the same saved model references, excluding
warm-up before 0.4 seconds. These are imperfect independent proxies, not human
ground truth. Values below are matched Kick / Snare / Hat events.

| Mix | Pre-pass working | Rejected gate | Residual v3 |
|---|---:|---:|---:|
| Hysteria | 55 / 16 / 36 | 1 / 0 / 2 | 31 / 3 / 2 |
| Voodoo People | 54 / 43 / 81 | 3 / 3 / 9 | 45 / 37 / 72 |
| Nujabes | 26 / 22 / 86 | 8 / 6 / 39 | 22 / 16 / 61 |

Voodoo People and Nujabes recover substantially, but Hysteria Snare/Hat do not.
The final gate still fails real-percussion preservation. Complete per-input
counts and decisions for every mix remain in the linked exports.

## Verification and listening decision

All 48 input replays assert frame-exact Bass hits, audibility and envelope.
Each accepted percussion event is an exact subset of the original candidates
at the same timestamp. Bass quality is not improved: its existing vocal/low-lead
ambiguity remains. No drum gate was applied to Row 4.

The controlled existing bridge/controller/media-clock/semantic-DOM replay passes
all 48 cases: **6,421 raw = 6,421 normalized = 6,421 merged = 6,421 DOM commits**.
Rows and identities stay independent. There are 6,368 manually dispatched jsdom
animation observations, an incomplete probe rather than physical audio timing.
Melody and decoration are disabled in that harness.

Candidate tests report **55 passed / 4 failed**, including those 48 delivery
cases. Two failures reject the earlier single-bin synthetic Kick fixture. Two
more expose real abstention regressions: weak noisy consonants produce six
Snare/Hat events, and a weak noisy lead after silence produces Snare/Hat again.
The failing assertions remain intact; no thresholds or tests were changed to
conceal these failures. The full existing user-facing suite passes **98 files /
726 tests**. Its success does not certify the private candidate's quality.

Scoped review rejects adoption on both quality and negative-regression evidence.
No local listening build, Companion reload request, installer, commit or release
was produced. The user-facing detector matches the pre-pass snapshot exactly.
There was no fresh live-provider/browser listening validation of this candidate.
All test processes completed; the existing preview PID 3132 on port 5173 remains.
Melody tuning and Phase 5 remain stopped.

Private artifacts are ignored build output and were not uploaded or committed:

- [Implemented candidate](../../src-tauri/target/local-dsp/transient-residual-detector.mjs)
- [Evaluator](../../src-tauri/target/local-dsp/evaluate-transient-residual.mjs)
- [All 48 before/after counts and decisions](../../src-tauri/target/local-dsp/transient-residual-summary.json)
- [Typed raw events](../../src-tauri/target/local-dsp/transient-residual-raw.json)
- [Raw-to-DOM trace](../../src-tauri/target/local-dsp/transient-residual-pipeline.json)
- [Version totals, reference matches and soft-hit loss](../../src-tauri/target/local-dsp/transient-residual-facts.json)
- [Candidate test configuration](../../src-tauri/target/local-dsp/transient-residual.config.ts)
- [Candidate test failures](../../src-tauri/target/local-dsp/transient-residual-tests.log)
- [Prior rejected-gate report](validation-261008-percussion-abstention.md)

Final source SHA-256:
`c03e3ede97ab3c327b3db1d3637b59beb53acba15d85d0474cc95fcbc6525635`.

The requested repair remains unresolved. The next bounded design decision is
how to discriminate vocal/noisy attacks from real percussion without repeating
this residual-gate trade-off. This report does not assume that another threshold
adjustment will solve it or authorize further automatic tuning.
