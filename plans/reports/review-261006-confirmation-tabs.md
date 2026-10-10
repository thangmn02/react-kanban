# Confirmation redirect and glass Tabs release review

Release: Kora 0.1.13. Companion stays at 0.3.12. Publication is pending.

## Outcome and diagnosis

Signup omitted emailRedirectTo, and hosted Supabase still used localhost:3000
as Site URL. A failing regression proved the missing destination. Signup now
explicitly requests https://koraspace.online/home for public, local development
and native origins. Hosted Site URL is https://koraspace.online; exact public
and legacy Netlify /home returns were appended to the existing allowlist.
A fresh configuration read verified that unrelated settings were unchanged.
Affected settings were backed up privately in ignored scratch. No account or
user data was changed, and no confirmation email was sent during testing.

The dock now has only glass Tabs. Obsolete style preferences are removed while
colors and palette survive. Timer, task selection and all panels remain mounted;
tab changes and document adoption preserve their identity. The circular timer
and Start/Pause, Reset and Complete & next remain visible. Header whitespace
starts native dragging; controls and the settings dialog are excluded.
Music and beat panes retain keyboard/touch/wheel overflow without scrollbar
chrome. Native fitting happens once and preserves later user resizing.

The user's final glass request is included: lighter translucent faces, soft
blur and beveled edges. The native selector now applies the intended native
frost instead of letting the more specific shared Tabs rule override it.
Existing Windows compositor glass remains unchanged. Contact derives its
small version footer from tauri.conf.json through the build-time constant.

## Verification

- 551 tests passed across 76 files, including auth destination, legacy layout
  migration, native dragging, all 34 music integration tests, timer settings,
  Contact and detached-document lifecycle. Existing audio/AI behavior remains
  covered by the suite and was not modified.
- Quality checks: typecheck passed; lint had zero errors and 23 existing
  warnings; production build and bundle budget passed. Main entry is 611.9 KiB
  against the 976.6 KiB budget in the final build.
- Actual browser app checks confirmed the timer and Contact's Kora v0.1.13.
  Layout fixtures rendered the actual dock markup and styles with a paused
  transport test session. At 360×540 all five rows fit: pane height and scroll
  height were both 142 px; last row ended below 524 px. Computed scrollbar
  width was none. At 520×680 the ring, tabs and all five rows fit.
- Final glass CSS computed as a translucent gradient, 22 px native blur and
  white beveled edge. Final cosmetic tuning followed the full test pass;
  the signed native and website builds were repeated afterward.
- Signed Windows installer and website download are byte-identical. Feed
  version, native version and Contact version match 0.1.13. Updater signature
  verified; changing an installer byte invalidated it. Private configuration
  values were absent from built frontend chunks.
- Installer SHA-256:
  e073e30f054c6a9a76e90736ba1ba9526b2833c1d47a8466980128a99cd4b114.
- git diff --check passed. Task preview servers stopped and temporary browser
  viewport overrides were reset. Previous installer/feed are backed up in
  ignored scratch/release-0.1.13-rollback.

## Review limits and publication

No blocking findings remain in the requested scope. Windows compositor visuals
were preserved by source inspection, not checked by launching the built app
over the user's desktop. Fixtures verify layout, not live song detection.
No real mobile confirmation email was sent; SDK regression tests and hosted
configuration verification establish the redirect change. Already-issued
emails can still contain their old destination; confirmed users can sign in.

Approval for this release is required before committing/pushing to main and
publishing the website/update feed. Prior publication authorization covered
0.1.12. Unrelated untracked icons and previous plans were left untouched.

## Updater follow-up, October 6, 2026

The user reported that the installed app said it was current while expecting
0.1.13. Read-only Windows uninstall metadata confirmed installed Kora 0.1.12.
Fresh cache-busted HTTPS requests to both Netlify and koraspace.online update
feeds returned 0.1.12, published at 2026-10-05T18:45:30.784Z. The configured
updater uses that Netlify feed; no deployed 0.1.13 release exists yet.
The current message therefore matches the installed and published versions.
All six updater regression tests passed, covering current/available states,
confirmation, progress, retries, installer rejection and resource cleanup.
No updater code change was justified. Publish the prepared signed 0.1.13
installer and feed together after the pending release approval, then verify
the live feed and download before declaring the update available.
