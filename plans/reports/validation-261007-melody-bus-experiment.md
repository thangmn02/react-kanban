# Melody bus experiment

Date: 2026-10-07. Decision: retain the accepted one-main-lead default. The
experimental fallback is implemented, but there is no evidence for global adoption.
Phase 4 remains open; Phase 5 has not started.

## Implementation and boundary

[MelodyBusDetector](../../server/audio-analysis/melody-bus.py) is a server-only
interface. The implementation normalizes and sums vocals/piano/guitar/other;
drums and bass are excluded. Configurable frequency bounds, per-bin spectral
normalization, positive novelty, adaptive median/MAD thresholds, minimum spacing
and sustain/retrigger suppression produce bounded, timestamped Melody MusicEvents.
Holds are clipped at the next attack and output is trimmed to the requested range.
Experimental provenance accompanies the result separately from the event contract.

The fallback policy is disabled by default. Explicit opt-in and selector confidence
below its configurable threshold are both required. High-confidence decisions
remain on A; empty B output preserves A. The experimental defaults are hypotheses,
not global production tuning. Spectral activity does not establish a main lead.

The accepted separation → selected source → Basic Pitch → retrigger merge →
monophonic lead pipeline is unchanged. An optional offline observer in
[analyze.py](../../server/audio-analysis/analyze.py) exposes the existing separated
stems for comparison. No client imports, live worker integration, cache publication,
database changes or additional model downloads were introduced by this experiment.
Production continues using its existing accepted path and recovery/scheduling.

## Real A/B comparison

[benchmark-melody-bus.py](../../scripts/benchmark-melody-bus.py) ran the existing
analysis on ten supplied real 30-second full-mix excerpts. A uses the current
selector and postprocessing through
[compare-melody-paths.mjs](../../scripts/compare-melody-paths.mjs); B reuses the same
separation. The corpus includes sparse piano, vocal pop, guitar/rock, synth/EDM,
sustained ambient and layered music. Gymnopédie and H.S.K.T. remain regression
examples. This limited corpus does not demonstrate generalization across full songs.

All counts below are attacks per 30-second excerpt; multiply by two for events/min.
Longest gaps include excerpt edges. Matches are one-to-one A/B agreement within
80 ms, **not ground-truth accuracy**. B is measured independently even when the
low-confidence guard would prohibit its use.

| Excerpt | A attacks | B attacks | A/B matches | Longest gap A/B (s) | Fallback eligible |
| --- | ---: | ---: | ---: | --- | --- |
| Nujabes | 23 | 31 | 4 | 4.694 / 3.400 | No |
| Hysteria | 45 | 23 | 4 | 2.045 / 3.560 | No |
| Yellow | 66 | 53 | 26 | 2.300 / 2.330 | No |
| Redbone | 5 | 48 | 2 | 19.193 / 2.850 | No |
| Take Five | 25 | 45 | 13 | 5.958 / 2.210 | No |
| Levels | 41 | 41 | 16 | 6.355 / 3.590 | Yes |
| Gymnopédie | 35 | 30 | 25 | 3.822 / 2.590 | No |
| H.S.K.T. | 40 | 35 | 5 | 3.322 / 2.730 | Yes |
| Nhức Tiềm Thức | 42 | 43 | 15 | 1.859 / 2.420 | No |
| Weightless / ambient | 37 | 17 | 5 | 2.288 / 5.560 | No |

B sometimes increases density and reduces gaps, and sometimes does the reverse.
Its ambient output is sparser with a larger gap; more Redbone activity may be
accompaniment rather than recovered lead. Neither result proves misses or false
flashes. The configurable experimental confidence threshold of 0.6 admits only
Levels and H.S.K.T. here. A high source-selection score does not prove note recall;
this guard intentionally cannot rescue every sparse or wrong high-confidence A.

A frequency-band sensitivity check reused the exact saved stems and A candidates.
Changing only 150–8000 Hz to 500–4000 Hz yielded B counts, in table order:
32, 20, 70, 49, 46, 49, 31, 48, 53, 12. This is parameter sensitivity evidence,
not a reason to adopt either band universally. Final listening files were restored
to the broad experimental defaults. No track-specific parameters were added.

## Runtime and limitations

On this local Windows host using the existing Python analysis environment with
two configured inference threads, A's full pipeline took 46.639–59.230 seconds
per 30-second excerpt. During the final reuse run B alone took 0.268–0.426 seconds
wall time and 0.266–0.422 process CPU seconds per excerpt. Those incremental times
exclude source separation, Basic Pitch, model startup and artifact writing; B
does not remove the need to obtain separated candidates. Original full-inference
timings are retained separately from reuse timings. These measurements are not
Modal costs or low-end client performance claims.

Summed stems can cancel or retain accompaniment/separation bleed. Centered windows
can anticipate attacks; the synthetic timing check allows 80 ms and does not prove
perceptual synchronization. No fixed timing correction was introduced. The bus
does not select or transcribe a dominant lead and cannot resolve that semantic
requirement by onset density alone.

## Listening evidence and remaining gates

Private artifacts, ignored by Git, are under `src-tauri/target/melody-bus-ab/`:

- `listen.html`: original audio plus identical attack-click overlays for A and B,
  switchable at the real audio playback position, with both attack timelines.
- Per excerpt: `accepted.json`, `experimental.json`, `review.csv`, private audio
  and saved separated stems.
- `report.json`, `report-inference.json`, `report-narrow.json`: measured events,
  continuity, eligibility and runtime with the configuration used.

Perceptual lead alignment, obvious false flashes and obvious misses are explicitly
**unmeasured**; no listening gate is claimed passed. CSV sheets permit attack review;
complete human lead-onset annotations can be supplied through `--annotations` to
measure one-to-one alignment and unmatched attacks. A/B agreement and the saved
regression examples are not universal ground truth.

The existing authorized provider-audio input blocker remains unchanged. The
experiment uses supplied local excerpts and establishes no ingestion route for
ordinary uncached provider playback. Both that blocker and representative Melody
listening acceptance must pass before Phase 4 can close or Phase 5 can begin.
No completion commit, production deployment or release has been performed.

## Verification and review

- Focused detector tests: 9 passed, covering exclusions, silence, absolute ranges,
  sustain, spacing, normalization, invalid inputs and explicit fallback policy.
- Full Python server suite: 20 passed.
- Full Vitest suite: 91 files / 657 tests passed, including the accepted-path CLI
  comparison and existing telemetry/recovery/scheduler/cache contracts.
- Scoped JavaScript/TypeScript lint, Node syntax and full TypeScript check passed.
  Restricted dependency resolution initially produced errors; the same TypeScript
  check passed with normal filesystem access without any source changes.
- Review retained default-off isolation and private artifact handling. The initial
  gain-invariance test exposed an absolute spectral-floor dependency; replacing
  that floor with a relative energy floor fixed it without weakening the test.
  Holds now remain nonoverlapping under shorter configured spacing. Simplification
  preserved these contracts; there is no unresolved code finding in this scope.
- Benchmark/test processes are finished; no new background server remains.

Rollback removes the isolated detector, optional observer and comparison tools.
See [the experiment plan](../261007-1526-beat-grid-closure/melody-bus-experiment.md)
and [the existing range-analysis gate report](validation-261007-range-beat-analysis.md).
