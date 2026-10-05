# Kora Music Companion

This is an independent implementation, not a copy of ungive/media-control-extension.

Our own Manifest V3 extension connects browser music to Kora's Floating Focus. No extension ID, music login, or API key is required. The inline focus dock stays unchanged; music lives in the detached window.

Version 0.3.9 also connects directly to the running **Kora Windows widget**
through loopback `127.0.0.1:47635`. No Kora web tab is needed in that mode.
The widget receives only allowlisted browser music metadata and visual
events; it does not listen to desktop/system audio. Browser permission can
still require a toolbar click on the playing music tab. See
[native setup and security](../../src-tauri/README.md).

The five rows are Kick, Clap, Hi-hat, Bass and Melody. Melody is a sustained
tonal-energy approximation, not isolated instruments: its squares breathe
only while a live envelope is present and go dark on silence, pause or
capture loss. Decorative shapes now hold for 2.8 seconds before fading.

## Test now in Chrome, Edge, or Brave (desktop)

1. Build the distributable with `npm run music:package` (also runs before dev/build).
2. In Floating Focus, choose **Add music controls**. It opens an English/Vietnamese guide at `/music-companion.html`, with a downloadable ZIP and browser-specific instructions.
3. Download and extract `public/downloads/kanban-music-companion.zip`. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
4. Reload the Kora tab once. Open **Floating Focus** from the existing focus dock. The extension is detected automatically.
5. Pin **Kora Music Companion** once in the browser's puzzle-piece Extensions menu. Play a track on YouTube, YouTube Music, SoundCloud, Spotify Web, Apple Music, Deezer, or Tidal in this same browser/profile. The dock discovers all detected sessions and follows another tab when its playback starts, on the next discovery poll (normally within two seconds). Its picker also lets you choose a source manually. For capture-eligible music, click the pinned companion on the music tab if the browser requires access. It opens/focuses Kora and selects that song automatically. Open Floating Focus from the timer.

Developers can instead load this `extensions/kanban-music` folder after generating the icons. Keep an unpacked extension's folder; deleting it breaks the installation.

The app must be at `https://kanthangboard.netlify.app`, or localhost / 127.0.0.1 on port 5173 or 5174. Production requires deploying the updated web app as well; loading the extension does not update Netlify.

## Simple public installation

Developer mode is an early-access workaround, not the intended nontechnical-user experience. Publish the ZIP through the Chrome Web Store for a normal **Add to Chrome** flow. See [STORE-PUBLISHING.md](./STORE-PUBLISHING.md) for the handoff checklist. No listing has been submitted or published by this code change.

After publication, set `VITE_MUSIC_EXTENSION_STORE_URL` in Netlify to the actual HTTPS Chrome Web Store or Edge Add-ons listing, then redeploy. The app's **Add music controls** link switches directly to that listing. Detection works with the store-assigned ID; no code changes or ID entry are needed.

## Permissions and limits

