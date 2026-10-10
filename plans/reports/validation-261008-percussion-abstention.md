# Bounded local percussion-abstention evaluation

**Rejected for production listening.** The bounded prototype substantially
reduces false percussion on negative controls, but fails to preserve accepted
percussion activity in several full mixes. It is preserved privately, with
tests and exact event exports. The production detector has been restored to
the working snapshot from immediately before this pass. The requested repair
is therefore **not complete**; this report is an evaluated failure, not a release.

No renderer, merger, scheduler, cache, transport, Melody or audio-model changes
were made in this pass. The renderer commit remains `f7a2445`. No new commit,
package, deployment or Companion version was published. Melody work and Phase 5
remain stopped.

## Scope and baseline

The accepted diagnosis establishes raw local detection as the first faulty
stage. This experiment separates onset candidates from percussion decisions.
It does not consume Row 5, use song/artist rules, introduce a model, or raise
the common energy floor or onset ratio.

**Before** below means the working spectral-flux detector immediately before
this abstention pass (`second-candidate-detector.mjs`), rather than the original
released detector. That distinction matters: Bích Phương's intro already had
zero percussion events in this working candidate. The released detector emitted
22 Kick / 17 Snare / 0 Hat on that same excerpt.

The prior diagnosis and failed conservative trial remain available in the
[raw-generation report](diagnostic-261008-1115-local-dsp-repair.md).

## Prototype decision

The existing onset candidates, adaptive density, refractory timing, energy
envelope and audibility remain unchanged. Candidate density still updates when
a semantic event is rejected, so abstention cannot lower the threshold and
manufacture additional candidates.

For Rows 1–3 only, the prototype computes positive power above a causal 90 ms
background and a seven-bin frequency-median residual. This supplies acoustic
evidence of broad/noisy rather than concentrated tonal activity. It combines
that evidence with attack sharpness, flux, low-body breadth and competing
mid-frequency energy. These values are **not calibrated class probabilities**.

Strong independently supported attacks may emit immediately. Different
convincing percussion-class candidates establish at most 1.2 seconds of
renewable presence; maintenance requires additional acoustic evidence. Even
during presence, every row must have its own original onset candidate and
per-row evidence. Presence never synthesizes a hit. Quiet expires it, and a
new strong attack can recover immediately. Bass bypasses the entire gate.

Thresholds are exploratory, not adopted global production parameters. The
feature inspection included all controls; this is a broad stress check, **not
a statistically independent blind holdout certification**. No track identity
is consulted by detector code.

## Negative controls

Values are **Kick / Snare / Hat**, before → prototype. These are raw detector
events, before transport, normalization or rendering. Each separated-stem
control is 30 seconds. Natural intro durations are explicitly labeled.

| Input | Before | Prototype |
|---|---:|---:|
| H.S.K.T. vocals | 7 / 72 / 64 | 1 / 4 / 5 |
| Chân Ái remix vocals | 45 / 91 / 96 | 0 / 0 / 1 |
| Nujabes vocals | 7 / 76 / 33 | 1 / 1 / 0 |
| Chinese-pop vocals | 15 / 45 / 52 | 0 / 1 / 0 |
| H.S.K.T. piano | 4 / 0 / 0 | 0 / 0 / 0 |
| Chân Ái remix piano | 1 / 0 / 0 | 0 / 0 / 0 |
| Nujabes piano | 13 / 0 / 0 | 0 / 0 / 0 |
| Chinese-pop near-silent piano | 0 / 0 / 0 | 0 / 0 / 0 |
| Nujabes guitar | 50 / 4 / 0 | 0 / 0 / 0 |
| H.S.K.T. other instrumental stem | 5 / 0 / 0 | 0 / 0 / 0 |
| Gymnopédie natural piano | 21 / 0 / 0 | 0 / 0 / 0 |
| H.S.K.T. mixture omitting drums | 45 / 60 / 64 | 3 / 4 / 5 |
| Chân Ái remix mixture omitting drums | 28 / 84 / 94 | 1 / 0 / 1 |
| Nujabes mixture omitting drums | 52 / 73 / 33 | 1 / 0 / 0 |
| Chinese-pop mixture omitting drums | 47 / 64 / 51 | 6 / 5 / 3 |
| Bích Phương, 0–13 s | 0 / 0 / 0 | 0 / 0 / 0 |
| MONO, 0–40 s | 31 / 68 / 55 | 1 / 3 / 4 |

Aggregate reductions:

- Vocal stems: **603 → 14**, 97.7% reduction.
- Melodic-instrument controls: **98 → 0**.
- Drum-omitted mixtures: **695 → 29**, 95.8% reduction.
- MONO: **154 → 8**, 94.8% reduction. Residual events still require listening;
  eight detections do not prove that their placement is acceptable.
