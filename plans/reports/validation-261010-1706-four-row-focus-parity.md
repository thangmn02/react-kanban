# Four-row grid, Focus parity and capture lag

## Delivered behavior

Normal Web/Desktop uses Kick, Snare/Clap, Hat and Bass in a 4×8 matrix. Lead's
normal row/readiness strip is hidden; explicit private five-row diagnostics and
frozen Lead contracts remain. Existing four-row shape masks, colors and layout
share the original renderer. Animation durations, detectors and scheduler logic
were not retuned. Focus is the single navigation entry; compatible Music/Beat
links select the internal panel. Explicit pop-out retains the original dock and
Pomodoro controller.

## Lag diagnosis and repair

Document visibility changes changed `eventOptions`, remounting the capture effect
and learned runtime. A simultaneous Desktop validation window also competed for
the Companion's single stream. Analysis demand now updates the existing engine
without replacing its audible subscription. Demand release still ends analysis
leases; hidden native PCM and preceding buffered context are discarded. Source
changes and shutdown retain subscription cleanup.

Actual Playwright tab switching retained the same app and Companion capture IDs,
with no capture start/stop/lease-expiry records. Counts continued from
Kick/Snare/Hat/Bass 16/11/15/120 to 21/14/19/134. Foreground rAF measured 8.3 ms
median, 8.4 ms p95 over 265 frames. Background tabs remained browser-throttled
around 1 Hz; this is not an inference or musical accuracy measurement.

## Validation

- Working workspace: 867 JavaScript tests, 14 native tests, typecheck and lint pass.
- Staged source independently: typecheck and 805 tests across 107 files pass.
- Targeted Playwright: 4/4 pass; initial cold-load timeout under concurrent full
  tests did not recur in the serial rerun. No assertion was weakened.
- Real local Web: 32 cells, actual four-row Companion activity, explicit PiP
  moves/returns the same dock, timer preserved. Native GUI showed the matching
  compact four-row dock before the final version bump; final 0.1.16 native build
  and automated native suite passed. The updater was not installed locally.
- Release draft: authenticated grid 32 cells, no Lead strip; clean anonymous
  context stays on Home, Focus redirects with its return destination preserved.
- Signed NSIS 0.1.16: 7,073,922 bytes; verified updater signature and matching
  downloaded SHA-256 `e66ed56a15cd84988d913191a2a2a7b3afcf5e4bb81e4580fe2bcffbfeb4ec1a`.

## Packaging and publication

The Companion package now includes missing static dependencies for background,
capture and percussion worker modules, with a pre-packaging import check.
Private model weights/inference assets are excluded. Production Lead UI and
processing flags are false. Web/downloads are deployed together.

Direct reuse of stored function digests requested unavailable uploads, so that
unfinished draft was not published. The ready draft uses backend source from the
actual prior published Git revision `f1d99229c14f7f496c8a8d0a77aaeb7afb183a6b`.
CLI rebundling changes binary digests; backend application source is unchanged.
No server environment, Supabase or Modal configuration was changed. Root/deep
links return 200; existing cache missing-input 400 and AI GET 405 are preserved.

Release draft: `6aca1d35fb5a9c465351ff81`. Public verification is recorded after
promotion. Raw evidence remains ignored under `src-tauri/target/four-row-focus-parity`.
The release commit includes previously accepted shared client/runtime dependencies
needed to compile this UI; unrelated server research/infrastructure remains unstaged.
Only small runtime/config JSON and the updater feed are included, not telemetry dumps.

## Remaining limits

Development analysis-service 503 availability remains separate and unresolved.
Learned test-Companion timing delay is unchanged. Browser background throttling
and concurrent app/Web capture contention remain platform constraints. No new
musical accuracy acceptance or low-end hardware benchmark is claimed. Updater
signing does not satisfy a Windows Authenticode enforcement policy. Lead/Phase 5
work and public audio processing were not enabled by this release.
