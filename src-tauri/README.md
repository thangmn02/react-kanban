# Kanban Focus — Windows widget

Status: native compile-check, all four Rust analyzer/tempo tests, and 51 frontend
music/native integration tests pass locally. Live WASAPI/SMTC and installer
acceptance checks are **not yet verified**. Smart App Control blocked the first
compile attempt; a later retry succeeded without changing security settings.

## Development

Requires Rust's MSVC toolchain, Visual Studio Desktop development with C++
(Windows SDK included), Node.js, and WebView2.

```powershell
npm install
npm run tauri dev
```

The widget uses port 1420, separate from browser testing on port 5173. Sign in
inside the native app; browser cookies are not copied. Use Tasks to pick/pin
focus tasks, then Dock to return. Both views use one existing Pomodoro
controller. All five dock layouts are available; switching keeps the same
beat-grid/timer elements, with monitor-bounded window sizing. Resizing Split
to narrow widths stacks its panes.

Enable **System audio beats** once to listen to the default Windows output.
This captures the system mix, including other apps and notifications, not an
isolated chosen music source. No microphone, PCM files, audio uploads, or local
network listener are used. Disable the switch to stop loopback listening.
Metadata/play/pause use Windows media sessions. A player that does not publish
SMTC metadata appears as System audio, without invented playback controls.
The extension is only needed for the existing web surface.

Native detector work runs in Rust, not the browser tab. UI rendering can still
be paused by Windows when minimized; old queued flashes are discarded on
resume. Pomodoro wakes calculate the original deadline, never a second timer.
Keep the native app running; closing the browser does not close it.

Protected content, exclusive-mode output, or unavailable/silent devices can
still make audio uncapturable. Only recent audible PCM and a playing session
report capture mode. Silence/failure/paused music keep the squares still.
Native capture IDs and increasing onset sequences are validated in the same
frontend path as browser capture. Tempo pulses require actual audio and a
confident tempo lock; there is no decorative clock fallback.

## Build/distribute

```powershell
npm run tauri build
```

Installer output (after a successful build): `target/release/bundle/nsis/`.
Executable: `target/release/kanban-widget.exe`; distribute the installer for
the WebView2 prerequisite bootstrap. Build with production Supabase URL/anon
key and `VITE_AUTH_MODE=supabase`; never ship Gemini or service-role secrets in
the frontend. The unsigned installer is not yet published to GitHub Releases.
Signing is needed for a trusted distribution; don't ask end users to disable
antivirus to run the app.

The **Windows widget** GitHub Actions workflow builds unsigned download artifacts,
not a public release. Add repository Actions variables `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` for the connected app. These are public frontend values;
never put a service-role key or Gemini API key there. A manual run can explicitly
choose an offline mock-auth demo; it is labeled `demo`, never a connected build.
After success, download the ZIP under the workflow run's Artifacts, extract it,
and run the NSIS `setup.exe`. Artifacts expire after 14 days. A portable executable
is included but requires WebView2 already installed. No workflow has run until
these changes are reviewed and pushed.

## Acceptance before shipping

- `cargo test --manifest-path src-tauri/Cargo.toml`: analyzer silence/transient
  tests, tempo lock/unlock tests; run frontend native integration tests too.
- Enable audio, play YouTube/SoundCloud and native Spotify/Apple Music sources.
  In dev, append `?musicDebug` to the page URL (before its hash route). Confirm
  source tauri-events, mode capture, increasing per-band onsets, matching square
  pops, and static channel icons. Actual protected-audio behavior must be tested,
  not assumed from a site name.
- Pause, stop, switch track/session, turn off audio, change the default device:
  stale captures/events never flash, and new streams get new capture IDs.
- Test silence and free tempo: calm squares, no manufactured grid pulses.
- Switch all layouts and Tasks/Dock; verify one timer and one completion log.
- Minimize/restore, close browser, then inspect timer deadline and event freshness.
- Test the installer on a clean Windows machine before publishing a release.

If Application Control blocks a build helper, preserve the protection and use
an appropriate isolated development environment or signed build pipeline.
Disabling Defender antivirus does not resolve an Application Control policy.
