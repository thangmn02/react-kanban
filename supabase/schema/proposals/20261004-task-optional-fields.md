# Task data update — review only

Nothing in this proposal has been applied to the hosted database. Do not run a bulk `db push`: review hosted migration history separately, following the existing schema README and backup requirements.

## Findings and compatibility

- Read-only, zero-row REST probes report a missing `tasks.repeat_interval` column. Sending null for this absent column was blocking ordinary task creation and edits.
- The attachment form previously discarded its payload. The hosted schema snapshot has no attachment storage. The proposed JSONB column stores link metadata only; it does not introduce uploads or change storage policies.
- Ordinary tasks now omit optional empty insert fields. Updates retry only exact missing-column errors for empty optional values; non-empty recurrence/attachment selections fail explicitly rather than being silently lost.
- Supabase permission/constraint errors are no longer hidden by generic task/board/list errors or incorrectly swallowed as missing checklist/label tables.
- Native AI suggestions now target the existing hosted authenticated API. The server's explicit native-origin CORS change requires a web deployment after diff approval; tokens, workspace RLS and rate limits remain required.

## Proposed operation

After separate approval and verified backups, inspect existing column types/constraints, run the accompanying SQL in one transaction, confirm the PostgREST schema reload, and reconcile migration history without repairing it blindly. Existing tasks, assignments, checklist/labels and RLS policies are retained. If either column already exists with incompatible types/values, abort and review rather than dropping data.

## Verification after approval

Use a dedicated test workspace/account to create and edit ordinary and recurring tasks, clear recurrence, save/remove attachment links, reload both surfaces and confirm persistence. Also verify checklist, labels, assignments, move/archive/restore and focus logging. Clean up only the explicitly created test records afterward. Authenticated live CRUD has not been claimed as verified by the anonymous schema probes or mock HTTP tests.

If deployment fails, transaction rollback preserves the prior schema. After a successful deployment, restore from the verified backup if needed; do not drop columns containing user data as a casual rollback.
