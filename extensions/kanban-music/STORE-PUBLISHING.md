# Public installation handoff

The ZIP is prepared for upload, **not published**. A store owner still needs to submit it, complete the listing/disclosures, and pass review. Chrome Web Store publication is the supported normal installation route for Chrome on Windows/macOS; self-hosting the ZIP cannot provide a normal one-click install. [Official distribution guidance](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions) · [Publishing guide](https://developer.chrome.com/docs/webstore/publish).

## Owner checklist

1. Run `npm run music:package`. Upload `public/downloads/kanban-music-companion.zip` using your Chrome Web Store developer account.
2. Use the generated 128px icon at `extensions/kanban-music/icons/128.png`. Prepare the screenshots and any promotional assets the store requests, showing **actual** timer/music UI with the extension installed.
3. Review the draft below, complete the store's privacy disclosures accurately, and use the privacy URL after deploying: `https://kanthangboard.netlify.app/music-companion-privacy.html`.
4. Test the packaged extension in a desktop browser against the deployed app: install, refresh Kanban, open Floating Focus, play a YouTube track, pause/resume, change tracks, close the tab, then disable the extension. Also test SoundCloud and Spotify Web; site/player limitations must not be advertised as guaranteed functionality.
5. Submit for review. When the listing is approved, set Netlify's `VITE_MUSIC_EXTENSION_STORE_URL` to its real HTTPS listing URL and redeploy the app. The install button opens the listing instead of the early-access guide.
6. For subsequent releases, increase `manifest.json` version and regenerate/upload the ZIP. Store installs receive store updates; unpacked installations need a replacement folder and extension reload.

## Draft listing

**Name:** Kanban Music Companion

**Short description:** See your browser music and play or pause it beside Kanban's Floating Focus timer.

**Description:** Keep your current music beside your focus timer. Kanban Music Companion connects supported YouTube, SoundCloud and Spotify Web tabs to Floating Focus at kanthangboard.netlify.app. Install once, refresh Kanban, and start a song in the same browser. The track title, artist when available, and play/pause controls appear automatically. No extension ID or music account sign-in is needed. Track information stays inside your browser. Desktop Chromium browsers only; browser autoplay restrictions and some custom/protected players may limit control. This does not control native desktop music apps.

**Single purpose:** Display and control supported browser media from Kanban's detached focus window.

**Permissions justification:**

- `scripting`: Read HTML audio/video state and available Media Session metadata on supported music tabs; execute play/pause only for the selected session.
- `activeTab` / `tabCapture`: After a user invokes the extension on a supported music tab, capture that tab locally for beat lighting. No microphone capture or recording. Video tracks from Chrome's capture recipe are immediately stopped.
- `offscreen`: Host the temporary AudioContext/AnalyserNode with `USER_MEDIA`, keep the captured music audible, and release capture on pause/stop or a missing app lease.
- Music site host access: Find and control media on YouTube, SoundCloud and Spotify Web. No all-sites permission.
- Kanban host access: A content script relays a small, validated protocol between the exact Kanban origin and this extension. It cannot run arbitrary commands.
- Localhost/127.0.0.1: Enable the same workflow for local development; requests are accepted only on ports 5173/5174. Consider removing these patterns and matching allowed origins together from a production-only release if local development support is unnecessary.

**Data behavior to disclose:** Track title, artist, source site, playback position/state and ephemeral session identifiers are processed locally. Optional live beat sync processes the selected tab's audio locally after extension invocation; a video track is requested by the tab-capture recipe and stopped immediately without analysis or recording. Only band onset events and metadata reach the Kanban page. The extension has no analytics, remote code, persistent listening history, or external audio transmission. Host access exposes supported page content to the locally injected reader; do not claim it requires no access. Verify current store form categories against the actual implementation before submitting.

## Packaging boundary

The ZIP includes only the manifest, runtime scripts, options page/style, and generated icons. It excludes the app's `.env`, API keys, tests, node_modules, and repository history. No remote scripts are used. The GitHub reference project's code is not included.
