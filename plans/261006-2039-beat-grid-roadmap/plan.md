# Beat Grid scope and phase gates

This correction supersedes the remaining steps of the original Downloads
roadmap. All engineering stays on Beat Grid through the end of Phase 5. Music
or dock changes are limited to operating and validating Beat Grid. The five
rows and eight cells remain fixed.

| Phase | Status | Outcome and exit gate |
| --- | --- | --- |
| 0: Observability | Complete, `c492ab8` | Preserve detector-to-animation diagnostics. |
| 1: Recovery | Complete, `2cb55a5` | Preserve quiet, lease, late delivery and backlog recovery. |
| 2: Synchronization | Implemented; see validation limits | Authoritative media clock, timestamped look-ahead, lifecycle flush/rebuild, capability boundary and bounded scheduler. Known timestamps stay synchronized through seeks, pause, buffering and rate changes. |
| 3: Event data | Implemented; see validation limits | Server/precomputed EventTrack cache, versioned asset identity and bounded time chunks; asynchronous cache-miss analysis; local fallback and explicit non-semantic degraded mode; normalized capture clocks, priority merger/dedupe and seamless handoff. Every supported session has an event path and never freezes waiting for analysis. |
| 4: Five-row quality | In progress; gate open | Kick, Snare/Clap, Hi-hat/Cymbal, Bass/Low pulse and Melody/Main Lead. One dominant lead controls Melody. Dock restoration, legacy retirement, lead-reference preservation and a local server-analysis baseline are verified. Hosted activation and perceptual five-row validation remain pending. |
| 5: Production closure | Not started | Validate Chrome/Edge/Brave/Cốc Cốc, weak Celeron/i3 and normal desktops, CPU/RAM/long sessions/DJ media, lifecycle and capture timing, cache/local/degraded paths, chunks, regressions, telemetry and packaging. Responsive Beat polish only; no new architecture unless release-blocking. Exit means accurate enough, synchronized, bounded, graceful and releasable Beat Grid. |

Each phase gets its own completion commit only after its exit gate passes.
The latest 2026-10-07 PrimaryMelodyTracker request supersedes the earlier
automatic continuation: stop after Phase 4 for review, even if its gate passes.
Do not start Phase 5 yet. ADTOF, Basic Pitch,
HTDemucs and drumsep remain offline/server
candidates, not mandatory client inference. Experimental Bass DSP stays out of
Phase 2. After Phase 5, freeze Beat Grid architecture before other product work.

Execution: [synchronization plan](../261006-1813-beat-look-ahead/plan.md).
Validation: [synchronization report](../reports/diagnosis-261006-2039-beat-synchronization.md).
Event data: [execution plan](../261006-2116-beat-event-data/plan.md) and
[validation report](../reports/diagnosis-261006-2224-beat-event-data.md).
Five-row quality: [execution plan](../261007-0744-five-row-quality/plan.md) and
[current report](../reports/diagnosis-261007-1024-five-row-quality.md).
Server baseline: [implementation/validation report](../reports/diagnosis-261007-1421-server-beat-analysis.md).
Current range deployment and open quality gate:
[execution report](../reports/validation-261007-range-beat-analysis.md).
Primary Melody continuation and failed listening gate:
[plan](../261007-2159-primary-melody/plan.md) and
[report](../reports/validation-261007-2242-primary-melody.md).
Evidence: [telemetry report](../reports/diagnosis-261006-1534-beat-telemetry.md),
[recovery report](../reports/diagnosis-261006-1659-beat-recovery.md).
The supplied local Colab handoff is reference evidence; its locked row and lead
semantics are preserved above without adding its research models to production.
