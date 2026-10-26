# Integrated task correctness qualification

P0 CORRECTNESS: **PARTIAL**. Local behavior and isolated PostgreSQL transition tests pass. Hosted RPC/RLS, authenticated multi-client and reconnect qualification remain open; no hosted migration or repair was applied. Production Release remains **BLOCKED**.

## Result and implementation

Board, Task Detail, Today, Focus and task drag operations use one workflow service. The pure policy recognizes the complete ordered canonical templates; other/custom/reordered shapes expose completion-only behavior. Completion and movement into Done agree. Reopen restores the last valid active location, with the first active column as the explicit fallback. List membership, timestamp, ordering, activity and recurring successor are persisted together. Recomplete does not generate another successor; reopening preserves an existing successor.

Connected persistence uses the new SECURITY INVOKER transactional RPC, authenticated workspace edit permission and existing RLS, task/board/list locks, operation IDs and optional version/source checks. Local persistence reads the current scoped store, saves a recoverable backup, then commits one serialized snapshot. Web Locks serialize supported browser tabs. Cross-tab workflow concurrency without Web Locks is not qualified.

Failed optimistic updates reconcile from authoritative state rather than restoring a stale full snapshot. Old workspace callbacks cannot invalidate a new workspace load, apply/cache old results or close current dialogs. Focus refresh generations reject older snapshots; authoritative missing/deleted tasks are removed, their active timers pause, and newer completion versions outrank older board projections. Timer engine, detectors, audio compensation and P3 presentation logic were preserved.

Compact rich-text previews share inert parsing, block/list spacing, entity decoding and unsafe-node removal. Original editor HTML is retained. Shared board form labels now identify their inputs correctly.

## Required regression matrix

| Required case | Evidence/result |
| --- | --- |
| 1. Complete TO-DO → DONE | Parameterized local test + canonical browser: PASS |
| 2. Complete DOING → DONE | Parameterized local persistence test: PASS |
| 3. Drag TO-DO → DONE → Completed | Real keyboard browser + SQL/local transition: PASS |
| 4. Move DONE → DOING → reopen | Browser reload/keyboard movement + SQL/local transition: PASS |
| 5. Reopen from Task Detail | Canonical browser: PASS |
| 6. Complete from Today | Canonical and existing UX browser workflows: PASS |
| 7. Complete during Focus | Running controller → real Focus page Complete & next → persisted Done: PASS |
| 8. Double-click Complete | Concurrent duplicate service requests yield one status activity/successor: PASS |
| 9. Failed server update/reconciliation | Actual SQL injected activity failure rolls back fully; failed drag refresh preserves unrelated edits: PASS in isolated tests; hosted outage is unqualified |
| 10. Refresh/reopen same board | Canonical persisted browser workflow: PASS |
| 11. Local demo storage | Snapshot, backup, quota-failure and reload tests: PASS |
| 12. No valid DONE mapping | Local + SQL completion-only checks and visible UI explanation: PASS |
| 13. Recurring completion | Next active occurrence/due date, no duplicate after reopen/recomplete: PASS |
| 14. Cross-view synchronization | Same canonical task completed/reopened through Board/Detail/Focus/Today; older Focus snapshot and cross-tab deletion regressions: PASS in tested scope |
| 15. Counts after transitions | Actual local list counts checked after move/complete/reopen/recomplete/move-out, browser membership/reload: PASS |
| 16. Rich-text paragraphs/entities/lists/malformed/unsafe HTML | Seven inert preview unit cases + real editor paragraph preview in Today: PASS |

Additional release gates remain open: hosted RPC/RLS, authenticated multi-client concurrency and offline/reconnect qualification. Isolated permission fixtures are not hosted evidence.

Final integrated suite, browser totals and build fingerprints are recorded in [integrated results](kora-integrated-build-results.md). Earlier failed browser attempts remain represented in private logs; fast keyboard steps were corrected to wait for actual destinations/loading completion, without weakening persisted-state assertions.

## Existing-data audit — read only

Linked Kora database readiness returned 24 task rows and 6 profiles. The metadata-only audit found **4 completed tasks in canonical active columns** and **8 completion timestamp mismatches**. Counts overlap by task; they must not be added as distinct tasks. No missing-list, active-in-Done, invalid-position or duplicate-position findings appeared in the generated preview.

The private `scratch/p0-261026-2311/hosted-reconciliation-preview.json` retains each affected ID, before-values, update version and proposed operation. No task titles, descriptions or emails were exported. `scripts/audit-task-workflow.mjs` is the reusable read-only preview tool. Timestamp history cannot be reconstructed safely; proposed operations are not approved bulk repairs.

No database backup succeeded: the Docker-dependent CLI dump was blocked by the stopped Docker daemon. Subsequent linked queries were read-only Management API queries. Before applying migration source, obtain a verified restorable backup and qualify on a non-production database. No automatic reconciliation, public deployment, installer replacement or release promotion occurred.
