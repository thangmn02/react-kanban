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

## Manual encrypted backup without Docker

For a Windows machine without Docker, use
[backup-supabase.ps1](../../scripts/backup-supabase.ps1) with PostgreSQL 17 client
binaries from the [official Windows download route](https://www.postgresql.org/download/windows/).
The script uses the linked Supabase CLI's temporary database login, captures a
full custom-format `pg_dump` archive and separate schema/data/role exports, and
stores them outside the repository. It never prints connection credentials.
Role exports omit passwords.

```powershell
./scripts/backup-supabase.ps1 `
  -BackupRoot "$env:USERPROFILE/KoraBackups" `
  -PostgresBin '<directory containing pg_dump.exe and the other PostgreSQL tools>' `
  -ProjectRef '<the exact linked project reference>'
```

Output includes `manifest.json`, encrypted `.dpapi` exports and `RECOVERY.txt`.
Encryption is Windows DPAPI CurrentUser: recovery requires the same Windows
account/profile on this computer. Copying these files alone does not provide
portable disaster recovery on a replacement computer; retain Windows recovery
credentials or arrange separately approved portable encryption. The containing
directory grants access only to the current user.

The script decrypts its exported artifacts and restores the `public`,
`app_private`, `auth`, `storage`, and `supabase_migrations` schemas into a private,
temporary PostgreSQL instance at loopback port 54329. It compares every table's
row count against the source, then stops that instance and removes plaintext
staging files. For the local drill it retains the local administrator, changes
membership grantors to that administrator and supplies schemas/publications and
standard extensions; the original encrypted exports preserve hosted definitions.
Supabase-specific platform extensions are included in the archive but are not
verified through local restore. A failed drill keeps encrypted artifacts and
encrypted diagnostics, and cannot claim `restore_verified`.

To retry only the local recovery test, use the same arguments with
`-ExistingBackup '<previous output directory>'`. This uses the encrypted
snapshot and its recorded counts; it does not recapture newer hosted rows.
An occupied restore port fails rather than starting another instance.

[Supabase database backups](https://supabase.com/docs/guides/platform/backups)
contain Storage metadata rather than Storage object files. Copy objects
separately when recovering deleted files is part of the intended backup scope.
Edge Function secrets and hosting environment configuration also need their
own recovery route. This manual backup does not enable PITR or automatic hosted
backups, and does not repair migration history or authorize a hosted restore.

## Safety boundary

This branch only reads the linked project and rebuilds disposable local
databases. Do not run `supabase migration repair`, `supabase db push`,
`supabase config push`, or otherwise alter the hosted project or its migration
history. Hosted-history alignment is a separate, reviewed operation after this
branch is approved.

The owner separately authorized Contact activation on 2026-10-05 after a
verified encrypted backup. Only the Contact migration was applied in one
transaction; all 21 hosted pgTAP checks passed and migration history was left
intact. This exception does not authorize baseline replay or history repair.
See [Contact setup](../../docs/contact-setup.md) for its operational route.

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
