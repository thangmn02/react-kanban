---
title: Learned percussion latency and missing-event repair
status: in-progress
priority: P1
effort: medium
branch: main
tags: [music, percussion, latency]
created: 2026-10-08
---

# Learned percussion latency and missing-event repair

Deliver a lower-delay private listening candidate and a measured delivery/missing-event breakdown. Preserve the prior candidate, strong negative controls, Bass, disabled Melody, routing, merger semantics, server models and decorative isolation. Do not delay playback, shift timestamps to disguise latency, publish, or begin Phase 5.

- [x] Read the user's repair request and inspect capture, frontend, worker, peak decisions and existing validation.
- [x] Preserve the original listening bundle and record baseline stage timings.
- [x] Test a bounded smaller-cadence/context configuration against identical audio before adoption.
- [x] Implement smaller batching and the verified controller/animation delivery repairs.
- [x] Validate browser delivery, queue bounds, regressions, CPU/memory and listening controls.
- [x] Review, report measured limits, deliver private build and stop for user listening.
- [ ] Obtain independent positive annotations and resolve model-versus-peak accuracy misses.
- [ ] Meet perceptual timing/accuracy acceptance and verify weak-target performance.

Private handoff: 50 ms batching retains 100 ms model context; model thresholds,
Bass, mapping, merger, scheduler and normal decoration remain unchanged. Semantic-only
drum cells retain their existing 150 ms flash window across different-row batches.
Full suite: 102 files / 743 tests. Matched browser replay improves animation median
271→248 ms; its p95 remains ~322 ms. Negative events 66→63. Timing/quality acceptance
remains open; stop for the user's listening, with no automatic next tuning pass.
See [the measured repair report](../reports/validation-261008-1640-percussion-latency.md).

Human-verified positive percussion annotations are not available. The user will listen independently. Model-produced references cannot support independent precision/recall/F1; keep that gate open and provide an annotation route rather than invent scores. Negative controls retain the existing user-annotated drum-free ranges.

Reuse preview PID 3132 on 127.0.0.1:5173. Any isolated browser or evaluation process must be tracked and closed. Private audio, weights and exports remain in ignored src-tauri/target output.