- Including the four bass-only negative percussion controls below: **1,675 → 63**
  across 21 negative inputs, 96.2% reduction.

Separated stems can contain leakage/artifacts. Chinese-pop piano is near-silent,
and the remix piano is also very quiet; zero activity there is weak evidence.
Natural piano, guitar, instrumental accompaniment and the user-annotated intros
avoid relying only on those quiet stems. References are regression examples,
not universal ground truth.

## Drum-positive controls and full mixes

Counts remain Kick / Snare / Hat. Retained events are an exact subset of the
before events with the **same timestamps**; there are no new or shifted events.

| Drum-only input | Before | Prototype | Activity retained |
|---|---:|---:|---:|
| H.S.K.T. drums | 44 / 64 / 87 | 44 / 63 / 86 | 99.0% |
| Chân Ái remix drums | 26 / 44 / 36 | 22 / 36 / 30 | 83.0% |
| Nujabes drums | 26 / 92 / 89 | 26 / 89 / 88 | 98.1% |
| Chinese-pop drums | 69 / 70 / 68 | 69 / 69 / 67 | 99.0% |

Total drum-stem activity: **715 → 689**, 96.4% retained. By class:
Kick **165 → 161**; Snare **270 → 257**; Hat **280 → 271**.

The four corresponding original mixes retain only **923 → 542**, 58.7%.
The broader full-mix stress set exposes larger regressions:

| Original full-mix excerpt | Before | Prototype |
|---|---:|---:|
| 50 cuộc gọi nhỡ | 60 / 60 / 60 | 6 / 2 / 3 |
| Bé ơi remix | 59 / 69 / 71 | 8 / 8 / 12 |
| Chân Ái remix | 27 / 85 / 97 | 16 / 34 / 57 |
| Chinese pop | 83 / 73 / 86 | 65 / 48 / 69 |
| Cô đơn anh cũng vui | 51 / 92 / 89 | 18 / 36 / 52 |
| Hysteria | 85 / 53 / 60 | 1 / 0 / 2 |
| Không buông | 11 / 49 / 7 | 1 / 0 / 0 |
| H.S.K.T. | 63 / 77 / 85 | 48 / 59 / 70 |
| Levels | 18 / 48 / 46 | 0 / 0 / 4 |
| Nhức tiềm thức | 40 / 38 / 45 | 0 / 1 / 1 |
| Nujabes | 62 / 85 / 100 | 14 / 17 / 45 |
| One More Time | 14 / 54 / 46 | 9 / 11 / 14 |
| Redbone | 54 / 48 / 47 | 46 / 31 / 34 |
| Take Five | 53 / 38 / 13 | 0 / 0 / 0 |
| Voodoo People | 57 / 77 / 91 | 4 / 7 / 9 |
| Weightless | 29 / 0 / 0 | 19 / 0 / 0 |
| XO Tour Llif3 | 52 / 77 / 117 | 50 / 58 / 113 |
| Yellow | 45 / 63 / 62 | 35 / 37 / 47 |
| Bích Phương later percussion excerpt | 67 / 93 / 84 | 64 / 78 / 64 |

These 19 full mixes retain **3,315 → 1,427**, 43.0% of baseline activity.
They are not all annotated drum-positive throughout. Baseline events also
contain false positives, so activity retention is not true-hit recall.
Nevertheless the loss is too large to claim preservation. Saved independent
model-event references corroborate serious loss on percussion material:

- Hysteria Kick matches at ±80 ms: **55 → 1** of 64 reference events.
- Voodoo People Kick matches: **54 → 3** of 63 reference events.
- Nujabes Hat matches: **86 → 39** of 93 reference events.

Those model references are imperfect proxies, not human annotation, and were
not used to add per-song rules. They prevent attributing every rejected
full-mix event to a corrected false positive.

The gate is too conservative under masking: isolated drums establish convincing
presence readily, whereas mixed tonal/vocal energy reduces the same evidence.
Hysteria has 195 abstained candidates and just three accepted percussion events;
Nujabes has 171 abstained and 76 accepted. This is not a rendering freeze or
lost transport message. It is an upstream abstention decision.

## Soft-hit loss

To separate quiet-input loss from full-mix masking, the same real drum spectra
were replayed with uniform −6 dB and −12 dB attenuation. Each comparison uses
the **same attenuated input** for before/after; the fixed energy floor remains
unchanged. This measures additional gate losses, not all notes below that floor.

