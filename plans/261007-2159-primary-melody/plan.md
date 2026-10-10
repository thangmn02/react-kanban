# Primary Melody and bounded playback input

Continue Phase 4 only under the latest attached request. Phase 5 is explicitly
held for review, superseding the earlier automatic continuation authorization.
Preserve telemetry, recovery, playback scheduling, sparse chunks, demand gating,
server/local dedupe and the existing four percussion/Bass rows.

Line 5 follows one perceptually primary pitched voice at a time, including vocals.
Use measured note contour, coherence, polyphony, continuity and relative salience;
configurable hysteresis governs section-dependent handoff. Energy alone cannot
choose vocal. Ambiguity may remain silent. MelodyBus remains experimental/off.
No song/artist rules, new research branch, heavy client inference or perfect MIDI
transcription target.

- [x] Implement and unit-test candidate PrimaryMelodyTracker and vocal analysis.
- [x] Wire candidate output into normalized Melody events and sparse publication.
- [x] Implement demand-gated bounded rolling playback capture and protected upload.
- [x] Prepare restore-verified backup; no new hosted mutation was performed.
- [ ] Verify a real bounded captured segment reaches Modal and derived cache;
      delete private raw input and verify cache replay through ordinary playback.
- [x] Evaluate ten holdouts; user rejected all candidates. Quality gate FAILED.
- [x] Run regressions and isolated Edge checks; review ownership and cleanup.
- [x] Report gate evidence and stop without a completion commit or deployment.

Status: STOPPED at the concrete Melody listening blocker. Runtime access to the
installed browser also failed, so ordinary-playback capture/Modal/Line 5 delivery
is not verified. The prepared private-input migration is unapplied. Do not
represent candidate code, unit counts or fixture playback as exit-gate success.

Captured audio is historical: analysis cannot supply future notes on the first
uncached pass without delayed playback. Preserve local fallback and late-event
rejection; derived historical chunks serve replay/later playback. Document this
physical limitation instead of replaying stale notes as current music.

Privacy/terms review is required before production release. No production web or
signed-app publication is requested in this continuation. Cloud validation may
use the existing draft/Modal route after backup; secrets and private audio stay
outside Git. Raw input must be private, bounded and short-lived.

Report: [validation](../reports/validation-261007-2242-primary-melody.md).
