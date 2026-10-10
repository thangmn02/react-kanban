# Conservative Melody bus experiment

Status: implementation and quantitative comparison complete; listening gate open.
Part of the open five-row quality gate, not a new phase. No global adoption.

Implement a server-only `MelodyBusDetector` interface with an explicit opt-in,
low-selector-confidence fallback. The accepted selected-source/Basic Pitch/
monophonic path remains the default. Spectral activity is candidate evidence,
not proof of a main lead. No client, cache publication, deployed worker, database
or audio-input authorization changes are needed for this experiment.

Candidate bus: vocals/piano/guitar/other only. Normalize with bounded gains;
analyze configurable frequency bands, adaptive spectral novelty thresholds,
minimum event spacing and sustain/retrigger suppression. Emit normalized
experimental Melody MusicEvents and keep provenance outside the public event
contract. Reject invalid/unbounded input and preserve absolute media timestamps.

Reuse existing server separation and accepted selector on the same holdouts:
sparse piano, vocal pop, guitar/rock, synth/electronic, sustained ambient and
dense layered music. Saved Gymnopédie/H.S.K.T. remain regression examples.

- [x] Detector/interface and opt-in confidence policy.
- [x] Focused silence, exclusions, lifecycle/range, adaptation and retrigger tests.
- [x] Real A/B on representative private excerpts; density/continuity/runtime
  and agreement metrics, plus an aligned listening artifact/annotation support.
- [x] Full regressions, review and documented decision; do not globally adopt.
- [ ] Human main-lead alignment, false-flash and missed-attack assessment.

Human main-lead alignment, obvious misses and false flashes require listening
or explicitly labeled human timestamps. Agreement with A cannot substitute for
that evidence. No universal band/threshold or reference-track rule is accepted.
Authorized provider-audio input and Melody listening gates remain open. Phase 5
must not begin. Rollback removes only this isolated experiment/observer hook.

Evidence: [experiment report](../reports/validation-261007-melody-bus-experiment.md).
