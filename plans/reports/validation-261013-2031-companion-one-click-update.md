# Companion one-click update delivery

Date: 2026-10-13, Asia/Saigon. Desktop 0.1.30 / Companion 0.3.23.
Status: implemented, reviewed, published and verified for the user's installed-browser test.

## Diagnosis and repair

The user's app-data override contained 0.3.16 while installed Kora 0.1.29's
resource folder contained 0.3.22. The old button selected the override whenever
its model existed, without comparing versions, and only opened Explorer.

The new command stages the signed app's matching payload, verifies every file
against the generated inventory, replaces the stable app-data folder, and
retains the previous folder in a sibling backup. Replacement failure restores
the prior folder. Identical repeat updates create no extra backup, newer
installed versions are not downgraded, and links/junctions/path escapes fail.
Copying runs off the UI thread; concurrent commands are rejected.

The native-only, nonce-bound bridge requests reload after the extension reads
its own on-disk manifest and verifies the requested version. It acknowledges
before unloading. Kora checks the loaded version on reconnected peers before
reporting ready. Public Web messages cannot request these actions. The existing
local-extension trust boundary remains: the nonce identifies a connection,
not a publisher. Kora does not edit browser profiles or settings.

Both native buttons show progress, disable repeated clicks and show success,
errors or manual steps. Directory existence alone is not installation evidence;
no connected peers receive Reload-or-Load-unpacked guidance. Offline and online
update guides describe the actual path and behavior.

## Verification

- 829 JavaScript tests in 110 files passed, including version/file rejection,
  acknowledgement before reload, stale replies, shutdown, duplicate clicks and
  the native button's progress/confirmed-version display.
- All 20 Rust tests passed, including old-version replacement, backup, rollback,
  idempotence, no downgrade, invalid payload and a real Windows junction.
- Typecheck, native check and signed release build passed. Lint has zero errors
  and the same 25 existing React-hook warnings. Main entry: 705.4 KiB against a
  976.6 KiB budget. Existing Vite config/chunk warnings remain visible.
- Real isolated Chromium 153.0.8010.12 rejected a wrong on-disk version, accepted
  the verified replacement, reloaded itself, made a fresh socket connection and
  reported loaded 0.3.23. Two runs took 319 ms; the final additional identity
  check took 360 ms and confirmed the extension ID stayed unchanged. The test
  uses production bridge/update code with a dedicated loopback test port and
  fixture versions; it does not use the user's browser/profile.
- Early runs with Developer mode off left the unpacked extension disabled after
  reload. In-place replacement also failed, disproving root rename as the sole
  cause. Enabling Developer mode through the test browser's Extensions UI made
  the unchanged directory-replacement flow pass. Manual product guidance covers
  Developer mode and re-enabling a disabled extension.
- The installer and trusted-comment signatures verify against Kora's configured
  updater public key. All 43 ZIP entries match source; all 44 native inventory
  files exist, and its extension files match source. The percussion model is
  unchanged. Review found no remaining blocking or actionable issue.

## Release

Installer: 15,514,390 bytes, SHA-256
`38f43d159dd0f7de56347a08c3157539b4426fee9ff607245a9602865224d2a4`.
Companion ZIP: 16,306,858 bytes, SHA-256
`2b45e1c0f04ab1e5decd98eaab79f274db84bab85d2f87bd4f9b7178f133c9d2`.
Draft deployment `6ace396c2b7f871ce703cc43` served byte-identical app entry,
instruction JavaScript, updater manifest, signed installer and both archive
aliases. Its HTML guide differs only by Netlify's privacy-link pretty-URL
rewrite. The function redirect returns the expected absent-asset JSON 400.
Production deployment `6ace3ac10a7f8b8689700aea` is ready at
[koraspace.online](https://koraspace.online). Both public domains serve the exact
signed installer, both ZIP aliases, updater manifest, app entry JavaScript and
instruction JavaScript with HTTP 200 and matching SHA-256. HTML differs only by
the verified hosting comment/pretty-URL rewrite. Both function redirects pass.
The verified deployment remained active after the automatic Git build finished.
Implementation commit: `1a91fed709e8201a0b980ef0a18026d67c69f10a`.
The existing native-before-Web release route and connected production
configuration are retained. Detection, thresholds, playback and previous lag
repairs are unchanged. An optional final browser check initially could not start
because automatic permission review timed out; the permitted retry passed.

## User test and limits

Update Kora to 0.1.30 and click **Install or update Companion**. The old 0.3.16
cannot understand the new reload request, so click **Reload** once in the browser
and refresh music tabs. Keep Developer mode enabled. Later paired Kora updates
can replace/reload a supported connected Companion automatically. First browser
installation still needs Load unpacked consent. Disconnected/unsupported copies
receive manual instructions. Installer-owned resource paths are upgraded by the
signed installer; arbitrary extracted ZIP paths remain a manual fallback.

The button uses the Companion included in installed Kora; it does not
independently fetch a newer ZIP or publish a store listing. No installed user
files were modified during development. All isolated test browsers/servers
exited; ports 47636, 1431 and 5173 have no listener. The user's original
installed-browser test remains the acceptance check.
