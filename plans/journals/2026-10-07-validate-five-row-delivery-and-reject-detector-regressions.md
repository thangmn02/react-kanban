---
title: Validate five-row delivery and reject detector regressions
date: 2026-10-07
summary: Recorded verified changes and open quality gates.
---

# Validate five-row delivery and reject detector regressions

Restored browser Dock, retired legacy model path, verified semantic delivery and recorded rejected detector trials. Phase 4 remains open; see plans/reports/diagnosis-261007-1024-five-row-quality.md. Passed 638 unit/integration, 16 isolated Edge and 14 native tests. Complete Colab lead arrays, perceptual checks and live Companion validation are pending. No release or Phase 5 work.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Server baseline continuation

The user supplied the complete lead export and authorized server-side uncached
analysis. Its 37/22 attacks survive selection/import. Added a replaceable,
single-worker persisted analysis service with server-only model dependencies,
bounded public-media resolution and atomic validated cache publication. Eight
real excerpts, a silent fixture and a segment-boundary fixture passed data-path
checks. Current verification: 641 unit/integration tests, seven worker tests,
16 isolated Edge tests, build/lint/bundle checks. A real-audio browser harness
verified cache/controller/DOM delivery; foreground animation/perceptual and
fresh Companion playback gates remain open. Hosting selection and container
validation are pending. No completion commit, release or Phase 5 work.

See [the current report](../reports/diagnosis-261007-1421-server-beat-analysis.md).
