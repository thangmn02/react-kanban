---
status: complete
---

# Phase 0: trace Beat Grid delivery

Outcome: trace an existing rendered flash from its producer through queues,
transports and UI gates, and locate starvation without changing detection.

Scope: opt-in, bounded local structured telemetry, a technical map, tests and
one separate commit. Preserve thresholds, timers, random visuals, row semantics,
capture recovery and existing optional AI behavior. Introduce no new models.
Later roadmap phases are outside this task.

1. Archive canceled timing edits and inspect the published baseline.
2. Map capture, analysis, worker queues, transports, controller and renderer.
3. Add correlated event metadata and lifecycle/queue/drop observations.
4. Verify telemetry, disabled behavior and existing pipeline tests; review.
5. Write the concise report and commit Phase 0 separately. Do not deploy.

Acceptance: onset/tempo/random provenance stays distinct; a flash carries an
opaque producer ID into the renderer; observable drops include existing queue,
deadline, owner, sequence and debounce gates. Debug storage is bounded, private,
local and disabled by default. Tests show detector/capture output is unchanged.

The canceled task's 14 modified files and new spectrum helper were archived
under ignored `scratch/abandoned-beat-timing-261006/` and restored to HEAD before
this phase. Ports 1420/1431 have no listening owner; previous exec sessions no
longer exist at preflight. Earlier plans/icons remain untouched and outside the commit.

All five steps are complete. The source map, verified failure points and test
evidence are in the [report](../reports/diagnosis-261006-1534-beat-telemetry.md);
developer usage is in [telemetry documentation](../../extensions/kanban-music/README.md#beat-grid-telemetry).

Verification: full suite 576 tests / 81 files passed; final affected suite 225
tests / 28 files passed; native binary 12 tests passed; TypeScript and production
build passed. Lint has zero errors and 23 existing warnings; touched TypeScript
files pass focused lint. ZIP integrity/relative imports (33 runtime files) and
documentation links passed. Browser CSS animation-start correlation was checked.

Review resolved diagnostic-only timer dependencies, stale metadata after
handoff, bounded observer state, renewal reporting and malformed sidecars.
No unresolved in-scope findings remain. All detector/tempo/tracker/CSS source
files remain identical to baseline. The 16-byte PCM header is preserved.
Physical latency and low-end performance remain unmeasured, as recorded in the
report; no later roadmap behavior is implemented.

Verification server: Vite PID 17820, port 1420, this workspace; terminal session
95774. Its browser fixture and server are task-owned and stopped at delivery.
Build/test sessions finish normally. No deployment or push is included.
