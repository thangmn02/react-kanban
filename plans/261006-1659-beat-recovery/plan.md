# Beat Grid delivery recovery

Baseline: `c492ab8`. Scope: Phase 1 only; local commit, no release.

## Outcome and boundaries

Keep leased analysis alive through silence; recover active capture after expiry,
interruption and backlog. Tempo carries timing only. Preserve detector thresholds,
debounce, optional models, random masks, visual timers and Phase 0 diagnostics.
No new DSP, ML, row design, look-ahead scheduler or performance work.

## Confirmed causes and policy

- Capture engine stops after 2.5 seconds of low energy. Remove this teardown;
  unrenewed leases and ended tracks still stop capture.
- Offscreen expiry tears down the clock owner; capture-only expiry must retain it
  and retry on the next active clock/renewal. Renew initialized quiet captures;
  wait for initial stream setup to finish before sending capture leases.
- Native transient failures impose a 3-second retry; retry them on the next fresh
  clock while retaining a bounded cooldown for actual startup failures.
- Transport rejects everything over 600 ms old. Retain late telemetry; allow a
  bounded 2-second recovery window, coalesce late UI delivery to the latest event
  per event kind, and reject older events with an explicit renewal request. Never
  fabricate a semantic onset or replay an unbounded burst.
- A full capture queue rejects new events. Evict oldest queued work so current
  events survive. Late analysis drains discard stale work and report recovery.
- Tempo subdivisions fabricate kick/clap/hat labels. Replace these with step,
  phase, beat position and subdivision; semantic rows use actual onsets. Existing
  decorative shape retriggers may still use structural tempo ticks.

## Validation and delivery

- [x] Focused regression tests: quiet/loud, pause/resume, seeks, source recovery,
  leases, queue saturation, delayed events and timing-only tempo.
- [x] Accelerated 30-minute continuous capture and end-to-end telemetry trace.
- [x] Full existing JS and native suite, lint, typecheck and build.
- [x] Accessible browser integration; installed extension where tools permit.
- [x] Short report with evidence and limits; review; separate local commit.

Rollback: revert the focused commit. No migration, models, deployment or version
bump. Browser extension-manager access is blocked by browser security policy;
do not bypass it.

Evidence and installed-extension validation limits are recorded in the
[Phase 1 report](../reports/diagnosis-261006-1659-beat-recovery.md).
