# Kora Music Companion

This is an independent implementation, not a copy of ungive/media-control-extension.

Our own Manifest V3 extension connects browser music to Kora's Floating Focus. No extension ID, music login, or API key is required. The inline focus dock stays unchanged; music lives in the detached window.

Version 0.3.14 connects directly to the running **Kora Windows widget**
through loopback `127.0.0.1:47635`. No Kora web tab is needed in that mode.
The widget receives only allowlisted browser music metadata and visual
events. Kora 0.1.15 automatically captures that browser's process audio on
Windows, without repeat extension clicks. Overlapping audio in the same browser
can affect beats; the picker does not isolate tab audio. Other desktop apps are
excluded. Web/PiP tab capture can still require a toolbar permission click. See
[native setup and security](../../src-tauri/README.md).

The normal grid has four rows of eight cells: Kick, Snare/Clap, Hi-hat/Cymbal,
and Bass/Low pulse. Private diagnostics retain Melody/Main Lead. Melody flashes on timestamped attacks from one dominant lead in a
validated EventTrack cache. Sustained envelopes, raw hats and decorative shapes
do not create Melody attacks. Without cached lead events, the fifth row stays
dark while local analysis continues. Brief note flashes and
the 700 ms state expiry remain.

The local percussion runtime requires a scored ADTOF decision
before local Kick/Snare/Hat events are published. Spectral-flux DSP remains an
acoustic proposal/envelope source; Bass retains its existing detector. Missing
model assets, incompatible audio context or inference failure leave the three
drum rows dark rather than returning to band-energy classification. Playback,
audibility and capture leases continue independently. Companion 0.3.22 bounds
the entire model/worklet startup to ten seconds and checks pending inference
progress with a two-second watchdog. Failed inference is replaced within the
same capture with retries backing off from one second to at most thirty seconds.
Empty model results count as progress; quiet music does not cause restarts.
Retired runtimes cannot emit notes into a replacement.

The existing model uses a trailing one-second spectro-temporal window with 100 ms
right context. It publishes original audio timestamps, uncalibrated model
activations and peak decision margins; playback remains undelayed. Visual
delivery therefore has bounded processing lag, observable in telemetry. The
bidirectional source model is not an inherently causal/zero-latency model.
See the [current validation](./BEAT-VALIDATION.md) for controls, measurement
boundaries and remaining listening checks. The model's bundled notice remains
unchanged.

The legacy Spleeter feature, its model download, separation workers/WASM, setup
controls and delayed-audio path have been retired. Current local percussion
uses its existing ADTOF model and ONNX worker. Captured original audio routes directly to output. Previously
downloaded browser model data is left inert; this change does not delete data
from user profiles. See [cache setup and protocol](../../docs/beat-event-cache.md)
for precomputed data and honest cache-miss fallback.

For sparse captured drums, real kick hits gently correct the locked grid phase
with a 0.4 gain, accepting errors within 0.35 of an eighth note. Dense drums
retain direct onset lighting. The gate rejects distant accents; it cannot
identify every syncopation or repair an arbitrary initial phase offset. Long
quiet sections keep leased analysis alive while playback remains active; audio
return resumes detection without a silence-triggered stop. Low tempo confidence
still releases the lock after four seconds, independently of capture recovery.

## Test now in Chrome, Edge, or Brave (desktop)

1. Build the distributable with `npm run music:package` (also runs before dev/build).
2. In Floating Focus, choose **Add music controls**. It opens an English/Vietnamese guide at `/music-companion.html`, with a downloadable ZIP and browser-specific instructions.
3. Download and extract `public/downloads/kanban-music-companion.zip`. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.
4. Reload the Kora tab once. Open **Floating Focus** from the existing focus dock. The extension is detected automatically.
5. Pin **Kora Music Companion** once in the browser's puzzle-piece Extensions menu. Play a track on YouTube, YouTube Music, SoundCloud, Spotify Web, Apple Music, Deezer, or Tidal in this same browser/profile. The dock discovers all detected sessions and follows another tab when its playback starts, on the next discovery poll (normally within two seconds). Its picker also lets you choose a source manually. For capture-eligible music, click the pinned companion on the music tab if the browser requires access. It opens/focuses Kora and selects that song automatically. Open Floating Focus from the timer.

