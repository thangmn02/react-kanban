# Lead v1 product beta integration

Outcome: enable the frozen Lead policy in normal development Web/Desktop, with
separate internal-beta/public controls, truthful readiness and shared timestamp
delivery. Keep research players/selectors private. Public processing remains
closed without rights and authorized audio; missing backend capability is explicit.

Constraints: no detector tuning, new models, Row 1–4 changes, scheduler/renderer
redesign, deployment or database changes. Reuse existing cache, clock and grid.

- [x] Inspect rollout, authorization, cache/service and native boundaries.
- [x] Implement minimal flags, normal Beta status and failure/processing safeguards.
- [x] Run affected tests, safety checks and normal-UI Playwright/native checks.
- [x] Review, update owning setup docs and report remaining release gates.

Internal cached-playback delivery is complete; public processing, uncached service
operation, native GUI and local database validation remain gated as documented in
[the report](../reports/validation-261009-1620-lead-product-beta.md).

Acceptance: normal five-row UI has no research controls; real saved cache events
reach Lead on the actual media clock; lifecycle cleanup and unavailable/empty
distinction pass; Web/Desktop share schema/timestamps; public processing stays
disabled. Preserve the v1 source/output hash lock and ignored raw diagnostics.
