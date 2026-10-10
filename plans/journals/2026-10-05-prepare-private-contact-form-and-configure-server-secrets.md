---
title: Prepare private Contact form and configure server secrets
date: 2026-10-05
summary: Contact implementation verified; hosted activation awaits backed-up schema approval.
---

# Prepare private Contact form and configure server secrets

Contact implementation is ready locally: public bilingual form, automatic Turnstile verification, private message storage, atomic three-per-hour IP admission and server-side Resend notifications. Uploaded the six configured Contact secrets to the app's Supabase project without exposing their values.

Verified 507 full-suite tests, then 43 focused tests after simplification and route cases; build, app/Edge types and lint pass (23 existing warnings). Disposable PostgreSQL checks proved ACLs, admission, hourly reset and rollback. Review caught missing service_role private-schema usage; the migration now grants it. Browser checks passed at normal and phone widths, including automatic real Turnstile verification. Client bundle contains no server secrets or recipient.

Resend's domain lookup rejection reflects a sending-only key rather than an invalid key; the earlier interpretation was corrected. Live sending has not been tested. The existing hosted schema workflow requires a backup and separately reviewed hosted changes; Contact table/function activation remains pending. Do not db-push the squashed baseline. The server sender still needs an actual delivery check or a verified production domain. The temporary Vite process was stopped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
