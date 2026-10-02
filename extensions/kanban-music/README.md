# Kanban Music Companion

This is an independent implementation, not a copy of ungive/media-control-extension.

Our own Manifest V3 extension connects browser music to Kanban's Floating Focus. No extension ID, music login, or API key is required. The inline focus dock stays unchanged; music lives in the detached window.

## Test now in Chrome, Edge, or Brave (desktop)

1. Build the distributable with `npm run music:package` (also runs before dev/build).
2. In Floating Focus, choose **Add music controls**. It opens an English/Vietnamese guide at `/music-companion.html`, with a downloadable ZIP and browser-specific instructions.
3. Download and extract `public/downloads/kanban-music-companion.zip`. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
4. Reload the Kanban tab once. Open **Floating Focus** from the existing focus dock. The extension is detected automatically.
5. Open YouTube, SoundCloud, or Spotify Web in the same browser/profile. Start a track in its original tab once. The pop-out will show the title/artist/source and offer play/pause. Multiple detected media sessions can be selected.

Developers can instead load this `extensions/kanban-music` folder after generating the icons. Keep an unpacked extension's folder; deleting it breaks the installation.

The app must be at `https://kanthangboard.netlify.app`, or localhost / 127.0.0.1 on port 5173 or 5174. Production requires deploying the updated web app as well; loading the extension does not update Netlify.

## Simple public installation

Developer mode is an early-access workaround, not the intended nontechnical-user experience. Publish the ZIP through the Chrome Web Store for a normal **Add to Chrome** flow. See [STORE-PUBLISHING.md](./STORE-PUBLISHING.md) for the handoff checklist. No listing has been submitted or published by this code change.

After publication, set `VITE_MUSIC_EXTENSION_STORE_URL` in Netlify to the actual HTTPS Chrome Web Store or Edge Add-ons listing, then redeploy. The app's **Add music controls** link switches directly to that listing. Detection works with the store-assigned ID; no code changes or ID entry are needed.

## Permissions and limits

- Uses scripting access only on the listed music sites and local development pages; it does not run on every website.
- Reads Media Session title/artist where available, falling back to the tab document title. Generic HTML audio/video playback is supported; WebAudio-only players, protected frames and some sites' custom players are not guaranteed.
- Polls while Floating Focus is open, with no tracking server, API key or persistent track history. Closing Floating Focus stops polling. Closing the parent app closes Floating Focus too.
- No native desktop app control, seeking, next/previous, or automatic extension installation is included. Browser consent is always required.
- Browser autoplay rules still apply. If resume is blocked, play once in the source tab. Incognito and separate browser profiles are not shared.
- The island-bar dot keeps its decorative double-thump heartbeat. Pausing hides the dot and keeps the panel; no session means no music panel or dot. Reduced-motion preferences disable the heartbeat and scaling.
- **Fallback:** `mode: clock` retains playback metadata and controls, but squares stay completely still. There is no timer or clock-driven beat animation. Icons always stay dim and static.
- **Live beat sync (v3):** playing sessions automatically request capture from Chrome. Each real band onset pops that row's active squares to full color and 1.12× scale for 150ms. The worker emits `sync.state` only reporting capture after the offscreen stream is confirmed; a listening line appears while capture is live. Denied requests retry after 30 seconds; transient capture failures retry after 3 seconds. Resume and unmute also retry. No in-memory “clicked” flag blocks retries after app/worker reloads.
- **Browser permission:** automatic attempts do not grant permission. Chrome may require clicking **Kanban Music Companion** on the music tab, especially after extension reload/revocation or on a new tab. A click retries immediately. The debug reason reports `capture-permission` on API denial; do not promise click-free capture when Chrome revokes access.
- **Developer ground truth:** the player includes **Beat debug (dev)** only in development builds: actual mode/reason, capture ID, and kick/snare/bass/hat counters. Onsets carry capture IDs and sequence numbers; duplicate or stale events cannot add extra pops. Missing state/onset traffic expires capture mode even when clock updates keep arriving.
- Capture uses `tabCapture`, `activeTab`, and an offscreen `USER_MEDIA` document. The documented audio-plus-video constraints use the same stream ID; video tracks are stopped immediately. Captured audio is routed back to the speakers once because Chrome suppresses the original output during capture. Nothing is recorded or uploaded.
- Pause, ended playback, mute, session replacement, tab closure, navigation, and closing Floating Focus release capture. A six-second lease releases tracks if the app disappears without cleanup. The offscreen sampler runs at 60Hz with one reused FFT buffer; background documents do not reliably receive animation frames.
- To remove access, disable/remove the extension in the browser's extension manager.

Document Picture-in-Picture must be supported by the browser. The browser-owned title bar and window frame cannot be made transparent by the webpage.

## Updating an existing installation

Version 0.3.1 adds automatic capture attempts and truthful `sync.state`. Replace the unpacked extension folder with the new ZIP contents, click **Reload** on its card in `chrome://extensions`, accept any requested permissions, and refresh Kanban. Play music and select it in Floating Focus. Capture is attempted automatically; click the companion on the music tab only if Chrome denies permission. The updated app and extension are both needed.

See [BEAT-VALIDATION.md](./BEAT-VALIDATION.md) for API evidence, detector settings, and the live validation status.
