# Publish cached Beat event support

Published signed Kora 0.1.15 and included/downloadable Companion 0.3.14 at
`bdd97590a67da7a68064a4d0570ea8b59bd44d36`. Added the exact production cache
origin to native development/production connection policies and a regression
check. Existing updater identity/key and main-to-Netlify route were preserved.
Both public domains serve the matching updater signature and installer SHA-256;
altered installer bytes fail verification. The live Beat API returns explicit
cache miss for uncatalogued music. No catalog, remote analysis worker, new model
or later roadmap work was deployed. Local/degraded paths remain intentional.

Validation: 646 tests across 89 files with coverage; 14 native tests; typecheck,
signed build and bundle budget passed. Lint: zero errors, 23 existing warnings.
Hosted quality and Playwright checks passed; other CI jobs remained in progress
when publication was verified. Companion archive version and 34 non-generated
runtime files match local source. No task-owned background servers remain.

Rollback is redeployment of the prior source revision
`0a8bd80041133be73c88339e6323b95ea35c7fcd`; installed clients require a subsequent
higher-version signed fix rather than a downgrade. User can choose Update and
restart, then reload the existing project-folder Companion to load 0.3.14.
