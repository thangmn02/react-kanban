# Connected qualification and reconciliation

Local connected qualification passed. Hosted qualification remains open because no explicitly authorized hosted staging target was supplied. No hosted schema, permissions or user records were changed.

## Actual local evidence

Docker became available during execution. The existing local stack initially contained only baseline migration history, zero auth users and no private identity bucket. Before any source migration, the tool saved a full custom PostgreSQL archive and proved restoration of public/auth/storage/app_private/migration schemas, original ownership/policies and table counts in a disposable database. Platform-extension recovery and Storage object bytes are explicitly excluded. Early failed restore attempts were retained; they prevented source writes. No database reset occurred.

Five pending repository migrations then applied atomically with their migration-history entries. Actual Auth/PostgREST/Storage tests passed for owner, admin, member, viewer and unrelated identities. The first Realtime check failed: metadata showed only `briefing_pins` in the publication. After another verified backup, the new idempotent task-publication migration applied locally and the complete actual connected matrix passed, including disconnect/resubscribe and authoritative refresh.

| Check | Local result |
| --- | --- |
| Completion/reopen, membership/timestamp, duplicate operation, one recurring successor | PASS |
| Owner/admin/member edits, viewer/unrelated denial and workspace isolation | PASS |
| Authenticated profile update, actual private image bytes, reauthentication persistence | PASS |
| Shared-member identity read, unrelated/anonymous read denial, cross-owner upload/delete denial | PASS |
| Actual Realtime update, disconnect, resubscribe and refresh | PASS |
| Actual connected Settings UI crop/drag/upload, cancellation, reload, sign-out/sign-in and default retirement | PASS |

The browser UI test builds the actual connected app against local services; it does not intercept service requests. The processed JPEG is verified through private Storage, and restoring the default confirms retirement of its previous object. Service-role use is confined to generated local fixtures and cleanup, with credentials kept in memory. Final local inventory: zero test auth users, zero identity objects, zero temporary restore databases; tasks is present in the Realtime publication. User-started Docker services remain running.

Private receipts under `scratch/integration-261027-0739/`:

- `local-database-qualified/backup-manifest.json` and `before.dump`: restore verified before the original pending migrations.
- `local-database-realtime-final/`: fresh backup/restore and task-publication migration receipt.
- `local-database-before-ui/`: restore verified before connected UI fixtures.
- `local-connected-results.json`: five real service/identity/reconnect groups passed.
- `connected-ui/results.json`, `saved-identity.png`, `site/`: final connected frontend and actual UI acceptance. Earlier UI receipt is preserved under `connected-ui-before-review/`.
- `local-final-inventory.json`: cleanup and publication inventory.

## Source migrations and hosted review

| Order | File | SHA-256 |
| --- | --- | --- |
| 1 | `20261026163000_task_workflow_transition.sql` | `eea6e5e6b27b04e3ee80ed621bdbe82f423d349e26b1ac769b6ebfef318760f0` |
| 2 | `20261026170000_private_profile_images.sql` | `35a39eb785d1a3a27864c428ad7f791949308c235eff022f897a898ded8a6e5f` |
| 3 | `20261027010000_task_workflow_realtime.sql` | `f21dd4282c28b2eecd9c1e3d1df22d335daf5e4f733e1608f34ffa1d0fe52361` |

The first two migrations retain their baseline bytes. The new publication migration changes no table grants or RLS. Dependencies and executable preparation commands are in [the recovery/checklist document](../../docs/connected-qualification.md). `qualify-staging-migrations.mjs` emits order/hashes or performs TLS-verified read-only metadata inspection; it refuses hosted `--apply`. Hosted migration history must be aligned through a separately reviewed process after verified recovery. No hosted PASS is inferred from local PostgreSQL, PGlite or local Auth/Storage success.

## Historical preview

The read-only auditor reprocessed the saved hosted snapshot from 2026-10-26. This is not a fresh hosted query. It again identifies eight distinct affected tasks: four completed-in-active-list findings and eight completion-timestamp inconsistencies, with overlap. No repair ran.

`scratch/integration-261027-0739/historical-reconciliation.json` includes each affected ID, board/workspace/list identity and title, completion state, position, recorded completion/update timestamps, proposed operations, ambiguity and recovery requirements. These private identifiers are intentionally kept out of this source report. Historical completion times remain unknown; neither `updated_at` nor a newly generated time is represented as historical truth. Any repair requires a current version comparison, transactional position/membership handling and a retained before-image plus verified backup.

## Collaboration audit

Existing workspace roles, assignment IDs, invitations and RLS remain authoritative. Actual five-identity tests verify edit/read boundaries and viewer rejection of membership insertion. Invitation expiry/acceptance and hosted revocation remain outside this run. The Notes increment is explicitly device-only; there is no Notes server table or client-only sharing permission. Resource ACLs and realtime co-editing remain deferred behind reviewed server persistence and authorization work.

Unresolved: identify and authorize hosted staging, verify its backup/recovery and migration-history route, then repeat the connected UI/multi-user/invitation/outage matrix there. Hosted user-data reconciliation requires a separate explicit decision.
