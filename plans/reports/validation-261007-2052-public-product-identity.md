# Public product identity validation

Kora now has accurate initial-HTML metadata and static public About, Privacy and
Terms documents. The Home body/layout and its visual language are unchanged.
Implementation is complete locally; this work has not been published.

The app title, description, canonical URL, Open Graph fields and minimal JSON-LD
associate Kora with `https://koraspace.online`, `contact@koraspace.online` and
the public About page. The existing cat logo is used; no screenshots or product
imagery were added. Structured data makes no incorporation, trademark, funding,
partnership, team-size or rating claims. Twitter-specific tags were absent and
remain absent; no social account identity was invented.

About describes the implemented task/focus capabilities, Early Access and active
development, and offers a real Open Kora link to `/home`. It accurately describes
the signed-out sign-in flow and the evolving Music/Beat capabilities. Public
policy links are discoverable on the sign-in screen and public documents, with
sitemap/robots files for crawlers. Static-page CSS is isolated from Home.

## Verification

- Installed Edge: eight development browser checks passed, covering public pages
  with JavaScript disabled, canonical/identity metadata, assets, mobile width,
  the real app link, Home, board and Focus Dock smoke regressions.
- Installed Edge against the production build: four JavaScript-disabled public
  document/metadata checks passed. Directory URLs serve actual static HTML.
- Existing authentication regressions: seven tests across three files passed.
- Full typecheck, web build and scoped lint passed. The build retains its existing
  large-chunk warning. No new dependency or database change was introduced.
- The initial Chromium run could not launch because the bundled executable is
  absent. Edge provided the actual browser validation. The first Edge run caught
  Vite's directory URLs falling through to the SPA; the focused local middleware
  fixed that behavior, and both development and production checks now pass.
- Scoped review confirms that index changes are confined to the head. Home's
  components and shared styles were not changed by this task. Policy wording was
  checked against the existing auth, contact, task-AI and music paths.

Maintenance ownership: [public identity docs](../../docs/public-identity.md).
The existing uncommitted Beat work remains separate and has not been published
or declared complete by this identity update.

## Remaining verification

Mailbox delivery to `contact@koraspace.online` was not tested or provisioned.
No live deployment check is claimed; the hosted site was not accessible through
the web retrieval tool. All successful browser evidence above is local.