Developers can instead load this `extensions/kanban-music` folder after generating the icons. Keep an unpacked extension's folder; deleting it breaks the installation.

The app must be at an allowlisted deployed origin, or localhost / 127.0.0.1 on port 5173, 5174 or 1420. Companion 0.3.14 does not allow port 1420; reloading that version cannot connect to the current private development app. Update its files to the current package and refresh both tabs. Production requires deploying the updated web app as well; loading the extension does not update Netlify.

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
- The player uses real media position, seeking, previous/next and volume capabilities where the source permits them. Unsupported controls are disabled. There is no automatic extension installation; browser consent is required.
- Browser autoplay rules still apply. If resume is blocked, play once in the source tab. Incognito and separate browser profiles are not shared.
- The island-bar dot keeps its decorative double-thump heartbeat. Pausing hides the dot and keeps the panel; no session means no music panel or dot. Reduced-motion preferences disable the heartbeat and scaling.
- **Fallback:** `mode: clock` retains playback metadata and controls, but squares stay completely still. There is no timer or clock-driven beat animation. Icons always stay dim and static.
- **Live beat sync:** playing sessions automatically request browser capture. Actual detected onsets drive semantic rows. Tempo subdivisions carry timing/phase only and may retrigger an existing decorative shape; they never claim kick/snare/hat detections. Capture requires an audible analyser sample; quiet input keeps leased analysis running without claiming audibility or generating onsets. Capture expiration and interruption recover while playback remains active. Browser denial retains bounded retry and visible permission guidance.
- **Browser permission:** automatic attempts do not grant permission. Chrome, Edge or Brave may require clicking **Kora Music Companion** on the music tab, especially after extension reload/revocation or on a new tab. A click retries immediately, including when done before Floating Focus opens. The app shows a visible **Open music tab** button and instructions on permission denial. Transient failures are not mislabeled as permission denial. Do not promise click-free capture when the browser revokes access.
- **Developer ground truth:** **Beat debug (dev)** shows the selected session's actual mode/reason, capture ID, kick/snare/bass/hat counters, and per-session mode snapshots from discovery. Each `sync.state` event is tagged with the selected session/subscription. Only one session is captured; others honestly report clock mode (`not-selected`, `not-playing`, or `muted`). Actual failures report `silent`, `capture-permission` or the relevant failure code, not guessed DRM. Older companions reporting `drm-protected` show an update hint. Duplicate/stale onsets cannot add extra pops. Missing state/onset traffic expires capture mode even when clock updates keep arriving.
- Capture uses `tabCapture`, `activeTab`, and an offscreen `USER_MEDIA` document. The documented audio-plus-video constraints use the same stream ID; video tracks are stopped immediately. Captured original audio is routed back to the speakers once because Chrome suppresses the original output during capture. No model buffer delays playback. Nothing is recorded or uploaded.
- Pause, ended playback, mute, session replacement, tab closure, navigation, and closing Floating Focus release capture. A six-second lease releases tracks if the app disappears without cleanup. The offscreen sampler runs at 60Hz with one reused FFT buffer; background documents do not reliably receive animation frames.
- To remove access, disable/remove the extension in the browser's extension manager.

Document Picture-in-Picture must be supported by the browser. The browser-owned title bar and window frame cannot be made transparent by the webpage.

## Updating an existing installation

Desktop 0.1.30 / Companion 0.3.23 adds **Install or update Companion** as a real
file update. The signed Desktop payload is verified and placed in the stable
app-data folder, preserving older installations at that path. Connected updated
Companions check their own disk version, acknowledge, reload and reconnect;
Kora confirms the loaded version before reporting ready. Old extensions need
one manual reload, and disconnected/differently located copies show manual
instructions. This uses the existing loopback bridge only; public Web messages
cannot reload the extension. The browser's first Load unpacked consent remains.

The current release packages the matching percussion model, configuration,
worklet, worker, ONNX runtime and model notice in both public Companion archives
and the Desktop resource folder. The packaging inventory in
`scripts/package-music-extension.mjs` is authoritative. Without a usable learned
runtime, acoustic proposals cannot label Kick/Snare/Hat, while Bass remains available.

