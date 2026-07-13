# Authoritative schema baseline workflow

The hosted Supabase database is the schema authority. The active migration is
the verified, squashed representation of that schema; older transitional
migrations are retained under `supabase/migrations_archive/pre_squash_20260713/`
for audit history and are not applied by `supabase db reset`.

## Backup requirement

Before any future migration-history repair or baseline deployment, retain both
of these backups outside the repository:

1. A Supabase Dashboard database backup, or a confirmed Point-in-Time Recovery
   restore point, for the hosted project.
2. Timestamped logical backups made with `supabase db dump --linked`, including
   schema-only and data-only dumps. Store data dumps encrypted and perform a
   restore drill before changing hosted migration history.

Never commit production rows, database passwords, access tokens, or data-only
dumps. The tracked SQL snapshots in this directory are schema-only.

## Safety boundary

This branch only reads the linked project and rebuilds disposable local
databases. Do not run `supabase migration repair`, `supabase db push`,
`supabase config push`, or otherwise alter the hosted project or its migration
history. Hosted-history alignment is a separate, reviewed operation after this
branch is approved.

## Hosted inspection evidence (2026-07-13)

```powershell
npx supabase migration list --local
npx supabase migration list --linked
npx supabase db dump --linked --schema public,app_private,storage --file supabase/schema/hosted-schema.sql
npx supabase db dump --linked --schema public,app_private --file supabase/schema/hosted-app-schema.sql
npx supabase db dump --linked --schema auth --file supabase/schema/hosted-auth-schema.sql
```

Before squashing, `migration list --linked` showed all 14 former local
timestamps with an empty remote column. After squashing, the local database
reports only `20260713000000` as applied, while the linked project reports that
same active local timestamp with an empty remote column. The hosted
migration-history table still contains no matching entry. No repair command
was run.

Snapshot checksums:

| Snapshot | SHA-256 |
| --- | --- |
| `hosted-schema.sql` | `62F3FEFE2BA57860912119F5938CDAC8C33CF39F840D34E06198FF2ADED6238A` |
| `hosted-app-schema.sql` | `4E873FCC6A5A06AB544C46D4E95714DED957EA95AF3917BBEC3FA62F72E676A5` |
| `hosted-auth-schema.sql` | `245CBD97B48C28F41811AD8EBADE27306E6124D00EF10F048992D9C9CF98A272` |

The active `20260713000000_squashed_hosted_baseline.sql` contains the hosted
`public` and `app_private` schema, the verified `auth.users` profile trigger,
and the hosted `task-covers` bucket and policies. The only deliberate schema
addition is the private, revoked `app_private.plpgsql_check_pragma` helper and
its annotation of the temporary reorder table; it lets strict `plpgsql_check`
understand the hosted `update_task_positions` function without changing its
runtime behavior.

## Empty-database verification

Supabase CLI is pinned to `2.109.1` in both `package.json` and CI.

```powershell
npx supabase stop --no-backup
npx supabase start
npx supabase db reset
npx supabase db lint --level warning --fail-on error
npx supabase test db supabase/tests/database --local
```

The reset, strict lint, and 33-test pgTAP RLS suite pass from an empty local
database. The suite uses two users and two workspaces and covers `boards`,
`lists`, `tasks`, `focus_sessions`, memberships, invites, and task-cover
objects for allowed and denied reads/writes.

## Local-to-hosted comparison

```powershell
npx supabase db dump --local --schema public,app_private --file .tmp/local-app-schema.sql
git diff --no-index -- supabase/schema/hosted-app-schema.sql .tmp/local-app-schema.sql
```

After reset, the application-schema diff is limited to 19 inserted lines: the
private lint-only helper definition/ACL and its call inside
`update_task_positions`. Tables, columns, functions, grants, and RLS policies
otherwise match the authoritative hosted application-schema snapshot.
