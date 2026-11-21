# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

- use **Report a vulnerability** on this repository's **Security** tab, or
- email **contact@koraspace.online** with "Security" in the subject.

Include the affected page or feature, the steps to reproduce, and what an attacker could do. You'll get a reply
within a few days. Please give us a reasonable time to fix the problem before you disclose it.

## Supported versions

Only the latest release of the web app (<https://koraspace.online>) and the Windows app receives security fixes.

## How Kora protects data

- Access control is enforced in the database with Supabase row-level security, not in the browser. The anon key
  in the web app is public by design. See [docs/security-rls.md](../docs/security-rls.md).
- Server keys (service role, Gemini, image storage) live only in Netlify and Supabase function settings, never in
  the app bundle.
- CI runs the RLS isolation tests and fails on high-severity advisories in production dependencies.
