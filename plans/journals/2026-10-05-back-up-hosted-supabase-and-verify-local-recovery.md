---
title: Back up hosted Supabase and verify local recovery
date: 2026-10-05
summary: Encrypted database backup created; 49 tables verified by recovery drill.
---

# Back up hosted Supabase and verify local recovery

The hosted Supabase project had no available physical backups and PITR was disabled. Created a full logical database archive, schema/data exports and password-free roles outside the repository using official portable PostgreSQL 17.11 tools and the CLI's short-lived login credentials. Encrypted artifacts with Windows DPAPI CurrentUser and restricted directory ACLs.

Recovery testing used the encrypted artifacts. Supabase's role grantors, schemas and publications required local compatibility setup; original archived definitions were retained unchanged. All 49 application/auth/storage-metadata/migration table counts matched the source. Checksums matched and temporary plaintext/server processes were cleaned up. Platform-specific extension recovery was not verified, and Storage object files are not part of PostgreSQL dumps. Recovery requires the same Windows account/profile.

Added scripts/backup-supabase.ps1 and documented backup/recovery ownership in supabase/schema/README.md. Hosted application schema and migration history remain unchanged. Contact activation awaits the separately requested review approval.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