| Input level | Before events | Prototype events | Additional loss |
|---|---:|---:|---:|
| Original drum stems | 715 | 689 | 3.6% |
| −6 dB drum stems | 611 | 565 | 7.5% |
| −12 dB drum stems | 365 | 280 | 23.3% |

Worst −12 dB case, Chân Ái drums: **43 → 19**, 55.8% additional loss.
The broad full-mix losses cannot honestly be labeled only missed soft hits:
they include strongly drum-supported material. This exceeds the user's accepted
trade-off of losing *some uncertain/soft* hits.

## Bass evaluated separately

Bass decisions, timestamps, audibility and overall envelope are **identical
frame-for-frame on all 48 input replays**. The gate does not alter Bass frequency
bands, candidate density, confidence or decision logic.

| Bass-only input | False percussion before → prototype | Bass before → prototype |
|---|---:|---:|
| H.S.K.T. bass | 46 / 14 / 0 → 4 / 0 / 0 | 39 → 39 |
| Chân Ái remix bass | 20 / 1 / 0 → 3 / 0 / 0 | 22 → 22 |
| Nujabes bass | 25 / 0 / 0 → 5 / 0 / 0 | 71 → 71 |
| Chinese-pop bass | 18 / 1 / 0 → 0 / 0 / 0 | 44 → 44 |

Unresolved Bass ambiguity is unchanged: vocal-only Bass counts remain
**69 / 72 / 71 / 64** for H.S.K.T. / Chân Ái / Nujabes / Chinese pop.
MONO remains 47 and Bích Phương's intro remains 31. Low piano and low vocal
fundamentals cannot be classified correctly just by applying the drum gate.
This pass makes no Bass accuracy improvement claim.

## Regression checks, review and retained artifacts

The preservation assertions cover every analyzed frame: no new/shifted
percussion events; exact Bass, envelope and audibility equality. **48** actual
candidate event lists then traverse the existing bridge parser, priority merger,
media-clock scheduler, controller and semantic DOM renderer:

**5,684 raw → 5,684 normalized → 5,684 merged → 5,684 semantic DOM commits.**
No changed identities/timestamps, extra semantic events or wrong rows. Melody
and decoration are disabled in this controlled replay. There are 5,630 manually
dispatched jsdom animation-start observations, an incomplete probe of present
cells—not proof of every real CSS animation or physical audio alignment.

The private candidate suite passes **59 tests**: 11 detector tests and 48
pipeline replays. It covers per-row refractory behavior at 44.1/48 kHz, quiet
expiry, immediate strong recovery, weak lead/noise abstention and independent
Bass. The weak-lead regression failed before the gate (16 false Snare/Hat
events) and passes on the prototype. An initial all-frequency test pulse had
insufficient low-body share to qualify as Kick even before abstention; its input
was corrected to represent an actual strong low body without weakening assertions.

After restoring the pre-pass detector, the existing suite passes **98 files /
726 tests**; scoped detector lint, TypeScript and Vite production build pass.
Existing extensionless-import and large-chunk build warnings remain. No packaging
or publishing command was run. The user's live browser was not automated in
this pass; offline real-audio spectra and controlled DOM replay are the evidence,
not a claim of a fresh provider-capture/listening check.

Scoped code/spec review rejects the candidate on the musical preservation gate.
The original renderer/merger/scheduler modules were not edited. The failed
PrimaryMelodyTracker, previous diagnostics and detector candidates remain intact.
The existing user preview process (PID 3132, project port 5173) is retained;
all new test/build processes completed, with no new server or browser process.

Private audio-derived artifacts remain in ignored build output:

- [Candidate source](../../src-tauri/target/local-dsp/abstention-candidate-detector.mjs)
- [Per-input before/after decisions](../../src-tauri/target/local-dsp/abstention-summary.json)
- [Exact typed raw timestamps](../../src-tauri/target/local-dsp/abstention-raw.json)
- [Raw-to-DOM provenance](../../src-tauri/target/local-dsp/abstention-pipeline.json)
- [Soft-drum measurements](../../src-tauri/target/local-dsp/abstention-soft-drums.json)
- [Reproducible evaluator](../../src-tauri/target/local-dsp/evaluate-abstention.mjs)
- [Private regression configuration](../../src-tauri/target/local-dsp/abstention.config.ts)

Candidate SHA-256:
`37e1980b05aa05c124cf2e9179b5f40d06467aa07eebb007fd163b0301011298`.

**Listening recommendation: do not adopt this candidate as the repair.**
The false-positive goal improves substantially; the real-percussion preservation
goal fails. There is no accepted default DSP change from this pass. No further
calibration, Melody tuning or Phase 5 work starts automatically.
