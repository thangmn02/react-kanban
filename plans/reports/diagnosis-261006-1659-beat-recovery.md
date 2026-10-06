# Beat Grid Phase 1: reliability and delivery recovery

Baseline: `c492ab8`. Scope: recovery only; local commit, no release or version bump.
The [Phase 0 trace](diagnosis-261006-1534-beat-telemetry.md) remains the baseline.

## Changes

- Quiet capture keeps sampling instead of stopping after 2.5 seconds. Actual
  stream termination and unrenewed leases still release audio resources.
- Extension capture expiry preserves its clock owner and immediately attempts
  reacquisition. Initialized quiet streams receive leases before audibility;
  leases wait for initial stream setup. Native transient interruption, PCM gaps,
  backlog and lease loss retry on the next fresh active Companion clock.
  Actual setup/permission failures retain bounded backoff.
- Transport events over 600 ms remain observable. Events no older than two
  seconds coalesce to the newest event per kind, bounded to six kinds. Flush
  rechecks expiry; fresh delivery supersedes older pending work. Older events
  drop and request renewal, throttled to once per second at the bridge. The
  controller also renews after its stale-capture watchdog falls back to clock.
- Capture's audio-deadline queue still drops work over 600 ms late and drains
  forward. At its existing 2,048-event cap, oldest enqueued work is evicted so
  new events survive. Missed optional instrument-note deadlines drop those
  notes without permanently stopping subsequent analysis.
- Production tempo ticks carry step, phase, beat position and subdivision,
  with `tempo:generic` provenance. BPM/confidence remain in tempo state.
  Semantic rows use real onsets; structural ticks can still retrigger existing
  decorative shapes. No tempo-generated kick/snare/hat labels reach the rows.

Phase 0 IDs, opt-in bounded diagnostics, source distinctions, owner/sequence
guards and detector-to-animation observations are preserved. Recovery requests
are metadata, never replacement onsets. `CAPTURE_RECOVERED` records returning
audibility or resumed delivery, not merely an attempted restart.

Detector algorithms, thresholds, per-row debounce, tempo estimation/PLL, random
masks, held shapes, visual timing and existing optional models are unchanged.
No new DSP, ML, row redesign or look-ahead scheduling is included.

## Verification

- `pnpm test`: **589 tests / 81 files passed**.
- `cargo test` in `src-tauri`: **13 tests passed**.
- `pnpm lint`: **zero errors**, 23 existing warnings.
- `pnpm build`: TypeScript and production build passed; existing Vite config
  and chunk-size warnings remain. Companion packaging also succeeded.
- `git diff --check`: passed.
- Playwright: **all 15 existing E2E tests passed** in installed Edge using a
  temporary config with `channel: 'msedge'` and two workers. The default bundled
  Chromium could not launch; its missing download timed out. No permanent test
  configuration changes were needed.

Regression coverage includes accelerated 30-minute real-detector sampling with
periodic 20-second quiet sections; immediate returning onsets; pause/resume;
forward/backward seeks; source handoff and missing clocks; lease rejection and
expiry; stale owners; 2,048 queued events; 100 delayed messages; expiry while a
flush waits; fresh events superseding old work; and timing-only tempo. The trace
integration exercises detector → capture → sync → page transport → controller
→ DOM → CSS animation, including a ten-second quiet interval with the same
capture and original onset IDs.

Live connected Edge validation used a temporary inaudible Web Audio source
through the production capture engine, bridge, controller, renderer and CSS,
with test-owned transport. Over 150 seconds of continuous attacks advanced
onset counts. A quiet interval retained the same capture and unchanged onset
counts; loud audio resumed delivery. Pause/resume reacquired capture. Forced
expiry reacquired within 249 ms in the observed run. An 850 ms UI stall resumed
fresh delivery. A longer scheduling stall during the full suite also expired
and automatically reacquired capture. These are recovery checks, not a rhythm
accuracy or 30-minute live playlist claim.

Installed Companion probing returned `not-installed` in the connected browser.
Extension-manager navigation was blocked by browser security policy and was
not bypassed. Installed Brave/Companion end-to-end validation and a real
30-minute playlist remain unverified. Console review found earlier temporary
fixture/HMR errors; the final live cycle added none. The owned tab, scratch
fixture and manual Vite server were removed/stopped after verification.

## Review and limits

Review caught and fixed two recovery edges: premature renewal during initial
stream setup, and stale queued delivery after a further UI delay. Tests cover
both. A blocked UI can still lose individual events; recovery intentionally
avoids an unbounded replay burst or fabricated instrument hits. Row detection
quality and decorative masks can still suppress flashes, as Phase 0 documented.

Stop after Phase 1. Rollback is a revert of this focused commit; no migration
or operational configuration changes are required.
