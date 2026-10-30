# Prepared production execution sequence

Status: preparation only. The October 29 22:01 owner instruction authorizes staging publication and explicitly withholds Production migrations and deployment. Do not execute this sequence until the complete release candidate qualifies and the owner separately authorizes its exact artifacts and operations. Historical task repairs are excluded. The [release phase](phase-release.md) and [readiness report](../reports/kora-final-production-readiness.md) own current gates.

## Admission and compatibility evidence

Production identity is `lthlvntvjgnornrdxnms`; staging is `enzzyuhchizfmruxhfhg`. The reviewed reconciliation plan SHA-256 is `fd80a81ce5daa5979dc23b51a6ed2c7b56c4e3fcbeadfa1be1de88c46e1514ca`. Its private execution evidence is `%LOCALAPPDATA%/Kora/backups/production/completion-rehearsal-261029-legacy-compatibility/`. Admission must compare the exact plan and migration byte hashes again; a changed file or hosted definition invalidates this rehearsal.

The networkless recovered production copy preserves 165 existing columns, 25 functions, 54 policies, 91 constraints, two buckets, 436 grants and 14 publication memberships after all twelve operations. Existing rows and the original three migration-history records remain unchanged. Seven authenticated legacy task operation groups, including position RPC and soft-delete/restore, pass in a transaction that rolls back. The unchanged copied Kora 0.1.31 executable separately passes real staging authentication, task read, editor save and reload recovery. These are bounded compatibility results; they do not assert every old-client workflow.

## Exact reviewed order

| Order | Source migration | Execution |
|---|---|---|
| 1 | `20260928160000_add_recurring_tasks.sql` | Reviewed DDL and history |
| 2 | `20261005120000_contact_messages.sql` | History record only after exact existing definition, owner and ACL equivalence; skip DDL |
| 3 | `20261026163000_task_workflow_transition.sql` | Reviewed DDL and history |
| 4 | `20261026170000_private_profile_images.sql` | Reviewed DDL and history |
| 5 | `20261027010000_task_workflow_realtime.sql` | Reviewed DDL and history |
| 6 | `20261027020000_connected_notes.sql` | Reviewed DDL and history |
| 7 | `20261027110000_note_private_invalidation.sql` | Reviewed DDL and history |
| 8 | `20261027111000_note_images_and_presentation.sql` | Reviewed DDL and history |
| 9 | `20261027112000_note_image_upload_retry.sql` | Reviewed DDL and history |
| 10 | `20261027113000_task_comments_saved_context_and_note_history.sql` | Reviewed DDL and history |
| 11 | `20261027114000_note_bookmark_lock_order_and_history_restore.sql` | Reviewed DDL and history |
| 12 | `20261027115000_task_comment_edit_body.sql` | Reviewed DDL and history |

Retain existing versions `20260713000000`, `20260913120000` and `20261007080000`. The last is a historical production migration absent from the current source set. Do not reset, squash, blindly push a prefix or replay the existing contact objects. The owning [reconciliation implementation](../../scripts/migration-reconciliation.mjs) and [rehearsal](../../scripts/rehearse-production-migrations.mjs) enforce the machine-readable plan; this table does not replace their guards.

## Fresh backup verification before execution

1. Independently verify the connected Production identity, verified TLS, migration history, object definitions, owners, grants, enforcement and publication membership. Abort on drift from the separately approved plan.
2. Capture a fresh consistent read-only database snapshot, encrypt it outside the repository/cloud-synced checkout, and verify isolated networkless restore with original rows, policies, grants, triggers and history. The retained October 28 snapshot is evidence for rehearsal, not a fresh execution backup.
3. Inventory Storage separately and back up current object bytes with separately authorized least-privilege read access. Do not reuse the image-backend secret. Verify bucket/path mappings, lengths and hashes, isolated Storage API restore and private/public access boundaries. A database dump does not back up object bytes.
4. Verify an off-device encrypted recovery copy and independently stored owner recovery key. Remove temporary signed capabilities under the retention policy. Keep all credentials and private inventories out of Git, release bytes and logs.
5. Retain the exact old web deploy, installer/feed and Companion artifacts and the exact newly qualified release manifests. Present the fresh evidence and execution hashes for the owner's separate Production authorization.

## Authorized release sequence, after all gates pass

Coordinate the write window; recheck the fresh admission evidence under the existing reconciliation guards. Apply the reviewed operations and history atomically using the approved writer. If the outcome is uncertain, inspect read-only state before any retry. Verify history, unchanged historical rows, RLS and legacy-client operations before enabling new web behavior.

Publish the matching qualified web and Linux image backend with server credentials restricted to Functions. Verify private image authorization and live generated release checks under separately authorized Production test scope. Then publish the matching signed Windows installer, signature and updater feed through the existing update workflow, followed by only the separately qualified and approved Companion artifact. Do not substitute the private debug-only 0.3.28 experiment for an approved public package. Recheck public hashes, signatures, versions, routes, legacy-client behavior and rollback availability at each step.

## Rollback

The retained complete Netlify deploy is `6aceb65d7544427364f295f3`, with the existing Kora 0.1.31 installer/feed. Verify these identities again before execution. Web rollback restores the complete prior deploy and matching update artifacts; it does not undo database changes. The tested additive schema allows the old client to remain available for the tested workflows. Do not automatically drop Notes tables or discard subsequent user writes.

A database or Storage restore requires separate explicit authorization, a verified restore target, a coordinated writer stop and preservation of writes made after the backup. Database and object-byte recovery must remain consistent. Stop promotion and retain evidence on any verification failure; do not perform historical task reconciliation as part of rollback.
