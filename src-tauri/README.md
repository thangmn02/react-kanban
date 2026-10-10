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
native blur because that leaves opaque corner blocks. Older systems retain the
rounded CSS/region fallback when compositor corners are unavailable. The native frame paint
handler suppresses the OS caption/border before the window first becomes visible,
while retaining resizing, activation and DPI handling. CSS adds a translucent
milky gradient, a bright rim and soft inset bevel above all panels. The bevel is
pointer-transparent so the glass does not intercept controls. The web dock keeps
its existing larger radius. Native glass uses a light translucent acrylic accent
independent of Windows dark mode, so an inactive dock keeps its frost. The opaque
system backdrop is cleared. The native command owns material changes and reapplies
the accent after moving or resizing; a webview remount does not clear cached frost.

The Tabs layout matches the compact tabbed dock composition: a persistent focus
timer above Tasks, Music and Beat Grid, a now-playing strip outside Music, real
focus task rows and a blue-violet glass player card. Start/pause, task selection,
completion and music control use the existing shared controllers. Arrow keys,
Home and End navigate the tabs. Empty music/task states remain usable.
Tabs is the only dock layout, including installations with old saved layouts.
The circular timer stays visible above all three tabs with Start/Pause, Reset
and Complete & next. Drag the native dock from any empty header area or its
Tabs label; buttons and settings stay interactive. Color and palette settings
  are retained. Native and browser PiP open at 520×580; native can shrink to
  320×360. At compact sizes the timer moves beside its controls and the grid
  keeps four rows of eight cells with smaller tiles/gaps. Music has a seekable
  timeline, current/total time, previous/play/next and volume/mute controls.
  Seeking is disabled for streams without a finite, seekable duration; track
  navigation is disabled when the source exposes no enabled player button.
  Older Companions still supply play/pause; reload the updated Companion for
  the new controls and capability metadata. Only playing music shows the small
  strip outside Music. Long task lists or exceptional status messages can scroll
  when necessary. Tasks can scroll without visible
scrollbar bars. Tab changes preserve the native window's resized size.
The same composition is used in browser PiP, where CSS
glass blurs page content rather than the desktop behind the browser window.

## Automatic browser audio

Install/reload **Kora Music Companion 0.3.14** in the browser used for music.
It discovers supported music sites, connects to Kora, and supplies metadata,
source selection, controls and fresh playback clocks. No Kora web tab is needed.
On supported Windows builds, Kora captures the process tree of the browser
owning that local connection automatically, including new tabs and browser
restarts. No repeated extension capture click is required in the native app.
The picker selects metadata and controls, not isolated tab audio: other music,
calls or notifications in that same browser can affect the four visible rows. Other
desktop processes are excluded. Browser output and volume remain unchanged.
Silent, unavailable or disconnected capture leaves the grid still. Native PCM
travels through a bounded local IPC Channel, never WebSocket/network or disk.
The web/PiP version retains browser tabCapture and its permission requirements.

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
executable are now Kora / 0.1.15 / `kora.exe`.

The normal product temporarily hides the fifth Lead row and its availability
strip. Private diagnostics retain timestamped Lead attacks from the validated
EventTrack cache. The legacy Spleeter feature, model download, workers/WASM and
delayed-audio path are retired. The frozen Lead pipeline remains available internally; the existing four local
detectors continue unchanged. Original audio remains immediate.
Pause/seek/source changes clear stale scheduled events. Previously downloaded
model data is left inert rather than deleted from user profiles. See the
[cache contract](../docs/beat-event-cache.md) and current
[quality report](../plans/reports/diagnosis-261007-1024-five-row-quality.md).

## Development and distribution

Requires Rust MSVC, Visual Studio C++ Build Tools with Windows SDK, Node.js
and WebView2. Use `npm run tauri dev` (Vite port 1420), or
`npm run tauri build`. Installer output is `target/release/bundle/nsis/`.
Use the installer for the WebView2 prerequisite bootstrap. It includes the
matching unpacked Music Companion and an offline installation guide. In dock
settings choose **Install or update Companion** to open its resource folder,
then use the browser's **Load unpacked** action for its `extension` folder.
Browser installation remains a one-time user action.

Browser **Reload** rereads the installed files; it does not fetch new Companion
code. When an app update cannot complete, users can independently download the
[public Companion ZIP and update instructions](https://koraspace.online/music-companion.html#update-companion).
Replace the contents of `%LOCALAPPDATA%\Kora\music-companion\extension`, keeping
`manifest.json` directly in that folder, then reload the extension and music
tabs. A repository checkout is unnecessary. The offline guide links to this
route. Updating these files does not update the Kora executable.

`music:package` generates the current and legacy public Companion ZIP URLs and
the native resource tree under `generated/music-companion/`. Packaging clears
retired generated model/runtime assets before copying its runtime inventory. Generated archives
and resources are ignored by Git; `prebuild` regenerates them from the tracked
runtime inventory. Native frontend builds omit the ZIP copies because the
installer already includes the unpacked resource.

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
An enforced Windows signing policy can block the installer entirely, leaving
both the prior executable and its included Companion unchanged. Such machines
require an installer with a Windows-trusted publisher signature; the Minisign
update signature alone does not satisfy that policy.
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
- Live: load 0.3.14, play supported browser music, open the native Dock without
  a web-app tab, verify actual capture mode and increasing onset counts in
  dev, with matching square pops and static icons.
- Pause/close the music tab, disconnect the browser, restart/reload the
  companion/widget: expired captures never flash and reconnection recovers.
- Play Zalo/desktop audio while browser music is paused: no squares flash.
- Resize Tabs, switch all three panels, maximize/restore and Tasks/Dock; no scrollbars,
  clipped controls, duplicate timer or duplicate completion log.

Actual Windows PCM, process isolation and native detector routing were verified
with task-owned audio. Full-song listening and browser-platform handoff remain
user acceptance checks after installation.

## Matrix and timer controls

The normal matrix currently has four rows: Kick, Snare/Clap, Hi-hat/Cymbal and
Bass/Low pulse, with eight cells per row. Private Lead diagnostics retain a fifth
row; the normal Lead row and its readiness strip are temporarily hidden. In those
diagnostics, Melody flashes for actual cached note attacks, never legacy
instrument-v1 messages, raw hats, sustain or a tonal energy envelope. Its brief
level-scaled flash and 700 ms state expiry remain.
Silence and pause clear semantic activity. Percussion remains transient-driven;
tempo events carry timing without claiming instrument identities. Cached events
are preferred when available, with existing local capture as fallback. Without
capture or cached data, the explicitly degraded path uses decorative flashes
that never claim real instrument detections. See the
[event cache contract](../docs/beat-event-cache.md) for configuration and bounds.
Real kick onsets gently correct the locked eighth-note phase within its error gate.
Quiet playback keeps leased analysis alive. Capture restart and low-confidence
tempo reacquisition retain their existing recovery behavior.
Shapes hold for eight seconds and reflash within their
mask on captured onsets or confident audio-tempo ticks. Each hit brightens and
pops against the softer held cells; decorative fallback remains distinguishable
in telemetry from real onsets, notes and tempo events.
Tabs is the only layout; color/palette controls remain in the settings popover.

Tasks retains its Focus Dock even with an empty focus list. Click its time
to expand timer controls. Click the native music dock's time to open the
shared duration/mode settings. Both use the existing Pomodoro controller;
changing a duration does not rewrite an already-started session. Start also
works without a pinned task, as a standalone focus or break session. Only
the pop-out Dock is always-on-top; returning to Tasks restores a normal
window, and startup/sign-in is never pinned above other apps.
