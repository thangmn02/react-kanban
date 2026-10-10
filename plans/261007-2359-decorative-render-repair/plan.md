# Separate decorative fallback from semantic hits

Preserve the failed Melody candidate and diagnostics. Repair only the proven
degraded tempo-to-all-row presentation leak. Keep the scheduler, merger,
detectors, models, row mapping, event identities and intentional shapes intact.

- [x] Prove degraded rendering cannot enter semantic row-hit CSS in regression tests.
- [x] Render generic fallback as a separate global decoration with explicit provenance.
- [x] Verify typed cache hits and existing shapes can coexist without identity changes.
- [x] Repeat the same real Nujabes 30-second normal/semantic-only comparison.
- [x] Check ordinary playback through the normal application path.
- [x] Run regressions, review, document evidence and stop before Melody/Phase 5.

Acceptance: no fallback `.onset` in any row; unchanged typed IDs/timestamps;
bounded exports distinguish global decoration from row-specific semantic hits.
No publication or database changes. Rollback is limited to this renderer/CSS
repair and its diagnostic fields; preserve all earlier unfinished work.

Playback checks used installed Companion 0.3.14 in isolated Edge. The normal
application route used real audio and existing local demo authentication without
API interception or controller injection; native/provider detector accuracy is
outside this check. Melody tuning and Phase 5 remain paused.

Status: scoped repair verified; stop. All 712 unit/integration tests and 21 Edge
UI regressions pass, with types/build/scoped lint passing. Owned test processes
are closed. See [repair evidence](../reports/repair-261008-1003-decorative-render.md).
