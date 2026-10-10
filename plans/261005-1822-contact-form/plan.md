---
status: complete
---

# Contact form

Outcome: a Contact tab sends private messages through a Supabase Edge Function
and emails the owner's server-configured recipient using Resend.

Constraints: preserve existing app patterns and English/Vietnamese support;
never expose the recipient or server secrets; require server-validated
Turnstile, reject honeypots, and admit at most three messages per IP per hour.
Back up any database before applying SQL. Existing hosted migration-history
restrictions remain in force. Prepare a deployable change before activation.

Non-goals: public inbox, admin dashboard, automated replies, attachments, or
an elaborate moderation system. The owner reviews messages and replies manually.

Acceptance: desktop/mobile Contact navigation, accessible form and feedback,
validated input, persistent atomic limits, private storage, notification with
sender Reply-To, failure-safe message retention, tests and deployment instructions.

## Phases

1. Implement private schema and dependency-free Edge Function with tests.
2. Implement translated Contact route, form, Turnstile lifecycle and navigation.
3. Verify security, types, build and UI; document configuration and activation.
4. Activate Contact, publish the website and signed Kora update, then verify live submission.

The user authorized activation and publication on 2026-10-05 with "so do it".
A fresh encrypted backup restored all 49 tables successfully before activation.
Hosted PostgREST exposes only public/graphql_public, so notification markers use
a service-only public RPC while the message tables stay private.

Activation depends on Turnstile keys, a Resend key and verified sender, the
private recipient secret, and a backed-up database with reviewed migration history.

The first publication (0.1.8) passed live submission and all CI checks. A final
direct-route navigation check found that Board had no loaded ID on a fresh
Contact visit. A focused repair resolves the actual board on navigation and
routes signed-out visitors to sign-in. Three regression cases passed. Publish
the corrected native/web release as 0.1.9, preserving the signing key.

Completed: Kora 0.1.9 and the website are published. Production form submission,
private persistence, notification delivery to the owner's Gmail, direct Board
navigation, and signed download/feed matching are verified. Release-source CI
37333941157 and Windows widget 37333941066 passed, including Supabase tests,
browser tests, native tests and signed installer packaging. The installed 0.1.7
app remains running; the user can apply 0.1.9 through Update and restart.

Execution detail and setup: [contact setup](../../docs/contact-setup.md).
