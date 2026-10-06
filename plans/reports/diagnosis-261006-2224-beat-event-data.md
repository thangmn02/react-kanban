# Beat event data engine validation

Phase 3 introduces validated cached Beat events with local capture and explicit
decorative fallbacks. Cache or analysis waits do not block playback. The change
preserves the five-by-eight grid, existing detectors, media scheduler, recovery
and opt-in telemetry. No model, detector tuning or later phase is included.

## Implementation

Provider identities come from content routes or player-owned links. YouTube's
canonical player owns its watch URL even when navigation retains preview
players; advertisements and unrelated players cannot inherit that identity.
The version-one EventTrack contract binds asset, revision, duration, analysis
version, 30-second chunks and a single dominant monophonic Melody lead.

The real Vite/Netlify cache handler reads deployed JSON or a configured HTTPS
origin. Cache misses return 404. Optional asynchronous analysis submission uses
Supabase-authenticated users, a fixed HTTPS worker, admission bounds and an
idempotency key. Only an actual 202 job acknowledgement means work is pending.
No hosted worker, seeded catalog, database change or publication is included.
Operational setup and protocol are in [the cache documentation](../../docs/beat-event-cache.md).

The engine holds at most three chunks, two range requests and 2,048 pending
semantic candidates. Parsing limits each response to 512 KiB and 4,096 events.
Cache coverage has priority over local events; a 40 ms row/time tolerance
replaces queued lower-priority events and suppresses duplicates after delivery.
Requests and scheduled targets are invalidated by lifecycle changes. Fresh
media clocks rebuild cached work; capture loss does not stop independent cache
delivery. Cache misses retain local capture where available, otherwise generic
decorative timing. Detected silence, mute, pause and stale clocks stay dark.

Capture capability tiers distinguish browser output-clock capability, estimated
native monitoring and unavailable capture. The existing timing normalization
boundary is retained. Cache/local/degraded provenance remains separate from
onset, tempo, envelope/lifecycle and random visual provenance. Added cache,
path and replacement records preserve existing late/drop and DOM/animation
diagnostics. Music's path label is the only product control change.

## Verification

- The full JavaScript suite passes 645 tests in 89 files. Tests cover valid and
  invalid cache data, real file reads, missing/unavailable workers, authenticated
  job acknowledgements, chunks, memory bounds, capability fallbacks, priority
  handoffs, dedupe, mute, silence, seeks, buffering, rates, late events, stale
  clocks, capture owners, revision recovery and teardown.
- An accelerated two-hour playback test delivers 240 cached semantic events
  across 240 chunks, preserves quiet-range leases and stays within the chunk,
  request and queue bounds. This is a deterministic test, not a two-hour
  physical playback benchmark.
- Fourteen existing native tests and all fifteen Playwright E2E tests pass.
  Playwright used installed Edge because the configured bundled Chromium was
  unavailable. Type checking and the production build pass. Lint has no errors;
  23 existing warnings remain. The Companion package contains 35 runtime files.
- The bundled Netlify function builds and returns a real 404 cache miss and
  successful CORS preflight. No live worker or production cache was contacted.
- A temporary Edge calibration page used actual HTML audio, real cache HTTP
  reads and the production engine/controller/renderer. Known cached targets
  reached DOM commits with sampled offsets of 3.61–10.22 ms; sampled animation
  offsets were 17.22–27.33 ms, with one decorative animation after seeking at
  85.36 ms. Pause, resume, seeking across chunks, double-rate playback,
  interruption and degraded delivery were checked. The grid remained 40 cells.
  These samples measure browser scheduling, not physical speaker/display
  latency or perceptual detection quality.
- The browser-installed Edge Companion supplied a real YouTube playback clock
  after restart. Capture denial selected decorative delivery with empty
  instrument counters; live pause cleared activity and resume restored timing.
  Advertisement identity was suppressed. The live check exposed retained
  preview players, motivating the canonical-player regression test. After the
  user reloaded the project Companion, the real song's provider/asset identity
  arrived correctly. Cache-miss and unavailable-analysis records, scheduled
  timing, controller commits, DOM commits and CSS animation records were
  observed end to end, with 40 cells and zero semantic onset counters.
- The integration test traces validated cached events through detection,
  scheduling, controller acceptance/state commit, DOM commit and animation.
  Existing local transport/recovery telemetry tests remain passing.

Temporary calibration media, cache entries, browser pages, configs and owned
servers are removed before committing. The source version label remains
Companion 0.3.13; no release/version bump was requested for this phase.

## Limits and unresolved questions

The configured analysis worker and a real event catalog still need operational
provisioning before production cache hits can improve music quality. This phase
delivers their working protocol and honest fallback behavior. Distributed
quotas and durable job idempotency belong to the configured worker; admission
inside this handler is instance-local.

Chrome/Brave/Cốc Cốc, low-end hardware, physical synchronization and perceptual
five-row quality remain the later phase gates. A live provider cache hit was
not asserted because no event catalog was provisioned. Stop after the separate
Phase 3 commit.
