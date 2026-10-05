# Contact form setup

`/contact` is public and available through desktop and mobile app navigation.
It accepts a name, reply email, subject and message in English or Vietnamese.
The owner's notification address is configured only on the server. Local mock
mode does not simulate sending: real backend configuration is required.

## Live release

Contact is active at [kanthangboard.netlify.app/contact](https://kanthangboard.netlify.app/contact)
and included in the signed Kora 0.1.8 update. In an existing native installation,
choose **Update**, then **Update and restart**, to load its Contact navigation.
Web publication uses the existing GitHub-to-Netlify integration. The public
Turnstile build variable is configured in Netlify and GitHub Actions; local
dotenv files remain separate from hosted configuration.

The Contact-only migration was applied transactionally after a full encrypted
backup restored all 49 existing tables. Hosted 21-case security/rate-limit tests,
CI database reset/lint/tests, frontend tests and Windows build passed. A real
production form submission was stored and Resend accepted its notification.
Final inbox receipt still needs owner confirmation: the sending-only key cannot
retrieve delivery events. The configured test sender delivers only to the
Resend account's owner; a dedicated verified sender remains the path for
changing that recipient or using your own sender branding.

The signed installer and update feed were published together. For website
rollback, republish the prior Netlify deploy `6ac27a7b4f03ec00081681e3` in the
dashboard. Keep received private messages when withdrawing Contact.

## Configuration

The web/native build needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`VITE_TURNSTILE_SITE_KEY`. Use the Cloudflare site key for the last value.
Changing build variables requires a rebuild. Local `.env` files do not configure
Netlify: add the public site key to the hosting build environment too.

Copy [the server template](../supabase/functions/.env.example) to
`supabase/functions/.env.local`, and fill in its six variables. Supabase provides
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically in hosted functions.
Never put server secrets, a service-role key or the private recipient in a
`VITE_` variable. The root `CLOUD_FLARE_SECRET` name is a local configuration
alias; the deployed function requires `TURNSTILE_SECRET_KEY`.

Create a Cloudflare Turnstile widget, choose Invisible mode for no visible
challenge, and register every hostname where the form runs. Managed mode with
interaction-only appearance can show a challenge when Cloudflare requires it.
Register the production hostname and localhost for local development. Native
builds need their actual WebView hostname registered as well, normally
`tauri.localhost` on Windows. Allow the exact browser origins in
`CONTACT_ALLOWED_ORIGINS`, comma-separated with schemes and ports, no trailing
slash. Proofs must have action `contact` and an allowed hostname; server-side
validation is mandatory. See [Cloudflare validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

`CONTACT_NOTIFICATION_TO` is the owner's private inbox. `CONTACT_NOTIFICATION_FROM`
should be a dedicated support address on a domain verified in Resend. Follow
[Resend domain setup](https://resend.com/docs/dashboard/domains/introduction)
for SPF and DKIM, then configure DMARC for the domain. The Resend test sender
`onboarding@resend.dev` only sends to the email registered on the Resend account.
A sending-only API key works for this function even though it cannot list domains.
Replies use the submitter's email as Reply-To; the submitter never controls From
or the notification recipient.

Keep `CONTACT_IP_HASH_SECRET` stable, random and at least 32 characters long.
Rotating it resets effective rate-limit identities. The function uses an HMAC
of the gateway-appended client IP; it does not store raw IPs. Custom caller CF
headers and the first forwarded entry cannot select an arbitrary limit bucket.
Verify the hosted gateway still appends the peer IP if its proxy route changes.
Missing or invalid client IPs fail closed.

## Database and activation

Read [the schema workflow](../supabase/schema/README.md) first. The current hosted
project has an intentionally unaligned migration history. Do not use `db push`,
baseline replay, `migration repair`, or `config push` to activate Contact.
Confirm a recoverable database backup and obtain the separately reviewed hosted
change approval required by that workflow before applying SQL.

The entire Contact-only database change is
[20261005120000_contact_messages.sql](../supabase/migrations/20261005120000_contact_messages.sql).
It creates two private tables and service-only admission and notification RPCs; it does not edit
existing task/workspace tables or migration history. Apply it as one transaction
through the owner's SQL editor after backup/review. Preserve this migration in
the future hosted-history alignment work instead of replaying it accidentally.
Reload the PostgREST schema cache with `notify pgrst, 'reload schema';` if needed.
Keep `app_private` outside the API's exposed schemas. The notification marker
uses `public.record_contact_notification` with service-role credentials.

Upload secrets to the intended project explicitly, then deploy only this function:

```powershell
pnpm exec supabase secrets set --project-ref <project-ref> --env-file supabase/functions/.env.local
pnpm exec supabase functions deploy contact --project-ref <project-ref> --use-api
```

`verify_jwt = false` in [config.toml](../supabase/config.toml) is intentional:
signed-out users may contact support. The Edge Function validates Turnstile,
the honeypot, input sizes, origin and the database admission limit. CORS alone
does not prove a trusted caller. Table privileges and the RPC execution grant
exclude both anonymous and authenticated browser clients.

After activation, send one clearly labelled setup message through the actual
form. Verify receipt in the private table, notification acceptance in Resend,
and delivery to the owner's inbox. Test a bad token and filled honeypot without
creating rows. Verify a fourth same-IP submission receives 429/Retry-After.
Confirm browser requests using the public key cannot read tables or invoke the
admission RPC directly. Do not consider an uploaded function proof of working
delivery. Rebuild/deploy the frontend separately when ready.

## Verification and local work

```powershell
pnpm exec vitest run src/features/contact src/app/useAppRoutingController.test.ts supabase/functions/contact
pnpm exec tsc --noEmit --strict --skipLibCheck --target ES2023 --module ESNext --moduleResolution bundler --allowImportingTsExtensions --lib 'ES2023,DOM' supabase/functions/contact/index.ts supabase/functions/contact/handler.ts
pnpm exec supabase test db supabase/tests/database/contact_messages.test.sql --local
```

The pgTAP suite requires a disposable Supabase stack after reset with the new
migration. Back up any non-empty local database before reset. The repository
disables `edge_runtime` for database-only checks; enable it in local config
before `supabase functions serve contact --env-file supabase/functions/.env.local`.
Use Cloudflare test keys only on the disposable local stack, never in production.

## Owner review and notification failures

Review every message manually in Supabase's private table. No browser inbox or
client read policy is provided. Owner-only SQL:

```sql
select id, created_at, name, email, subject, message, notified_at, notification_id
from app_private.contact_messages
order by created_at desc;
```

A 202 response means the message was received. If Resend or the delivery-marker
update fails, the message remains stored and `notified_at` stays null; the
function logs a generic pending-notification warning without message content.
Review pending rows and the Resend dashboard before sending a notification
again to avoid duplicates. The original send has idempotency key `contact/<id>`;
Resend retains it for 24 hours. See [Resend email API](https://resend.com/docs/api-reference/emails/send-email).
The owner can reply manually using the dedicated support mailbox.

The database admits three messages per hashed IP in a one-hour window, starting
at the first accepted message. Admission and persistence share a transaction;
denial or a failed message insert cannot consume extra quota. Parallel callers
lock the same bucket. Expired buckets may be pruned through owner-only SQL.

To withdraw the feature, stop exposing its navigation and remove the Contact
Edge Function. Keep private messages for owner review and backup; do not drop
them as part of rollback without an explicit retention decision. Removing only
the function does not change existing workspace/task behavior.
