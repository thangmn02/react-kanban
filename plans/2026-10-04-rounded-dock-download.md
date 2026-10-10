# Rounded dock and Windows download

Status: implementing; no commit, push, deployment or database operation.

## Outcome and design brief

Remove the rectangular native corners, restore light translucent glass with an
inner glow, and provide a working Windows installer download in the web header.
Preserve five layouts, shared motion, browser-only music and the single timer.

Register: Product. Scene: a small Windows music/focus dock above other apps.
Direction: light frosted glass, matching the user's earlier rounded dock.
Color: restrained white/lavender glass, dark text and existing pastel matrix.
Type: existing app sans-serif and tabular timer; no font changes.
Signature: rounded illuminated edge around a stable audio-reactive matrix.
Dials: existing variance 3, motion 5, density 6; no new choreography.

## Tasks and acceptance

- [ ] Clip Windows Acrylic itself to the same 22 logical-pixel corners as CSS,
  adapting on resize/display scale and removing the region in Tasks mode.
- [ ] Use a bright native tint, translucent CSS gradient and inset glow.
- [ ] Add bilingual, accessible web-only download control with a real installer.
- [ ] Stage the versioned native build at a stable web download URL; never embed
  a previous installer inside the next native bundle.
- [ ] Focused/full tests, typecheck, lint, Rust tests, installer build and rendered
  layout checks. Windows desktop blur/corners still require live acceptance.
- [ ] Deliver the installer and diff before any push/deployment.

## Evidence and safety

Windows Acrylic default tint was unconfigured, and native CSS removed the inset
shadow. CSS rounded corners cannot clip the separate rectangular OS backdrop.
Use a DPI-aware Win32 region; the system owns the region after successful setting.
Keep existing installers for rollback, and do not close the user's running app or
discard drafts. No hosted schema changes are included. Hosted download deployment
remains pending review; the local download must work before handoff.
