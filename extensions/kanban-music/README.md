# Kora Music Companion

This is an independent implementation, not a copy of ungive/media-control-extension.

Our own Manifest V3 extension connects browser music to Kora's Floating Focus. No extension ID, music login, or API key is required. The inline focus dock stays unchanged; music lives in the detached window.

Version 0.3.13 connects directly to the running **Kora Windows widget**
through loopback `127.0.0.1:47635`. No Kora web tab is needed in that mode.
The widget receives only allowlisted browser music metadata and visual
events. Kora 0.1.14 automatically captures that browser's process audio on
Windows, without repeat extension clicks. Overlapping audio in the same browser
can affect beats; the picker does not isolate tab audio. Other desktop apps are
excluded. Web/PiP tab capture can still require a toolbar permission click. See
[native setup and security](../../src-tauri/README.md).

The five rows are Kick, Clap, Hi-hat, Bass and Melody. Melody flashes on note
attacks from one dominant harmonic part in an AI-isolated instrumental stem.
Repeated pitches can trigger separate flashes; sustain, vocals, raw hats and
decorative percussion shapes do not trigger the fifth row. It stays dark until
AI instrument notes are enabled. Missing states expire after 700 ms.

In native Kora Music, **AI instrument notes** enables its own local model cache;
instrument flashes follow with processing delay while sound/percussion remain
immediate. All code/WASM ships with the installer. Native pause/seek/handoff clears
pending flashes. In web/PiP, choose **AI instrument notes**, or open the companion's
**Details → Extension options**, then **Download and enable**. This downloads
about 157 MB of hash-verified Spleeter model data once, cached in this browser
profile. All inference code and WASM ship in the extension. Audio stays in a
bounded memory buffer and is never uploaded or saved to disk. Original audio
and all five rows share a 3.5-second delay while enabled; videos can be out of
sync. **Turn off** restores immediate playback and leaves the fifth row dark.

Spleeter separates vocals, drums, bass and other instruments; it does not
separate piano from guitar or name instruments. A harmonic-profile tracker
retains one prominent part within the instrumental stem. Dense arrangements,
similar timbres and source leakage can cause missed or extra notes; this is
not exact transcription. Model setup or missed processing deadlines leave
the fifth row dark while the first four detectors keep running. A runtime
failure preserves the existing audio delay until capture restarts, avoiding
an abrupt skipped section. See [model provenance/licenses](./INSTRUMENT-NOTICES.md).

For sparse captured drums, real kick hits gently correct the locked grid phase
with a 0.4 gain, accepting errors within 0.35 of an eighth note. Dense drums
retain direct onset lighting. The gate rejects distant accents; it cannot
identify every syncopation or repair an arbitrary initial phase offset. Long
silence still releases capture after 2.5 seconds, and low tempo confidence
releases the lock after four seconds. Capture/tempo then reacquire automatically;
this is distinct from preserving a running phase during an audible section.

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
- Capture uses `tabCapture`, `activeTab`, and an offscreen `USER_MEDIA` document. The documented audio-plus-video constraints use the same stream ID; video tracks are stopped immediately. Captured original audio is routed back to the speakers once because Chrome suppresses the original output during capture, with the disclosed delay only when AI notes are enabled. Nothing is recorded or uploaded.
- Pause, ended playback, mute, session replacement, tab closure, navigation, and closing Floating Focus release capture. A six-second lease releases tracks if the app disappears without cleanup. The offscreen sampler runs at 60Hz with one reused FFT buffer; background documents do not reliably receive animation frames.
- To remove access, disable/remove the extension in the browser's extension manager.

Document Picture-in-Picture must be supported by the browser. The browser-owned title bar and window frame cannot be made transparent by the webpage.

## Updating an existing installation

