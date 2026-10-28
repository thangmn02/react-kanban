# Centered employee profile modal

Status: complete. `IDENTITY PROFILE MODAL: PASS`. This design explicitly replaces the anchored/swinging badge interaction. [Final report](../reports/engineering-261027-1704-identity-profile-modal.md).

## Outcome and boundaries

The header avatar opens a centered landscape Kora profile modal over a dimmed app. Use a restrained 180–240 ms reveal, focus containment and exit before removal. Adapt to a stacked mobile panel and static reduced-motion reveal. Preserve Settings/avatar/crop, language, sign-out, account/workspace invalidation, shell, tasks, Notes, Focus and P3. No database mutation, deployment or fictional title, tenure, skills or stats.

## Steps and acceptance

1. Preserve existing work and current admission copies. Retire only this correction's unused badge helpers.
2. Reuse the existing identity lifecycle and profile actions. Add real workspace role and read-only activity summary, with unavailable/loading states and account fencing. Omit unsupported expertise fields; retain the full email.
3. Verify modal centering, desktop landscape, backdrop, focus trap, all dismissal paths, rapid repeat behavior, Settings/avatar flows, mobile and reduced motion. Capture closed/open desktop and mobile screenshots.
4. Run focused component/service tests, type/lint/build and the existing integration browser suite. Review, record exact files and final `IDENTITY PROFILE MODAL` decision, and stop owned preview processes.

Evidence: `scratch/identity-profile-261027-1704/`. Earlier product qualification gates remain in their owning plan; a modal PASS does not complete hosted/native/physical qualification.

## Verification

All 1,201 unit/component tests pass. The final built-app regression passes 32 browser cases; an additional case verifies the same running Focus Dock remains mounted and its timer advances through profile/Settings. Real staging sign-in matches all activity values and membership date; a deliberate transport failure and retry recover correctly. Typecheck, focused lint, build, review, frontend secret scan and preservation of 91 protected files/three frozen models pass. Desktop/mobile closed/open screenshots and source/build hashes are retained. Temporary previews and browsers are closed. No deployment or product-data/schema write was performed.
