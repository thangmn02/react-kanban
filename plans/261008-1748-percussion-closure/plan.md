---
title: Bounded learned percussion closure candidate
status: in-progress
branch: main
created: 2026-10-08
---

Implement one private causal learned candidate and a range-scoped precomputed listening route. Preserve ADTOF references, Bass, disabled Melody, renderer, merger and scheduler. No release or new threshold variants.

- [x] Reuse the established diagnosis and inspect existing model/cache/runtime owners.
- [x] Train/export one past-only temporal model reproducibly; document pseudo-label and licensing limitations.
- [x] Wire private runtime with learned abstention and prove future-feature independence.
- [x] Prepare 20–30 calibration/holdout excerpts and an independent annotation interface.
- [x] Exercise real EventTrack range caching and media-clock scheduling.
- [x] Measure matched latency, negative controls, sustained 10-minute resources and lifecycle recovery.
- [x] Run focused/full regression gates; review and deliver report with explicit PASS/FAIL/BLOCKED gates.

Positive teacher scores are training targets only, never evaluation truth. Caravan is included as an unannotated holdout. Human positive labels, Whiplash and isolated brass/roll references remain unavailable. Candidate accuracy fails; positive acoustic metrics, weak-machine validation and production rights remain open. Candidate weights stay in ignored target output. No adoption, further training, Melody or Phase 5 work is authorized automatically.

Execution evidence: [private playback comparison](../reports/validation-261008-2052-percussion-playback-comparison.md). Technical completion does not close the failed product-quality gate. Stop for review after the comparison and sustained check.
