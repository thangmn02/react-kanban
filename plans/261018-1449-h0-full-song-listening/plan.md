# H0 full-song listening

Status: complete; human listening pending. Branch: `codex/beat-grid-quality-recovery`; base: `85b9fddcd22c296e7bbaee3c1fc40064be762fd8`.

## Outcome and accepted boundary

Expose the existing `H0-frozen-routing-diagnostic-v1` in the private full-song lab: exact A Kick/Snare plus B Hat, Short Attack initially, uninterrupted A/B/H switching on one native audio clock. Make retained recordings selectable by exact hash without changing user upload slots. Preserve qualitative notes and missing coverage. The user explicitly accepts frozen H0 listening after earlier correction experiments were rejected.

No inference, new models, thresholds, filters, timing adjustments, production detector changes or deployment. Prior negative-passage evidence remains visible. No acoustic accuracy or live qualification claim.

## Execution

1. Reuse canonical Python H0 routing through a bounded local JSON bridge, cache by algorithm and validated source/A/B record identities. Preserve component provenance and coverage.
2. Extend full-song catalog/track UI and qualitative feedback; keep blind annotation A/B/C contracts unchanged.
3. Test exact routing, gaps, cache isolation, simultaneous classes, playback/seek/loop, renderer parity and sustained playback. Run research/app regressions, type/lint/build/bundle/package checks.
4. Read-only review, owning docs update, commit and delivery receipt. Leave one tracked loopback server and stop for human evaluation.

Acceptance: three exact retained recordings ready; H has only A Kick/Snare and B Hat with original IDs/times; Rằng [26,44) retains B's 21 Hat; source/model/renderer changes behave as specified; all required gates honestly reported.

Risks: centered CNN/global normalization, physical synchronization, AGPL integration and weight distribution remain unresolved. Revert this sprint's commit to remove H UI; saved source caches and old notes are retained.

Report: [engineering report](../reports/engineering-261018-1449-h0-full-song-listening.md).

Validation: exact routing/provenance and A/B/H continuity passed for all four retained recordings. Both renderers received all 29 H events in N1. Complete 180-second 1× playback with 29 switches passed. App 912 tests, Node 24, Python 17, types/lint/build/bundle/package and all relevant browser regressions passed. Review finding fixed and re-reviewed. Private receipt: `scratch/h0-full-song-listening/delivery.json`. No further detector experiments are authorized by this delivery; stop for user listening.
