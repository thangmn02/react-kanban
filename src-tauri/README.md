# Kora — Windows widget

The frameless, resizable window runs independently of the web app. Dock and
Tasks share one Pomodoro controller. The dock stays on top and adapts to its
window dimensions; Tasks does not stay on top. Empty focus lists support a
standalone timer without creating a task. Musical shapes hold for eight seconds
and reflash on captured onsets or confident audio-tempo ticks, with no breathing loop.
Maximize/restore controls are available
in both surfaces. Dock uses light Windows compositor glass with a translucent tint;
Tasks clears the effect and remains opaque. Unsupported effects retain CSS glass.
On Windows 11, the compositor rounds the native backdrop itself; native CSS
matches its system corner radius. A custom cut-out region is not combined with
native blur because that leaves opaque corner blocks. Earlier Windows versions use
rounded CSS transparency without native backdrop blur. The native frame paint
handler suppresses the OS caption/border before the window first becomes visible,
while retaining resizing, activation and DPI handling. CSS adds a translucent
milky gradient, a bright rim and soft inset bevel above all panels. The bevel is
pointer-transparent so the glass does not intercept controls. The web dock keeps
its existing larger radius. Native glass explicitly uses a light tint independent
of Windows dark mode. It does not use legacy accent blur, which drops out during
native dragging; the compositor frost stays active while moving or resizing.

The Tabs layout matches the compact tabbed dock composition: a persistent focus
timer above Tasks, Music and Beat Grid, a now-playing strip outside Music, real
focus task rows and a blue-violet glass player card. Start/pause, task selection,
completion and music control use the existing shared controllers. Arrow keys,
Home and End navigate the tabs. Empty music/task states remain usable.
Fresh installations default to Tabs; existing saved layouts are preserved.
Use the layout-arrow control to select Tabs. Its native window opens at 520×560
and can shrink to 360×440; the lower panel scrolls at small sizes while the timer
and tabs stay visible. The same composition is used in browser PiP, where CSS
glass blurs page content rather than the desktop behind the browser window.

## Browser music only

Kora no longer starts WASAPI system loopback or reads Windows media sessions.
It cannot hear Zalo calls, notifications, native music apps or other desktop
audio. The previous system-audio checkbox and its IPC command are removed;
saved `native.systemAudio` values are ignored.

Install/reload **Kora Music Companion 0.3.11** in the browser used for music.
The companion discovers only the explicitly supported music websites. It
automatically connects to the running widget and sends metadata and beat
events, never PCM audio. No web-app tab is needed. Capture can still require
one browser-toolbar invocation on the playing music tab; the native app
cannot grant or bypass that browser permission. Silent/denied capture means
still squares, never a clock-driven imitation. Close the music tab/browser
and its music feed stops; the native timer remains independent.

The Rust WebSocket bridge binds only `127.0.0.1:47635`, path `/kora-music`.
It rejects web/null/missing origins, non-extension origins, incorrect hosts
and paths, oversized frames, stale events and unsupported actions. Each
connection has a new nonce. At most eight browser-profile connections are
accepted, with separate session namespaces and bounded queues/timeouts.
Only allowlisted music-site session metadata is exposed to the frontend.
The nonce prevents stale/cross-connection traffic; it is not proof of the
extension publisher. Installed extensions with their own WebSocket access
are a local trust boundary. No arbitrary execution, filesystem commands,
audio upload or LAN listener is exposed.

The companion exchanges keepalives and uses a reconnect alarm so worker/app
restarts recover automatically. This adds the `alarms` extension permission.
The old web protocol and app origin are retained for compatibility. The app
identifier `app.kanthangboard.focus` is deliberately unchanged to preserve
existing native sign-in and preferences. Branding, product/version and the
executable are now Kora / 0.1.12 / `kora.exe`.

The fifth row now follows detected instrumental note attacks. Choose **AI
instrument notes** in Music to open this browser profile's companion options,
then download/enable the local model once (about 157 MB). The model separates
vocals/drums/bass first; a retained harmonic profile favors one dominant
instrumental line. Original audio and all rows share a 3.5-second buffer while
enabled capture runs; music videos have delayed audio. Pause/seek/source change
discards it. Disabling AI restores immediate playback and a dark fifth row.
Failed/slow analysis leaves row five dark; drum/clap/hat/bass detection remains
independent. Several instruments can remain in a stem, so exact transcription
or isolation of a named instrument is not guaranteed. No captured PCM crosses
the native bridge. See the companion's [model notices](../extensions/kanban-music/INSTRUMENT-NOTICES.md)
and [validation](../extensions/kanban-music/BEAT-VALIDATION.md).

## Development and distribution

Requires Rust MSVC, Visual Studio C++ Build Tools with Windows SDK, Node.js
and WebView2. Use `npm run tauri dev` (Vite port 1420), or
`npm run tauri build`. Installer output is `target/release/bundle/nsis/`.
Use the installer for the WebView2 prerequisite bootstrap.