Use Kora 0.1.12/web release with companion 0.3.12 for isolated instrumental notes.
This companion patch confirms attack pitch and groups faint leading tails with
the full attack, preventing double flashes at different audio-frame alignments.
The new app rejects legacy broad-tone Melody events, leaving that row dark
until the companion is updated and AI notes are enabled. Replace the unpacked
folder with the new ZIP contents, click **Reload** on its card, and refresh
Kora and the music tab once. Keep the extracted folder. No broad host access
is added; the CSP permits the bundled WASM runtime. Install separately in
each browser/profile. Browser permission can still require a toolbar click
after restarting, opening a new music tab or reloading the extension.
Silent input stops after 2.5 seconds plus the active audio delay so buffered
music drains; pause, seek, rate change and source switch discard the buffer
immediately. Resume/unmute or a toolbar click retries capture.

See [BEAT-VALIDATION.md](./BEAT-VALIDATION.md) for API evidence, detector settings, and the live validation status.

For local event-path diagnostics, see [Beat Grid telemetry](#beat-grid-telemetry).
Tracing is opt-in, bounded and does not change detection or visual timing.

If a playing site is missing, open this companion's **Details → Extension options** and press **Check music detection**, or use **Music detection (dev)** in the development app. The read-only report distinguishes missing host access/injection failure, DOM/detached media counts, and Media Session-only playback. It reports website names and safe counts/state flags, not track titles, source URLs, account details or audio. The diagnostic command accepts only this extension's own setup page or the existing allowlisted Kora origins. A paused YouTube session can be a previously loaded player and is not proof of playing music. On first discovery, an old paused toolbar selection does not override a playing session; new toolbar clicks and manual picker choices still select that session.

Live Brave validation on 2026-10-03 confirmed SoundCloud discovery, play/pause, real capture onset counters and square pops, and capture recovery after resume and page refresh without another toolbar click. This does not guarantee permission survives extension reloads, nor establish compatibility with every SoundCloud player or with Edge. See the validation report for remaining checks.

Version 0.3.5 also confirmed real Spotify capture in Brave on “Chemical” by Post Malone after browser consent: all four counters climbed, squares animated, icons stayed static, pause cleared motion, and resume/page refresh recovered capture without another click. Other tracks and browsers can still deny or silence capture; the live result does not guarantee universal Spotify support.

Version 0.3.6 additionally confirmed real Apple Music capture on “Waiting For Love” by Avicii and YouTube Music capture in Brave. Live onset counts increased, squares popped and icons stayed static. Apple Music pause cleared all square lighting; resume and app refresh recovered capture without another toolbar click after consent. Deezer and Tidal live testing was skipped at the user's request; shared-path regression coverage remains. These observed results do not guarantee every service/track/browser allows capture.

## Beat Grid telemetry

Phase 0 adds local diagnostics to the existing pipeline. It does not change
detectors, tempo selection, playback delays, recovery timers or decorative
visuals. The current optional instrument models remain optional and unchanged.

### Enable and collect

Tracing is off by default. In the app's developer console:

```js
__koraBeatTelemetry.enable(true);
__koraBeatTelemetry.clear();
```

Opening the app with `?musicDebug=1` also enables its recorder. For web/PiP,
enable the producer as well: open the Companion service worker's developer
console from the browser extension manager, then run:

```js
await chrome.storage.local.set({ beatTelemetryEnabled: true });
```

Pause and resume after enabling. Native capture and instrument workers receive
the diagnostic setting when they start. Background/offscreen storage changes
alone do not restart capture or affect playback.

Reproduce the problem, then collect each relevant realm while it is alive:

```js
const trace = __koraBeatTelemetry.snapshot();
console.table(trace.records);
console.log(trace.counts, trace.evicted);
```

The app, Companion background, offscreen document and instrument worker have
separate buffers. Native transport observations enter the app's buffer. Closing
an offscreen document or worker destroys its local buffer. At most 2,048 records
are retained per realm; frequent analysis frames can evict older events quickly.
Stage counts survive eviction until `clear()`. Counts include transport hops and
multiple cells, so they are not counts of unique notes or physical drum hits.

Disable diagnostics after collection, then pause/resume to clear the worker and
native-capture flags:

```js
__koraBeatTelemetry.enable(false);
__koraBeatTelemetry.clear();
// In the Companion service worker console:
await chrome.storage.local.set({ beatTelemetryEnabled: false });
```

Nothing automatically exports telemetry. It contains opaque event/capture IDs,
timing, row claims, queue counts and allowlisted lifecycle reasons. PCM, spectra,
song titles, URLs and account information are excluded.

### Event interpretation

Each diagnostic sidecar has `id`, `source`, `type`, `confidence`, `detectedAt`,
`targetTime` and `targetClock`. The same ID survives the producer, scheduler,
transport and renderer. Metadata is optional; malformed metadata is ignored
without invalidating an otherwise valid beat message.

| Field | Meaning |
| --- | --- |
| `source: onset` | An existing detector's claim, not verified instrument identity. |
| `source: tempo` | Estimated tempo state or timing-only subdivision; never an instrument identity. |
| `source: random` | An intentional decorative shape, separate from its triggering onset. |
| `source: lifecycle` | Instrument envelope/idle updates without a new note attack. |
| `type` | Diagnostic vocabulary: kick, snare, hat, bass, melodic, generic. Existing UI labels are unchanged. |
| `confidence: null` | The producer does not provide a calibrated confidence. Tempo-state messages use their existing confidence. |
| `active`, `noteSequence` | Instrument state and existing attack sequence; repeated level updates are distinguishable from new attacks. |
| `parentId` | The onset that initiated a decorative shape. Later shape retriggers retain that shape's ID. |

`detectedAt`, `at`, `emittedAt` and `renderedAt` are epoch milliseconds.
`targetTime` is explicitly either `audio-seconds` or `epoch-ms`; never subtract
timestamps from different domains. The native instrument scheduler records its
existing remapping from worker audio time to the delayed visual timeline. It
does not imply synchronization to the original audible note.

`EVENT_STATE_COMMITTED` observes controller state. `EVENT_COMMITTED` observes
the renderer's DOM commit. `EVENT_RENDERED` observes CSS animation start, which
includes the existing CSS delay; reduced-motion mode records the static DOM
commit instead. It is not a physical display or speaker-output timestamp.
Several cells can report the same event ID with different animation delays.

Native PCM retains its 16-byte binary header. Sequence/frame counters correlate
the native channel and Web Audio buffering; no hardware capture timestamp is
introduced. `queueDepth` is local to each component: event count in capture,
pending messages in the runtime, buffered samples in worker batch records,
scheduled sources in the native engine, and unacknowledged packets in Rust.
`durationMs` measures analyzer/tempo work or a worker inference batch only when
tracing is enabled.

### Diagnose a stopped grid

Follow the most recent capture ID and semantic event ID through:

```text
CAPTURE_START → AUDIO_DETECTED → ANALYSIS_FRAME → EVENT_DETECTED
→ EVENT_QUEUED → EVENT_SENT → EVENT_RECEIVED → EVENT_ACCEPTED
→ EVENT_STATE_COMMITTED → EVENT_COMMITTED → EVENT_RENDERED
```

Check `component` at the last observation and any subsequent `EVENT_DROPPED`,
`EVENT_LATE`, `LOW_ENERGY`, `LEASE_EXPIRED` or `CAPTURE_STOP`. Reasons identify
existing owner/sequence/debounce gates, queue limits, missed deadlines,
transport failures, masks and controller state coalescing.
`CAPTURE_RECOVERED` marks audibility returning within a still-running capture.
New capture starts identify reacquisition after a stop.

The classic `relay.js` and browser-owned internal queues have no separate
recorder; their boundaries are background send and app receive. A missing
boundary observation narrows the failure to that transport rather than proving
which browser-internal queue stalled. Evicted records and closed realms cannot
be reconstructed. Collect during the failure before changing source or closing
the dock.

The initial map and verified failure points are in the
[Phase 0 report](../../plans/reports/diagnosis-261006-1534-beat-telemetry.md).

## Beat Grid recovery

Leased capture remains alive through quiet passages. Silence does not claim
audibility or generate onsets. Unrenewed leases and ended tracks still release
the stream. Capture expiry retains the selected clock subscription and retries
automatically; quiet streams receive lease renewals before their first audible
frame. Native backlog, lease loss and capture interruption retry on the next
fresh active Companion clock. Startup/permission failures retain their existing
bounded backoff; pause/resume can retry immediately.

Tempo ticks contain `step`, `phase`, `beatPosition` and `subdivision: 2` instead
of instrument bands. The controller exposes a structural `tickCount`. Semantic
rows use detected onsets even during tempo lock. Random patterns, held shapes,
their tempo retriggers, CSS delays and optional note models remain unchanged.

Late transport events (over 600 ms, up to 2 seconds old) are logged and coalesced
to the latest event per kind before UI delivery. Older events expire and request
subscription renewal, at most once per second. Pending work is checked again
when the UI resumes; newer delivery supersedes older work. The stale-capture
watchdog retains honest clock fallback and requests renewal. This bounded
recovery does not promise correct rhythmic timing during a blocked UI.

The analyzer's playback queue still drops events more than 600 ms past their
audio deadline and continues with fresh detector events. At capacity it evicts
the oldest enqueued work rather than rejecting new work. A late instrument
batch drops missed notes without permanently disabling subsequent analysis.
`EVENT_LATE` and `EVENT_DROPPED` retain provenance; `CAPTURE_RECOVERED` records
returning audio or resumed delivery after a miss. `delivery-coalesced` and
`delivery-late` identify transport recovery. No replacement semantic events are
fabricated.

See the [recovery report](../../plans/reports/diagnosis-261006-1659-beat-recovery.md)
for tests and browser-validation limits.

### Playback-clock scheduling

New producers publish before their existing output deadlines. Events carry
`targetPlaybackTime` in song seconds and a `playbackClock` anchor with actual
`currentTime`, `playbackRate`, `sampledAt`, `playing` and `paused` values. Media
watchers also report `seeking`, `buffering` and a seek `generation`. The same
clock contract serves browser tab capture and native Windows monitoring;
source ownership still comes from the selected subscription/capture IDs.

`beat-timing.js` owns the normalization boundary: AudioContext output deadlines
become epoch deadlines, then song timestamps using the selected media clock.
If supported, browser output timestamps supply the output-clock mapping.
Absent/invalid/throwing capabilities use sampled context time. Native monitor
audio is not speaker output; its mapping is an estimate, with the existing
capture buffering and optional AI offset retained. Future capture timestamps
can improve this boundary without changing the UI scheduler or event schema.
No new capture timestamp or mandatory model is introduced.

The UI scheduler uses one timer, at most 2,048 events and an eight-second
look-ahead horizon. It re-arms from fresh clock samples and rate changes.
Pause, buffering, seeks, source/capture replacement and recovery flush pending
work. Resumption rebuilds from fresh events; old anchors/generations do not
replay. A clock missing for 3.5 seconds expires the queue and requests renewal.
Transport retains its bounded recovery policy, but timely future targets can
survive an older emission timestamp instead of being incorrectly coalesced.

Events more than 600 ms past the media target drop and request throttled
renewal; lesser lateness remains observable. Legacy companions without target
timestamps retain arrival-based behavior; companions without explicit lifecycle
flags use sampled-clock discontinuity detection. Malformed timestamps do not
silently become immediate flashes. These are capability fallbacks, not new
semantic detection sources.

`EVENT_SCHEDULED` records target, projected playback position and queue depth.
Existing event IDs survive scheduling. DOM and animation offsets use the latest
clock mapping; earlier producer mappings remain in transport records. Tempo,
onsets, envelope/lifecycle messages and decorative shapes stay distinct. The
five-row/eight-cell renderer and its intentional masks/CSS delays are unchanged,
so scheduler release, DOM commit and delayed animation start are separate
measurements. Physical speaker/display latency is not inferred from DOM time.

### Cached Beat events and capability fallbacks

The app can merge validated, timestamped EventTrack cache data with the existing
local capture feed. Stable provider identity, fixed chunks and priority dedupe
avoid re-flashing a local note when its cached replacement arrives. Missing or
unavailable analysis never blocks local playback; audio-unavailable sessions
show explicit generic decorative timing. Detected silence stays dark.
The source/decorative distinction and existing target/DOM/animation diagnostics
are preserved. See [cache setup and protocol](../../docs/beat-event-cache.md)
for the optional server services, bounded contracts and validation limits.
