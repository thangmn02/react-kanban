# Contact implementation verification — 2026-10-05

The Contact route, responsive bilingual form, Turnstile lifecycle, private
message migration, atomic admission RPC and Resend notification handler are
implemented. Server secrets were uploaded to the Supabase project selected from
the app's existing Supabase URL. No secret values or recipient are in source.

## Evidence

- Full Vitest suite: 70 files / 507 tests passed before the final simplification
  and additional two route cases. Focused final run: 4 files / 43 tests passed.
- Application type check and separate strict Edge Function type check passed.
- Production build passed. Existing Vite native-config and chunk-size warnings
  remain; the main bundle is below the existing one-megabyte budget.
- Full lint passed with zero errors and 23 warnings in existing files; touched
  Contact files passed focused lint.
- Disposable PGlite PostgreSQL database was backed up before schema application.
  Actual migration execution, role denial, service update access, three-message
  admission, fourth-message denial, distinct IPs, hourly reset and failed-insert
  rollback passed. This single-connection check does not prove concurrent locking.
- Added a 17-case pgTAP suite for the normal local Supabase stack. It was not run
  through Supabase: Docker/local stack is unavailable in this environment.
- In-app browser opened the actual public form while signed out, at normal and
  390px mobile widths. Cloudflare automatically produced a token without user
  interaction; the Send button became enabled. No live message was submitted.
- Checked the built client against local secret values: zero server secrets or
  private recipient matches; the intended public Turnstile site key is present.
- Conditional simplifier made scoped edits to bounded body parsing and frontend
  error handling, then passed focused tests/types/lint. Controller review retained
  honeypot, raw control-character rejection, proof action/hostname checks and
  notification failure retention.
- The temporary Vite process was stopped and port 5173 is no longer listening.

## Activation remaining

Hosted read-only SQL confirms Contact tables do not yet exist and service_role
does not currently have private-schema usage. The migration explicitly grants
the permission needed for notification markers. The hosted Edge Function list
contains no Contact function. Only the six Contact secrets were configured.

Before changing hosted schema, confirm a recoverable backup and obtain the
reviewed-operation approval required by supabase/schema/README.md. Apply only
the new Contact migration transactionally; never replay the baseline or repair
migration history as part of this feature. Then deploy only the Contact function,
configure the hosting build's public site key, and verify a real form submission
and inbox delivery. The configured Resend test sender has not been verified by
an actual send; use a verified dedicated sender for production.

The implementation plan remains in progress until activation and delivery
verification have evidence. Setup and rollback are in docs/contact-setup.md.

## Authorized activation and release — 2026-10-05

The owner's "so do it" authorized Contact activation and publication. Fresh
backup `2026-10-05-215717` restored all 49 source tables. Applied only Contact
SQL in one transaction, then passed all 21 pgTAP checks against the hosted
project inside a rolled-back test transaction. Uploaded six server secrets and
deployed only `contact` through the Supabase API. Migration history was not repaired.

Hosted PostgREST exposes public/graphql_public, so notification markers now use
the service-only `public.record_contact_notification` RPC without exposing
private tables. Final Contact handler tests and strict types passed.
Full frontend/extension/function suite: 71 files / 510 tests passed with two
workers; earlier three default-worker timeouts did not recur. Final focused
regressions: 7 files / 85 tests passed. Type checking and lint passed (23 existing
warnings, zero errors); all nine Rust tests passed.

Built Kora 0.1.8 with the existing protected updater key. Verified the actual
installer signature against the application's public key and verified a byte
change is rejected. Installer SHA-256:
`e19724e1e3768d42f1a279b1f2adcad10e2bb2d1c480a24bf9bcfdbe644efec8`.
Website rebuilt after staging its matching installer/feed; bundle budget passed.
Built JavaScript contains the public Turnstile key and no local server-secret or
recipient values. Added the public key to GitHub Actions variables and the
existing Netlify project configuration.

