# Beat event data engine

Baseline: `0520f97`. Complete Phase 3 only, commit separately and stop.
Preserve the five-by-eight grid, dominant-lead semantic, existing detectors,
visual randomness, timestamp scheduler, recovery and diagnostics. Do not ship
new ML models, experimental DSP, quality tuning or unrelated product work.

Primary delivery is validated, precomputed EventTrack data identified by stable
provider/media identity. A cache miss may request asynchronous analysis through
a configured service, while local capture keeps delivering. Where capture is
unavailable, explicitly non-semantic decorative timing keeps an honest degraded
path. No fabricated cache entries or pretend analysis jobs.

Use versioned manifests and fixed time-range chunks, bounded parsing, memory,
requests and scheduling. Server/local events merge by semantic row/time with
priority replacement before release and dedupe after release. Media clock,
seek, buffering, source and lease changes must invalidate stale work while
allowing fresh event delivery. Capture normalization keeps the completed shared
boundary and declares estimated versus output-clock capabilities.

The backend reads deployed precomputed JSON or an explicitly configured cache
origin. Analysis submission uses a fixed configured service, verified user and
idempotent asset key; no arbitrary audio URL fetching. This phase introduces no
database schema or data mutation and does not deploy external infrastructure.

## Work and exit checks

- [x] Add stable identity, EventTrack schema and real cache/analysis API.
- [x] Add bounded chunk retrieval and capability-aware fallback orchestration.
- [x] Merge semantic priorities and dedupe seamlessly through the existing scheduler.
- [x] Integrate and expose cache/local/degraded status without changing normal visuals.
- [x] Test cache hits/misses, unavailable server, chunks, handoffs, lifecycle and telemetry.
- [x] Run full suites, browser checks, build, review and report; commit and stop.

Exit gate: every supported session has a defined cache, local or degraded path,
and analysis/cache waits cannot freeze Beat Grid. Cache data must match the asset
and schema; memory and queued work remain bounded throughout long media.

Rollback: revert this focused commit. No release or publication is included.

Validation and operational limits: [event data report](../reports/diagnosis-261006-2224-beat-event-data.md).
