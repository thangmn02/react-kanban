# Publish cached Beat event support

User authorized publication after completion of the event data engine at
`b59da19`. Publish signed Kora 0.1.15 with Companion 0.3.14 through the existing
main-branch Netlify deployment and HTTPS updater feed. Preserve all completed
Beat behavior; do not start quality tuning or later roadmap work.

- [x] Allow the native cache endpoint in the existing restricted connect policy.
- [x] Update versions, package the matching Companion, and verify release checks.
- [x] Build using the existing protected signing key and verify installer bytes.
- [ ] Commit the scoped release, push main, and verify live feed and downloads.

Acceptance: the updater offers 0.1.15 to 0.1.14, both public domains serve the
signed package, and the included/downloadable Companion is 0.3.14 with the new
asset identity/event files. No precomputed catalog or analysis service is
configured by this release; local or explicit degraded fallback remains valid.

Rollback: redeploy the preceding Netlify deployment for source revision
`0a8bd80041133be73c88339e6323b95ea35c7fcd`. Reverting web assets does not downgrade
already installed apps; repair those through a higher-version signed release.

Prepared validation: 646 tests / 89 files with coverage, 14 native tests,
typecheck and build pass; lint has zero errors and 23 existing warnings.
Bundle budget passes. Signature matches the configured public key and modified
bytes fail verification. Installer SHA-256:
`89F82FC1280081B94F6BE82FEEBE35644BE018FD632C200F1769AB5C29A2A9AD`.
Included Companion identity/timing/telemetry files match the project runtime.
