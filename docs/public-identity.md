# Public product identity

Kora's canonical domain is `https://koraspace.online`. Its supplied public contact
identity is `contact@koraspace.online`; the existing contact form remains `/contact`.
Metadata does not configure email delivery or change the private notification inbox.

## Owning surfaces

- [index.html](../index.html) owns the app's title, description, canonical URL,
  Open Graph fields and initial HTML structured data. Its body is unchanged.
- [About](../public/about/index.html) is the canonical public explanation at
  `/about/`. It describes implemented capabilities, Early Access/active development
  and links to public Home at `/`. Sign-in is required when a visitor selects a
  feature; Home retains the existing briefing layout and shows no private data.
- [Privacy](../public/privacy/index.html) and [Terms](../public/terms/index.html)
  are public documents at `/privacy/` and `/terms/`.
- [kora-public.css](../public/kora-public.css) styles only those static documents.
  No Home or shared app stylesheet imports it.
- [AuthPage.tsx](../src/components/auth/AuthPage.tsx) exposes the public pages in
  a small sign-in footer. It does not add description blocks to Home.
- [robots.txt](../public/robots.txt) and [sitemap.xml](../public/sitemap.xml)
  expose public crawl routes. Workspace and authentication routes are omitted
  from the sitemap. Robots exclusions are not access controls.

The existing `favicon.png` and `logo.png` provide Kora's cat identity. Sharing
metadata uses the existing logo, with no screenshots or new product imagery.
Twitter/X-specific metadata was not present; no account or handle is invented.

The JSON-LD uses [Schema.org SoftwareApplication](https://schema.org/SoftwareApplication),
an AboutPage and a minimal Organization node for the Kora project. Keep the app
and project nodes consistent in index and About. Do not introduce incorporation,
trademark, funding, partnership, team-size or review/rating claims without evidence.
These fields identify the product; they do not guarantee search or review outcomes.

## Build and maintenance

Vite copies `public/<page>/index.html` to the corresponding build directory.
The existing non-forced Netlify SPA fallback preserves those real static files.
The `public-document-routes` Vite middleware resolves their directory URLs in
development; production preview serves the built documents directly.

When capabilities or data handling change, review About/Privacy/Terms against the
actual source, update revision dates where needed and keep canonical URLs and
structured data aligned. Preserve Home's body and visual language.

[Public identity browser checks](../e2e/public-identity.spec.ts) cover JavaScript-free
readability, canonical metadata, identity relationships, mobile width, public
assets and the real app link. Mailbox provisioning and delivery are separate
operations and were not performed by this change.

## Public and authenticated routing

`/`, `/home` and `/contact` are public SPA routes. `/about`, `/privacy` and `/terms`
remain static public documents. `/tasks`, `/today`, `/music`, `/beat-grid`, `/focus`
and existing workspace routes are protected by RequireAuth. Music/Beat Grid/Focus
reuse the existing dock and media state; no detection behavior changes here.
Home dialog actions and the command/create-board controls check authentication
before opening feature UI. The auth page presents Kora / Intelligent Focus Space.

`auth-routing.ts` validates internal destinations from the `returnTo` query
parameter (or older router state), preserving search/hash and excluding external
or recursive auth/onboarding destinations. The workspace routing effect exempts
public Home and leaves auth completion to AuthPage. Missing workspaces carry the
intended feature through setup instead of overwriting it with Home.

The non-forced SPA rewrite in netlify.toml handles authenticated-route refreshes;
the guard runs after session restoration. Client guards control app navigation;
existing backend authorization continues to protect private data and operations.
