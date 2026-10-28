# Full-product commit and publication

User authorization on October 28 covers commit and push of the full product work. The subsequent final release-gate instruction requires mandatory gates and separate owner approval before any production migration, restore, deployment, installer/feed or Companion replacement. Production access is limited to read-only inspection and non-destructive backup preparation. No unrelated acoustic research belongs in this release commit.

## Acceptance

- Reconcile correctness, identity/Settings, centered profile, shell/tasks/Today/Focus, collaboration, connected Notes/Saved Context/task comments, native external notes and bounded Astryx integration against their owning evidence.
- Build a connected release with the existing app identity and updater signing key, a higher version, the approved image endpoint and no embedded server credentials. Stage installer/signature/feed together.
- Verify the exact production project, migration history and restore/recovery prerequisites. Present the missing migration plan for authorization before any production database write.
- Commit only product source, tests, setup/docs and release artifacts after a secret scan. Push the existing branch without discarding unrelated working-tree changes.
- Publish matching web/functions and signed Windows update artifacts only when backend prerequisites are satisfied. Verify live routes, runtime configuration, function behavior, downloads/feed signatures and source/deploy identities.
- Keep physical monitor/DPI/sleep, tray/shortcut conflict and combined capture/performance gaps explicit. Never infer those results from browser tests.

## Current route and dependencies

The verified Netlify site is `kanthangboard`, ID `0c8406d3-9d2e-4afd-8351-140813bfbaf9`, serving `https://koraspace.online` and the retained Netlify updater host. Its production Supabase reference is `lthlvntvjgnornrdxnms`; this is distinct from authorized staging `enzzyuhchizfmruxhfhg`. Notes is currently disabled in the site's build configuration, and the new server-side image handler credentials are absent. The signing key exists at the established private local source; its contents stay outside Git and build output.

Read-only production DB/history access passed verified TLS and exact routing. The operator file was moved from the OneDrive checkout to `%LOCALAPPDATA%/Kora/secrets/production.env`, with byte comparison and a user-only ACL. Tools select it through `KORA_PRODUCTION_ENV_FILE` or that explicit local default; it is not an application runtime dotenv source. Netlify's image function reads `SUPABASE_SERVICE_ROLE_KEY` at production Functions scope, after future deployment authorization. No service key is passed to frontend or native builds.

Production has three recorded migrations and twelve source versions absent from its history, including two versions older than its latest recorded migration. That is an inspection result, not approval to apply them or proof of schema equivalence. A guarded plan must inspect existing definitions and rehearse against a recovered production clone. Production Storage has private objects; the backend-only secret is not reused for backup. Full object-byte recovery requires separate authorized backup access and remains a release gate. Code/build preparation, full-product regression and scoped commit/push proceed independently.

## Verification and rollback

Use final full unit/native tests, the built-product browser matrix, real staging service/browser suites, actual native lifecycle evidence, protected hashes and bundle checks. Retain current public deploy/feed/installer identities before promotion. Web rollback restores the prior Netlify deploy and matching feed/artifacts; it does not roll back database history. Production recovery must cover owning rows, policies/grants/triggers, migration history, Storage bytes and a separately verified restore target before applying additive changes.
