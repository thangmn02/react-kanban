# Suspended employee badge

Status: superseded by the user's explicit centered-modal design correction. The tested badge implementation and recordings remain admission evidence; the current target is [the centered identity profile](../261027-1704-identity-profile/plan.md).

## Outcome and boundaries

The avatar releases an attached Kora badge that falls, swings briefly and settles. Exit completes before removal and restores keyboard focus. Keep identity data, Settings/crop/upload, language, authentication and workspace behavior. Preserve all previous integration changes, the shell, Focus and P3; no database changes or deployment.

## Implementation

1. Preserve admission copies and reconcile owned native/preview processes.
2. Replace the 10px dropdown motion with finite transform keyframes for the badge and connected tether. Clamp geometry to the viewport; use smaller motion on narrow screens and static reduced-motion reveal. Improve long-email hierarchy without changing its value.
3. Verify geometry, exit focus, rapid reversal and account/route invalidation with component tests. Capture release/fall/swing/settled/exit frames in actual browser tests; exercise Settings, mobile, reduced motion and Focus continuity.
4. Run typecheck/lint/build, relevant Playwright regression and frozen baseline preservation. Review the change, stop owned previews, and report evidence.

Evidence: `scratch/identity-badge-261027-1640/`. The broader product qualification remains recorded in [the existing plan](../261027-0846-product-completion/plan.md); this correction does not turn its pending gates into PASS.
