# Public Home and authenticated features

Keep the existing Home structure and styling, make root/Home and the public
documents accessible without signing in, and gate real feature interactions.
Preserve safe internal destinations through sign-in and first workspace setup.
Simplify auth copy and publish only this website change and public identity work.
Unfinished Beat Grid changes remain local.

- [x] Update route policy and safe return destinations.
- [x] Render Home without a user; gate its actions and reuse existing features.
- [x] Validate guest/public routes, sign-in returns, session regressions and build.
- [ ] Build an isolated release, publish Netlify and verify deep links.

No detector, schema, analyzer, desktop installer or visual redesign changes.
Rollback: restore the previous verified Netlify deploy; retain its ID in the report.

Validation and publication: [report](../reports/validation-261007-public-auth-routing.md).
