# Local four-row detector repair

The user authorizes local DSP changes after rejecting the unchanged four-row
baseline. The accepted renderer repair is `f7a2445`. This pass addresses false
percussion hits, especially overlapping Kick/Bass evidence. It does not tune
Melody, start Phase 5, change semantic routing, replace the scheduler, introduce
client ML, or hard-code song/genre rules.

Target regression: the supplied Bích Phương recording, seconds 0–13, annotated
by the user as containing no Kick, Snare or Hat. Treat it as a negative fixture,
not universal ground truth. Check broader held-out percussion and tonal clips
for excessive loss of real events.

- [x] Reproduce false percussion detections on the exact clips and broader corpus.
- [ ] Add spectral novelty, tonal/noise and envelope evidence with per-row gating.
- [ ] Separate Kick from tonal Bass evidence without forbidding genuine overlap.
- [ ] Preserve timestamps, source telemetry and capture/recovery contracts.
- [ ] Add meaningful negative/positive/retrigger/sample-rate regressions.
- [ ] Compare real-audio baseline/current counts and saved references; browser check.
- [ ] Run full tests, typecheck/build and scoped review; report limits and stop.

Acceptance requires fewer false percussion events without silencing the grid or
inventing semantic events. Do not claim universal instrument isolation or
perceptual completion from activity counts. Retain failed Melody work.

## Current scope: measure before further calibration

The user now requests a raw-generation investigation and proposal, not another
threshold/gate change. The earlier spectral-flux candidate and unsuccessful
conservative trial are preserved as private artifacts. The conservative trial
was not adopted; the working detector matches the previously tested candidate.
Neither candidate satisfies the drum-free listening gate. No publication or
Melody/Phase 5 work is authorized by this diagnostic pass.

- [x] Reuse vocal, piano/instrumental, bass, drums, original-mix and drum-omitted
  controls, with source-separation leakage and near-silent stems disclosed.
- [x] Export independent raw timestamps, origin, input identity, unknown class
  confidence and measured energy/threshold evidence.
- [x] Replay those same events through bridge normalization, semantic merging,
  scheduling and DOM/animation provenance without Row 5 or decoration.
- [x] Inspect relative calibration and report Bass separately.
- [x] Propose abstention after measurement; do not apply another heuristic yet.
- [x] Run regressions and extension startup check; retain the user preview.

Evidence and remaining quality gate:
[raw semantic-generation report](../reports/diagnostic-261008-1115-local-dsp-repair.md).
The original repair checklist remains open where product acceptance is missing.

## Authorized bounded percussion-abstention pass

The completed diagnosis is the baseline. The user now authorizes an explicit
Rows 1–3 uncertainty gate in the local detector only. Preserve Bass decisions,
onset timestamps, transport, merger, scheduler, cache, rendering and Melody.
Prefer fewer false flashes over uncertain soft hits; do not use song-specific
rules or a global energy-threshold increase as the primary repair.

- [x] Measure discriminating percussion/competing tonal evidence on existing controls.
- [x] Implement and preserve a bounded detector-only abstention prototype and tests.
- [x] Export before/after counts and exact retained events on negative/positive inputs.
- [x] Verify Bass decisions remain identical and downstream identity tests pass.
- [x] Run full regressions and review; report soft/uncertain-hit loss honestly.
- [x] Stop without adoption; do not resume Melody or Phase 5.

Activity retention alone is not real-hit recall. Saved drum stems and model
references are imperfect; report their limits and retain all failed trials.
No new publication or release is requested by this pass.

Result: the prototype reduces negative-control percussion by 96.2%, retains
96.4% of isolated drum activity, but only 43.0% across the broader full-mix
stress set. It fails percussion preservation and is not acceptable for adoption.
The production detector is restored to its pre-pass working snapshot; all new
prototype code/tests and raw measurements are preserved privately. The repair
acceptance gate remains open. See the
[bounded abstention report](../reports/validation-261008-percussion-abstention.md).
