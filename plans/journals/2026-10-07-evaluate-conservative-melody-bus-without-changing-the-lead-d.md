---
title: Evaluate conservative Melody bus without changing the lead default
date: 2026-10-07
summary: Ten real A/B excerpts show mixed activity; listening and authorized input gates remain open.
---

# Evaluate conservative Melody bus without changing the lead default

## What happened

Added a server-only MelodyBusDetector and explicit low-confidence opt-in policy. The accepted one-main-lead pipeline stays the default. Ten supplied 30-second excerpts ran through unchanged real separation/analysis for A and the same stems for B. Private audio, events, review sheets and a listening page stay ignored by Git.

## Findings

The first gain-invariance test exposed an absolute spectral-floor dependency; a relative floor repaired it without weakening the test. Melody Bus output varies across holdouts and configurable bands. Ambient attacks decreased from A's 37 to B's 17 with a longer gap. Only Levels and H.S.K.T. meet the experimental low-confidence guard. Additional activity cannot establish lead correctness.

## Evidence and decision

657 Vitest tests and 20 Python tests passed; scoped lint, syntax and normal-access TypeScript checks passed. B alone used 0.266–0.422 process CPU seconds per 30-second excerpt after separation. Report: plans/reports/validation-261007-melody-bus-experiment.md. Keep the experiment default-off; human lead alignment, misses and false flashes remain unmeasured. The authorized provider-audio input blocker is unchanged. No Phase 4 completion, Phase 5, production adoption, deployment or release. AgentWiki publish skipped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