Prior published Netlify deploy for rollback: `6ac27a7b4f03ec00081681e3`.
Production published revision `70b9cd9` in Netlify deploy
`6ac3bfdb5c958c0008ab7baf`. The public feed is 0.1.8 and its complete signature
matches the local feed; downloaded production installer SHA-256 matches the
verified signed bytes. Both cache headers and the existing AI function route passed.
Published via the existing GitHub integration; no new Netlify CLI credential was
authorized or created.

The actual production form completed real Turnstile verification automatically.
Submitted one labelled release check, displayed the successful received state,
and verified exactly one private message with its notification marker and no
pending rows. Live filled-honeypot and invalid-token requests returned 400 and
created no additional rows. Public-key calls to both service RPCs were denied
(401); private-schema API reads were denied (406).

All CI jobs passed for the release: quality/coverage/build/budget, local Supabase
reset/lint/all pgTAP tests, Playwright end-to-end tests, and signed Windows build.
The restricted sending key cannot retrieve Resend delivery events (401); this
is not a key failure. Provider acceptance is verified; final inbox receipt still
requires owner confirmation or an authenticated delivery dashboard.

## Final navigation correction and 0.1.9

Live verification found that direct `/contact` startup leaves `activeBoardId`
empty by design, making Board navigation a no-op. Fixed navigation to resolve
the remembered board from the selected workspace or its first real board, and
send signed-out visitors to sign-in without fetching private data. Three new
regression cases passed; all 513 tests across 71 files passed afterward, along
with types, focused lint and production build/budget.

Rebuilt and signed Kora 0.1.9, then staged the matching installer/feed and rebuilt
the website. Its signature verifies and a byte change is rejected. SHA-256:
`8831bc361687a3ceebbd086286ccbaaa44c0faacfeaabc40f358b70e40d64050`.
No private configuration values occur in built assets or release source.
Actual web board verification found both expected task cards in My Workspace (1).
Final published revision: `25dadd7`, Netlify deploy `6ac3c38c835cbf00082a4116`.
Downloaded 0.1.9 installer exactly matches the verified signed bytes, the public
feed/signature pair matches, and live rejection/API access checks pass again.

The owner confirmed receipt of the test notification in Gmail. Contact is
verified end to end: real Turnstile proof, private storage, provider acceptance
and actual inbox receipt. Final production direct Contact-to-Board navigation
opens the expected three-card board without an intermediate Home visit.

## Hosted backup completed — 2026-10-05

After the user requested backup assistance, checked physical backup availability:
the project returned no available backups and PITR disabled. Created an encrypted
full PostgreSQL custom archive, schema/data SQL and password-free role export
outside the repository under the user's KoraBackups directory. Added a reusable
Windows backup/recovery-check script and documented its operational route in
supabase/schema/README.md.

Decrypted the actual artifacts and restored application/auth/storage-metadata and
migration schemas using portable PostgreSQL 17.11. All 49 source table counts
matched. Artifact checksums match the manifest, plaintext staging was removed,
and the temporary server was stopped (port 54329 no longer listening).
The drill supplies local schemas/publications and changes grantors only in its
temporary role copy; original archived role definitions remain intact.
Supabase platform-extension recovery and Storage object-file recovery are outside
the verified drill. Encryption requires the same Windows account/profile.

Backup is now verified. Hosted Contact schema/function activation still awaits
the previously requested review approval; no hosted application schema or
migration-history change was made during backup work.

## Final completion — 2026-10-05

The subsequent authorized activation and publication are complete. The owner
confirmed Gmail receipt. Release-source CI 37333941157 passed frontend checks,
Playwright and Supabase reset/lint/pgTAP tests. Windows widget 37333941066 passed
native integration and Rust tests, connected-app/signing validation, signed
installer build, download preparation and artifact upload. Local verification
passed 513 tests across 71 files. The workflow watcher finished successfully;
no task-owned dev or backup server remains. Kora 0.1.9 is live and the user's
running 0.1.7 installation is ready for the explicit Update and restart action.