- Uses scripting access only on the listed music sites and local development pages; it does not run on every website.
- The exact music host list is in `sites.js`, mirrored by the manifest. It includes the listed services' bare/www/mobile hosts and Tidal's `listen.tidal.com` web player; no `<all_urls>` or wildcard subdomain access. Detection/control is the same HTML audio/video + Media Session reader on every site, not site-specific DOM or account APIs. A document-start MAIN-world observer also tracks detached `new Audio()` objects and media elements whose `play()` is called outside the DOM. It preserves native playback methods and uses weak references, stable element IDs, source guards, and leased clock updates. WebAudio-only, inaccessible frames, and closed shadow DOM players remain unsupported.
- **Capture on every supported platform:** YouTube, YouTube Music, SoundCloud, Spotify Web, Apple Music, Deezer and Tidal all attempt the same ordinary browser-approved tab capture, including when an element uses encrypted media. A site name or media-keys flag never preemptively blocks the attempt. Capture becomes live only after audible analyser proof; actual silence or browser denial keeps clock mode and still squares. Metadata/song clock and ordinary play/pause continue where the player permits them. Nothing decrypts media or bypasses browser capture restrictions. Support for the common pipeline is not a guarantee that every account/track/browser permits capture.
- Reads Media Session title/artist where available, falling back to the tab document title. Generic HTML audio/video playback is supported; WebAudio-only players, protected frames and some sites' custom players are not guaranteed.
- Polls while Floating Focus is open, with no tracking server, API key or persistent track history. Closing Floating Focus stops polling. Closing the parent app closes Floating Focus too.
- Session-only storage remembers the last approved app origin/tab and the clicked music tab with a random selection token. A toolbar click returns to that app (or opens the deployed app if none exists). Ordinary polls preserve manual song selections until another detected source starts playback; a fresh toolbar click selects its music tab again. When the selected playing source pauses or disappears, the dock follows another playing source. If all sources pause, it keeps the last available selection. Each handoff releases the previous beat subscription and automatically requests capture for the new source; browser capture permission may still require a toolbar click on a new tab. No song titles or audio are stored. App host access locates existing tabs without broad `tabs` or all-sites permission.
- No native desktop app control, seeking, next/previous, or automatic extension installation is included. Browser consent is always required.
- Browser autoplay rules still apply. If resume is blocked, play once in the source tab. Incognito and separate browser profiles are not shared.
- The island-bar dot keeps its decorative double-thump heartbeat. Pausing hides the dot and keeps the panel; no session means no music panel or dot. Reduced-motion preferences disable the heartbeat and scaling.
- **Fallback:** `mode: clock` retains playback metadata and controls, but squares stay completely still. There is no timer or clock-driven beat animation. Icons always stay dim and static.
- **Live beat sync (v3):** playing sessions on every supported service automatically request capture from the browser. Each real band onset pops that row's active squares to full color and 1.12× scale for 150ms. For sparse, steady transients, v0.3.7 can lock to an estimated 60–180 BPM pulse and drive kick/hat/snare squares on an eighth-note grid. The lock needs a strong six-second autocorrelation peak and releases after more than four seconds of low confidence; irregular music keeps the calmer raw-accent mode. The worker reports `capture` only after both stream confirmation and an audible analyser sample; a silent stream stays in clock mode and is stopped after 2.5 seconds. Denied or silent requests retry after 30 seconds; transient failures retry after 3 seconds. Resume and unmute also retry. No in-memory “clicked” flag blocks retries after app/worker reloads.
- **Browser permission:** automatic attempts do not grant permission. Chrome, Edge or Brave may require clicking **Kora Music Companion** on the music tab, especially after extension reload/revocation or on a new tab. A click retries immediately, including when done before Floating Focus opens. The app shows a visible **Open music tab** button and instructions on permission denial. Transient failures are not mislabeled as permission denial. Do not promise click-free capture when the browser revokes access.
- **Developer ground truth:** **Beat debug (dev)** shows the selected session's actual mode/reason, capture ID, kick/snare/bass/hat counters, and per-session mode snapshots from discovery. Each `sync.state` event is tagged with the selected session/subscription. Only one session is captured; others honestly report clock mode (`not-selected`, `not-playing`, or `muted`). Actual failures report `silent`, `capture-permission` or the relevant failure code, not guessed DRM. Older companions reporting `drm-protected` show an update hint. Duplicate/stale onsets cannot add extra pops. Missing state/onset traffic expires capture mode even when clock updates keep arriving.
- Capture uses `tabCapture`, `activeTab`, and an offscreen `USER_MEDIA` document. The documented audio-plus-video constraints use the same stream ID; video tracks are stopped immediately. Captured audio is routed back to the speakers once because Chrome suppresses the original output during capture. Nothing is recorded or uploaded.
- Pause, ended playback, mute, session replacement, tab closure, navigation, and closing Floating Focus release capture. A six-second lease releases tracks if the app disappears without cleanup. The offscreen sampler runs at 60Hz with one reused FFT buffer; background documents do not reliably receive animation frames.
- To remove access, disable/remove the extension in the browser's extension manager.

Document Picture-in-Picture must be supported by the browser. The browser-owned title bar and window frame cannot be made transparent by the webpage.

## Updating an existing installation

Version 0.3.7 adds local tempo estimation and beat visuals; 0.3.6 removed the remaining host/media-keys capture blocks for all listed services, 0.3.5 enabled Spotify, and 0.3.4 added detached HTML audio discovery. Replace the unpacked extension folder with the new ZIP contents (or reload the repo folder), click **Reload** on its card in your browser's extension manager, and refresh Kora and the music tab once. This music-tab refresh is important after upgrading from 0.3.3: the observer must run before the player creates its off-document audio object. No additional permissions are introduced over 0.3.3. Pin the companion once for all listed music services. App refreshes and pause/resume retry capture while browser access remains granted; a new tab or extension reload may need another click. Silent streams stop after 2.5 seconds and back off 30 seconds; resume/unmute or a toolbar click retries immediately. Install separately in each browser/profile. The updated app and extension are both needed; Floating Focus still opens from the timer.

See [BEAT-VALIDATION.md](./BEAT-VALIDATION.md) for API evidence, detector settings, and the live validation status.

If a playing site is missing, open this companion's **Details → Extension options** and press **Check music detection**, or use **Music detection (dev)** in the development app. The read-only report distinguishes missing host access/injection failure, DOM/detached media counts, and Media Session-only playback. It reports website names and safe counts/state flags, not track titles, source URLs, account details or audio. The diagnostic command accepts only this extension's own setup page or the existing allowlisted Kora origins. A paused YouTube session can be a previously loaded player and is not proof of playing music. On first discovery, an old paused toolbar selection does not override a playing session; new toolbar clicks and manual picker choices still select that session.

Live Brave validation on 2026-10-03 confirmed SoundCloud discovery, play/pause, real capture onset counters and square pops, and capture recovery after resume and page refresh without another toolbar click. This does not guarantee permission survives extension reloads, nor establish compatibility with every SoundCloud player or with Edge. See the validation report for remaining checks.

Version 0.3.5 also confirmed real Spotify capture in Brave on “Chemical” by Post Malone after browser consent: all four counters climbed, squares animated, icons stayed static, pause cleared motion, and resume/page refresh recovered capture without another click. Other tracks and browsers can still deny or silence capture; the live result does not guarantee universal Spotify support.

Version 0.3.6 additionally confirmed real Apple Music capture on “Waiting For Love” by Avicii and YouTube Music capture in Brave. Live onset counts increased, squares popped and icons stayed static. Apple Music pause cleared all square lighting; resume and app refresh recovered capture without another toolbar click after consent. Deezer and Tidal live testing was skipped at the user's request; shared-path regression coverage remains. These observed results do not guarantee every service/track/browser allows capture.