Set `TAURI_SIGNING_PRIVATE_KEY` to the path of your protected signing key before
building. Locally this key lives outside the repository, under local AppData.
After building, run `npm run desktop:package` to copy that exact version's NSIS
installer to `public/downloads/Kora-setup.exe`. The web header's **Download Kora**
button serves this file; it is hidden in the native app. Web builds include the
download, while Tauri builds explicitly exclude it from their embedded assets
to avoid recursively bundling previous installers. Build and stage a new
installer before deploying a matching web version. Packaging also generates
`public/downloads/latest.json` with the actual installer signature. Deploy both
files atomically; the updater checks the existing HTTPS Netlify host.
The CI artifact includes the installer, signature and feed; CI does not publish
a release or deploy the website. Updater signatures are not Windows Authenticode
publisher signing, so Windows may still show an unknown-publisher warning.
Keep Windows security enabled and review the source
and publisher warnings before choosing whether to install.

Use public Supabase URL/anon configuration and `VITE_AUTH_MODE=supabase`.
Never embed Gemini or Supabase service-role keys in the frontend. Native
sign-in is separate from browser sign-in; cookies are not copied.

The **Windows widget** GitHub Actions workflow produces update-signed installer
and executable artifacts, not a public release. Repository Actions variables
are `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`VITE_TURNSTILE_SITE_KEY` for the Contact form. An explicitly selected
mock-auth demo is labeled separately. Artifacts expire after 14 days.
The encrypted Actions secret `TAURI_SIGNING_PRIVATE_KEY` must contain the same
private key whose public half is configured in `tauri.conf.json`; optionally
set `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` for a password-protected key. Never
commit either value. Back up the signing key securely: losing it prevents
existing installations from accepting future updates.
Do not ask users to disable Defender or Smart App Control. If Windows blocks
a local Rust build helper, use the reviewed Windows CI build instead.

## In-app updates

Install 0.1.5 once to enable the updater. Existing older executables cannot gain
this control without a bootstrap installation. In Tasks choose **Update**; in
Dock choose the download-arrow control. Kora checks for a newer signed version,
then offers **Update and restart**. Save any open draft first. Only that explicit
confirmation downloads and installs; checks never interrupt a focus session.
The passive Windows installer replaces the app and restarts it without requiring
a manual reinstall. The application identifier and stored user data stay intact.
Offline checks or rejected downloads show Retry, not a false success state.
No signature or TLS bypass is enabled. Keep the configured endpoint reachable.
If a deployment changes between checking and downloading, signature validation
rejects mismatched bytes; Retry fetches the current feed before downloading again.

For each update, bump both native version fields, build with the same signing
key, run `npm run desktop:package`, and deploy the installer and feed together.
Do not publish a mock-auth demo feed as a connected-app update.

## Validation

- Frontend/native/companion regression tests and Rust bridge-origin tests.
- Live: load 0.3.10, play supported browser music, open the native Dock without
  a web-app tab, verify actual capture mode and increasing onset counts in
  dev, with matching square pops and static icons.
- Pause/close the music tab, disconnect the browser, restart/reload the
  companion/widget: expired captures never flash and reconnection recovers.
- Play Zalo/desktop audio while browser music is paused: no squares flash.
- Resize all five layouts, maximize/restore and Tasks/Dock; no scrollbars,
  clipped controls, duplicate timer or duplicate completion log.

The former system-audio version was confirmed working by the user. The new
browser-only native bridge needs live acceptance after a successful build.

## Matrix and timer controls

The matrix has Kick, Clap, Hi-hat, Bass and Melody rows. Melody uses a
250–4000Hz tonal-energy envelope, not isolated instruments or note
transcription. Sustained tonal audio holds a steady pattern; silence,
pause, stale envelopes and capture loss clear it. Percussion remains
transient-driven (or an explicitly confident tempo lock). Clock fallback
never invents flashes. Real kick onsets gently correct the locked eighth-note
phase within its error gate. Melody adds a 150 ms level-scaled flash on phrase
activation/new note sequences or real hat accents; estimated hat ticks do not
trigger it, and its envelope still expires after 700 ms. Long silence/capture
restart and low-confidence tempo reacquisition retain their existing behavior.
Shapes hold for eight seconds and reflash within their
mask on captured onsets or confident audio-tempo ticks. Each hit brightens and
pops against the softer held cells; there is no breathing loop or clock-mode flash.
The arrow button is the only layout selector; color/palette controls remain in
the settings popover.

Tasks retains its Focus Dock even with an empty focus list. Click its time
to expand timer controls. Click the native music dock's time to open the
shared duration/mode settings. Both use the existing Pomodoro controller;
changing a duration does not rewrite an already-started session. Start also
works without a pinned task, as a standalone focus or break session. Only
the pop-out Dock is always-on-top; returning to Tasks restores a normal
window, and startup/sign-in is never pinned above other apps.
