# Public Home and feature authentication

Root now renders the existing Home briefing instead of redirecting to auth.
Public Home skips private data loading and uses empty states; no guest account,
demo records or additional marketing body is created. Contact and static
About/Privacy/Terms remain public. About opens root and explains feature sign-in.

RequireAuth preserves full internal destinations in a validated returnTo query.
External, control-character and recursive auth/setup destinations are rejected.
Auth completion owns navigation; the workspace effect no longer overrides it.
First-workspace setup preserves the intended feature. Home task/pin/planning
actions and header search/create actions gate access before dialogs or mutations.

Protected Tasks aliases the existing board route. Music, Beat Grid and Focus
routes reuse FloatingFocus with its real session/media state and scoped styles.
The dock's default tab is unchanged for existing callers. Auth copy is Kora /
Intelligent Focus Space / Sign in to continue, without backend implementation copy.

## Verification

- Working workspace: full Vitest suite passed 670 tests; additional route/setup
  regression tests passed after their addition.
- Isolated release from published 819a627 plus approved public/auth paths:
  667 tests in 90 files passed, all 20 existing Edge browser checks passed,
  and 14 connected-auth Edge checks passed.
- Connected-auth tests use the actual provider, router and session restoration,
  with test-only HTTP responses; no production accounts or data were created.
  They cover public roots/pages, protected deep links, returnTo query/hash,
  refresh, sign-in to the real Beat Grid, saved-session refresh and Music access.
- Typecheck, full release lint and production build passed. Lint retains four
  pre-existing warnings outside this change; Vite retains its large-chunk warning.
- Bundle budget passed: main entry 669.1 KiB, budget 976.6 KiB.
- Desktop/mobile Home checked in Edge. The briefing grid, section hierarchy,
  spacing and visual language remain; public header actions and feature links
  use existing navigation styles. Mobile page does not overflow.
- Tests expecting the old default /home return now expect /. Existing /home
  bookmarks and signup confirmation destinations remain valid.

## Release boundary

Only approved public identity and auth/routing paths enter this release.
Unfinished Beat/analyzer/database changes remain in the working tree. The
isolated build uses the published package lock and existing Netlify production
VITE_* settings. No database, Modal, server configuration or desktop installer
changes are made. Existing packaged Companion and download assets are retained.

Production site: https://koraspace.online (Netlify kanthangboard).
Previous production deploy: 6ac51e4762845d0008ed8c61, source 819a627.
Rollback: republish that deployment through the site's Netlify Deploys page.

Draft 6ac659359e6d73d226333bb7 passed 14 hosted Edge checks, including public
routes, protected deep-link refresh, full return destinations and Home feature
interaction. The first upload returned HTTP 422; the diagnostic retry succeeded.
Published source commit: 4e2c2f87e40314e145f197f6e5bfcebdfcbb7826.
Production deploy: 6ac65b5c221cc00008fd1e7f (ready, published 2026-10-07).
All 14 checks passed again against https://koraspace.online, with a fresh Edge
session. Hosted validation does not submit production credentials; successful
login and restored-session destinations are covered by connected-auth tests.
GitHub frontend quality and Playwright jobs passed for the published commit;
the database isolation job was still running when this record was written.
