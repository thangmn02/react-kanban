# Task workflow correctness

Status: implemented and locally qualified; connected/native qualification remains blocked. Latest user direction: integrate existing qualified P3 without reimplementation; fresh combined Web/Windows regressions. P4 Engineering stays PARTIAL and Production Release stays BLOCKED. Do not publish production, alter P2 detectors or compensation. Extends the existing UX branch; correctness precedes further styling. Preserve all inherited changes, including newer P3 work since UX verification.

## Outcome

One domain transition owns completion, timestamp, workflow list/position, activity and recurrence. Complete and drag into Done agree; reopen and drag out agree. All entry points use the same service. Compact rich-text previews are readable and inert. Verify persisted outcomes, race/failure handling and cross-view freshness; audit historical data without bulk correction or deployment.

## Decisions and boundaries

- Schema has no semantic list role or persisted template ID. Recognize only the complete ordered canonical Simple Kora (To-do / Doing / Done) or Software Mini Project template shape, normalized for case/punctuation. All other boards use explicit completion-only mode; never guess the last list or create a column.
- Add a narrowly scoped transactional RPC as migration source, without applying it to any hosted database. A single existing row update cannot atomically include completion, history and exactly-once recurrence. The RPC uses existing tables, workspace edit permission checks and RLS, with no new columns or data rewrite. Hosted application requires operator backup and migration qualification before connected PASS.
- Local mode commits one serialized next-state snapshot only after a recoverable backup succeeds; storage failures must propagate. Browser Web Locks serialize local workflow writers across tabs.
- Activity records retain previous workflow location. Reopen restores a still-valid active location from history; otherwise the canonical first active list is the explicit fallback. Recurrence creates one successor per source task, even after reopen/recomplete; reopening never deletes a potentially edited successor.
- P0 owns task domain/services/local store, completion adapters and relevant UI/test contracts. Focus timer/session engine, P3 renderers, audio/capture, detectors and compensation remain outside scope. Focus completion adapter may call the shared operation; controller identity remains intact.

## Steps

1. Back up current source; diagnose schema/entry points and capture baseline evidence.
2. Fix centralized rich-text preview spacing/entities/unsafe content and confirmed Today rendering.
3. Implement pure workflow policy, dry-run anomaly audit, atomic local transition and server RPC source.
4. Route Board moves/completion, Task Detail, Today and Focus through the domain service; reconcile from persistence on failures and reject stale moves rather than rolling back unrelated edits.
5. Verify the required transition matrix, recurrence/idempotency, storage/server failures, reload, counts, cross-view freshness and actual browser workflows. Independent review before acceptance.
6. Deliver [P0 report](../reports/kora-p0-functional-correctness.md), anomaly counts/previews, exact changes, evidence and limitations. No deploy, hosted migration application or automatic bulk repair.

Evidence/rollback: scratch/p0-261026-2311. Restore only P0-owned differences, never reset this dirty branch. Existing user local/hosted data is not a test fixture and must remain untouched.

Final evidence: [task correctness report](../reports/kora-p0-functional-correctness.md), [identity/motion report](../reports/kora-user-identity-settings-card-motion.md), [combined build results](../reports/kora-integrated-build-results.md). No hosted migration, bulk repair or production release was performed.