An equipped Companion advertises `learnedPercussion` per discovered session.
Desktop then uses that same browser capture/inference transport as Web, instead
of overriding its typed events with a native PCM detector lacking those weights.
Only one capture owner is selected. Browser capture may require a toolbar click;
unequipped/older Companions retain the existing native PCM path. This is delivery
compatibility, not a change to the learned model or Bass detector.

Replace the unpacked folder with the ZIP matching the published Kora build,
click **Reload** on its extension card, and refresh Kora and the music tab once.
Keep the extracted folder and install separately in each browser/profile.
Reload rereads local files; it does not download an update. Native installations
can update the installed Companion resource folder without a repository checkout;
see the [installation guide](../../src-tauri/README.md#development-and-distribution).
Browser tab capture can still require a toolbar click after permission loss.
Native Windows process capture remains automatic. Pause, seek, rate change and
source switching discard stale scheduled events; quiet input retains analysis.

Source handoffs reuse the empty offscreen document after releasing the old
stream, graph and worker. Final stop closes the document. Clock-stop commands
carry the retired watcher token, so delayed cleanup cannot stop a new song.
Every accepted drum attack also receives an immediately bright semantic flash,
including the first Wave/Ripple attack; decorative shapes and Bass holds remain.
Scored drum events dispatch without waiting for the next FFT sampling tick.

For local production-runtime verification, prepare stereo Float32 PCM at
44.1 kHz as `scratch/instrument-proof/fixture-0-{drums,mixture,vocals}.f32`, then
run `node scripts/verify-beat-runtime.mjs`. It builds an isolated production
fixture and runs a muted Edge browser on port 1431, closing its browser/server
afterward. Set `KORA_TEST_BROWSER=chrome` to use installed Chrome, or
`KORA_BEAT_PROOF_SECONDS=1800` for one thirty-minute drum-input run. This is
real model/worklet/renderer execution, not live-service or human-scored accuracy.

See [BEAT-VALIDATION.md](./BEAT-VALIDATION.md) for API evidence, detector settings, and the live validation status.

For local event-path diagnostics, see [Beat Grid telemetry](#beat-grid-telemetry).
Tracing is opt-in, bounded and does not change detection or visual timing.

If a playing site is missing, open this companion's **Details → Extension options** and press **Check music detection**, or use **Music detection (dev)** in the development app. The read-only report distinguishes missing host access/injection failure, DOM/detached media counts, and Media Session-only playback. It reports website names and safe counts/state flags, not track titles, source URLs, account details or audio. The diagnostic command accepts only this extension's own setup page or the existing allowlisted Kora origins. A paused YouTube session can be a previously loaded player and is not proof of playing music. On first discovery, an old paused toolbar selection does not override a playing session; new toolbar clicks and manual picker choices still select that session.

Live Brave validation on 2026-10-03 confirmed SoundCloud discovery, play/pause, real capture onset counters and square pops, and capture recovery after resume and page refresh without another toolbar click. This does not guarantee permission survives extension reloads, nor establish compatibility with every SoundCloud player or with Edge. See the validation report for remaining checks.

Version 0.3.5 also confirmed real Spotify capture in Brave on “Chemical” by Post Malone after browser consent: all four counters climbed, squares animated, icons stayed static, pause cleared motion, and resume/page refresh recovered capture without another click. Other tracks and browsers can still deny or silence capture; the live result does not guarantee universal Spotify support.

Version 0.3.6 additionally confirmed real Apple Music capture on “Waiting For Love” by Avicii and YouTube Music capture in Brave. Live onset counts increased, squares popped and icons stayed static. Apple Music pause cleared all square lighting; resume and app refresh recovered capture without another toolbar click after consent. Deezer and Tidal live testing was skipped at the user's request; shared-path regression coverage remains. These observed results do not guarantee every service/track/browser allows capture.

## Beat Grid telemetry

The established opt-in diagnostics remain across detection, scheduling,
transport, controller, DOM commit and animation. Historical instrument-worker
records remain readable, but retired workers no longer produce them.

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

Pause and resume after enabling. Native capture receives
the diagnostic setting when they start. Background/offscreen storage changes
alone do not restart capture or affect playback.

Reproduce the problem, then collect each relevant realm while it is alive:

```js
const trace = __koraBeatTelemetry.snapshot();
console.table(trace.records);
console.log(trace.counts, trace.evicted);
```

The app, Companion background and offscreen document have
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
timestamps from different domains. Historical native instrument-worker records
describe the retired delayed timeline, not the current playback path.

`EVENT_STATE_COMMITTED` observes controller state. `EVENT_COMMITTED` observes
the renderer's DOM commit. `EVENT_RENDERED` observes CSS animation start, which
includes the existing CSS delay; reduced-motion mode records the static DOM
commit instead. It is not a physical display or speaker-output timestamp.
Several cells can report the same event ID with different animation delays.

Native PCM retains its 16-byte binary header. Sequence/frame counters correlate
the native channel and Web Audio buffering; no hardware capture timestamp is
introduced. `queueDepth` is local to each component: event count in capture,
pending messages in the runtime, buffered native samples,
scheduled sources in the native engine, and unacknowledged packets in Rust.
`durationMs` measures analyzer/tempo work only when
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
their tempo retriggers and decorative CSS delays remain.

Late transport events (over 600 ms, up to 2 seconds old) are logged and coalesced
to the latest event per kind before UI delivery. Older events expire and request
subscription renewal, at most once per second. Pending work is checked again
when the UI resumes; newer delivery supersedes older work. The stale-capture
watchdog retains honest clock fallback and requests renewal. This bounded
recovery does not promise correct rhythmic timing during a blocked UI.

The analyzer's playback queue still drops events more than 600 ms past their
audio deadline and continues with fresh detector events. At capacity it evicts
the oldest enqueued work rather than rejecting new work. Missed events expire
without permanently disabling subsequent analysis.
`EVENT_LATE` and `EVENT_DROPPED` retain provenance; `CAPTURE_RECOVERED` records
returning audio or resumed delivery after a miss. `delivery-coalesced` and
`delivery-late` identify transport recovery. No replacement semantic events are
fabricated.

See the [recovery report](../../plans/reports/diagnosis-261006-1659-beat-recovery.md)
for tests and browser-validation limits.

### Private live timing investigation

The existing seven provider integrations remain the discovery/control path.
Provider discovery is separate from successful browser capture and from the
private semantic-preview policy. In particular, ordinary capture compatibility
does not override private Spotify/protected-source restrictions. The owned-local
H0 Beta does not change a provider session into a CNN live source.

The private grid displays whether instrument preview is on or needs enabling
for the selected source. Pause, seek and source changes revoke that preview;
enable it again under **Music → Private candidate → Live preview**. Protected
and provider-policy blocks take priority over reconnect/calibration advice.
Metadata and playback controls can still work while analysis is unavailable.

Opt-in telemetry enabled before capture now records numeric feature availability,
worker receipt/inference boundaries and peak finalization as `DETECTOR_TIMING`
and `WORKER_BATCH` records. It does not enable raw scores/features/PCM. Timing
fields are locally bounded and do not alter weights, feature values, thresholds,
accepted peaks, source timestamps or the existing scheduler. Reacquire capture
after enabling timing if the worker was already running without diagnostics.

`scripts/measure-hybrid-browser-latency.mjs` reuses the actual app and private
Companion with the existing authorized CC0 source. Separate `--output` folders
preserve repeated trials; `--live-ms` bounds sample length. `--full-session`
collects five-second health/telemetry snapshots to natural EOF and assesses
capture continuity separately from source playback. Background/full-session
qualification together is rejected. `scripts/summarize-beat-delivery.mjs`
separates Bass deadlines from learned percussion delay, and preserves missing
measurements instead of treating them as zero. These tools do not measure
physical speaker-to-pixel timing or acoustic recognition accuracy.

See the [provider live report](../../plans/reports/engineering-261019-0549-provider-live-upgrade.md)
for current observed support, repeated measurements and remaining gates.

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
native capture buffering estimate retained. Future capture timestamps
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
five-row/eight-cell renderer retains intentional random masks and decorative
delays. Actual onsets guarantee one immediate selected-cell flash, including
during held shapes; decorative effects retain their own provenance. Scheduler
release, DOM commit and animation start remain separate
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
