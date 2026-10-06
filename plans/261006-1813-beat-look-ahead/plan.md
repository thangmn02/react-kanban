# Beat synchronization foundation

Baseline: `2cb55a5`. Implement the corrected Phase 2 only, with a separate local
commit. Preserve Phase 0 diagnostics and Phase 1 capture/delivery recovery.

## Contract and boundaries

Producers send music events before their existing audible deadline. Transport
maps an audio-output deadline to `targetPlaybackTime` in song seconds with a
playback-clock anchor. The UI queues events against that clock and records
target, scheduling, state/DOM commit and animation observations under the same
event IDs. Legacy events without timestamps keep immediate delivery.

The queue is bounded and rejects expired work observably. Pause, seeking,
playback-rate changes, source/capture replacement, stale clocks, backlog and
lease recovery cancel old work. Actual onsets, tempo structure, note/envelope
metadata and random decoration stay distinct. Existing random patterns and CSS
effects stay intact; their delays remain visible in telemetry.

HTML media samples are authoritative for both native and tab transports. Add
explicit seek generations and buffering states, playback-rate rescheduling,
clock capability validation and a capture-clock normalization boundary. Keep
the grid at five rows and eight cells. The separately requested Music controls
are isolated in `399b9c2`; no unrelated product work continues.

Exit gate: a known media timestamp releases against actual playback through
normal playback, seeking, pause, buffering and rate changes. Discontinuities
flush stale work and rebuild from fresh events rather than replay old flashes.

Validation and limits: [synchronization report](../reports/diagnosis-261006-2039-beat-synchronization.md).
617 JS tests, 14 native tests and 15 installed-Edge E2E tests pass, with the
installed-Companion access limitation recorded in the report. Phase 3 is not started.

No detector changes, new models, experimental Bass DSP, row redesign or later
roadmap work. The supplied handoff is present locally under the filename
`plans/plans261006-beat-grid-model-handoff.md`; it locks the row semantics and
one main melodic line. This phase transports existing producer output only.

## Implementation and validation

- [x] Add early producer emission and explicit clock/timestamp transport.
- [x] Add the bounded clock-driven UI scheduler with lifecycle cancellation.
- [x] Trace targets through state, DOM commit and CSS animation diagnostics.
- [x] Test continuous playback, queued events, processing delay, intentional
  lateness, pause/resume, seeks, source interruption and capture/lease recovery.
- [x] Run full JS/native/E2E suites, lint, typecheck and build; browser-check
  Companion and report any access limitation.
- [x] Review, write the concise phase report, commit separately and stop.

Rollback is a revert of the focused commit. No deployment, version bump,
migration, mandatory model download or publication is authorized here.
