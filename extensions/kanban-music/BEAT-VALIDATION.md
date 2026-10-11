# Beat sync validation

## Version 0.3.13 / Kora 0.1.14 — automatic native capture

Windows captures only the browser process tree owning the accepted Companion
connection. Actual local PCM → binary Channel → existing detector analysis
produced 798 valid packets, zero rejected packets and 15 kick/bass attacks in
eight seconds. A separate process's tone was excluded. Same-browser overlap
remains an accepted limitation; the picker does not isolate tab audio.

Native AI uses the same hash-verified four-stem worker and dominant instrument
tracker with locally packaged code/WASM. Its flashes arrive after inference,
preserving note spacing; sound and percussion stay immediate. The previous
32 ms aligned buffered result below applies only to web/tab capture. Native
model readiness, bounded PCM blocks, late batch spacing and stale-note cleanup
have focused regressions. Full-song and installed-browser listening remain
acceptance checks.

## Version 0.3.12 — attack confirmation (2026-10-06)

Live-release verification exposed an intermittent extra piano flash: a faint
leading tail or subharmonic was counted before the full attack settled. The
tracker now confirms two consecutive pitch frames and refines a faint leading
attack's pitch without emitting another sequence. Comparable-strength fast
notes and repeated attacks remain independent. This adds about one 23 ms frame
of confirmation rather than changing the existing 3.5-second audio buffer.

The real-model onset check produced four attacks at all eight AudioWorklet
alignments, including both previously failing alignments. Run
`node scripts/verify-instrument-onsets.mjs` after `npm run music:package`.
Buffered playback again produced four flashes for four audible piano attacks,
with a worst browser audio/event difference of 31.93 ms. The three labeled
excerpts produced instrumental/mixed counts of 23/23, 19/14 and 21/23;
all nine vocal-only, drum-only and bass-only checks produced zero attacks.
The original 0.3.11 observations below are historical; model output can still
miss or add notes in arbitrary dense mixtures.

## Version 0.3.11 — local instrumental note attacks (2026-10-06)

Kora 0.1.12 removes hat, sustained-envelope and decorative-shape triggers from
the fifth row. Only incrementing `melody.state` sequences marked
`detector: instrument-v1` can flash it; old companion tonal states stay dark.
The first four rows retain their own detectors and tempo phase correction.

Opt-in source analysis uses four real Spleeter ONNX models (vocals, drums,
bass, other), pinned and SHA-256 verified by
[instrument-models.js](./instrument-models.js). Executable ONNX Runtime Web
and FFT code/WASM ship locally in the extension; only model data downloads.
The fully convolutional exports use 128-frame windows with unchanged weights
and operators. The protobuf adaptation was compared byte-for-byte with Python
ONNX serialization for all four models; real browser WASM inference produced
finite outputs with the expected dimensions. Measured combined inference was
about 479 ms per window on this machine, below the 1.486-second window stride.

The worker masks competing stems before selecting a dominant harmonic profile.
Context suppresses bass-tail leakage; a minimum energy threshold rejects
inaudible residue. Repeated pitches and changed pitches produce attacks;
decay, sustain and separation-state heartbeats do not restart a flash.
Multiple instruments can remain in the other stem, so this is not guaranteed
named-instrument isolation or exact transcription of a mixed song.

Original stereo audio and all five visual streams share a 3.5-second buffer.
The actual AudioWorklet/DelayNode check produced four events for four piano
attacks, including repeated pitches, with a worst measured difference of
31.93 ms from monitored output. This measures the browser audio graph; it
does not include WebSocket/UI delivery, physical speakers or Bluetooth delay.
Videos may be out of sync with the delayed sound. Pause, seek, rate change,
source switch and stop discard pending audio/events. A model deadline failure
clears instrument events and stops inference while preserving audio output
and the first four detectors; its existing delay lasts until capture restarts.

Actual model tests on three labeled MUSDB sample excerpts (6.80 seconds each):

| Excerpt | Instrument-only attacks | Mixed attacks | Vocal/drum/bass-only attacks |
| --- | ---: | ---: | ---: |
| Cristina Vane — So Easy | 22 | 29 | 0 / 0 / 0 |
| Mu — Too Bright | 19 | 23 | 0 / 0 / 0 |
| Clara Berry And Wooldog — Waltz For My Victims | 23 | 22 | 0 / 0 / 0 |

These are source-rejection checks, not ground-truth note counts. They establish
neither universal leakage rejection nor complete note accuracy on full songs.
Harmonic-profile retention, brief/repeated attacks, silence, legacy events,
cache corruption/download limits, timing, cancellation, failed/stalled models,
worklet sample continuity and web/native option routing have regressions.

Repeat with `pnpm run music:package`, then
`node scripts/verify-instrument-playback.mjs`. This launches an isolated local
browser on port 1431, downloads about 157 MB of verified model data if missing,
and closes its browser/server afterward. Models/results live under ignored
`scratch/instrument-proof`, or `KORA_TEST_MODEL_DIR`; no audio is uploaded.

For `node scripts/verify-instrument-stems.mjs`, use the authors'
[MUSDB sample archive](https://github.com/sigsep/sigsep-mus-db/releases/tag/v0.4.0),
respect its research-data terms, and prepare the three excerpts above in the
same scratch directory. `fixtures.json` is an array of `{ "index": 0,
"name": "test/Cristina Vane - So Easy.stem.mp4" }` entries. Decode each audio
stream with FFmpeg, e.g. `ffmpeg -i input.stem.mp4 -map 0:a:3 -ar 44100 -ac 2
-f f32le fixture-0-other.f32`; stream indices are mixture=0, drums=1, bass=2,
other=3, vocals=4. Audio fixtures and model binaries are not committed.

Privacy and licensing: see [INSTRUMENT-NOTICES.md](./INSTRUMENT-NOTICES.md) and
the packaged third-party licenses. Model setup explicitly discloses download,
delay and limitations before enabling it. Live service permission, first-time
options-page download and full-song listening on the user's installed browser
remain separate acceptance checks.

The older sections below describe their respective releases; their tonal,
hat-triggered and held-Melody behavior is superseded by 0.3.11.

## Version 0.3.10 — bounded kick phase correction (2026-10-05)

The locked sparse grid now feeds detected kicks into its anchor. Each accepted
kick applies 40% of the nearest eighth-note phase error, bounded by a 35% gate.
Phase-preserving BPM updates and the monotonic tick guard stay in place. Dense
drums still use direct onsets. No detector sensitivity defaults change, and no
octave tie-break change is included without evidence of a separate octave bug.

The shared native/web grid flashes Melody on envelope activation/new note
sequences, OR raw hat accents. Estimated hat ticks do not trigger it. Level
updates change intensity without restarting the flash. The 150 ms flash expires
independently of envelope updates; the existing 700 ms envelope lease, pause,
capture identities and reduced-motion behavior remain enforced.

Automated regressions cover four-kick convergence from accepted positive and
negative offsets, out-of-gate rejection, monotonic tick emission and ten minutes
of 90/128/150 BPM synthetic pulses with jitter and continuous estimator updates.
Real FFT fixtures prove kicks engage the feedback, while hats do not. Native
event tests verify the fifth-row flash and silence clearing. These are synthetic
and transport/rendering checks, not five-minute EDM/pop/lo-fi or ten-minute
playlist listening acceptance.

Boundaries: the gate does not distinguish every syncopated kick or correct large
initial offsets. Low confidence still releases tempo after four seconds; actual
silence releases capture after 2.5 seconds and retries on the existing schedule.
The two-line feedback fix does not remove those relock/restart boundaries or
establish jump-free recovery across a long silent break.

Measured ten-minute worst phase errors after warmup with feedback: 10.78 ms at
90 BPM, 11.37 ms at 128 BPM and 10.42 ms at 150 BPM. The 128 BPM control run
without feedback reached 116.30 ms; feedback made 1,280 corrections averaging
2.08 ms. These errors are relative to the synthetic detected kick times and do
not include audio capture or transport latency. All 523 tests across 71 files,
TypeScript, scoped lint and production/native builds passed. An isolated browser
rendered the actual component/CSS: peak Melody opacity 0.72, scale 1.12, no
motion under reduced motion, silence cleared, and zero page errors. The temporary
rendering fixture/server were removed. The signed Kora 0.1.10 installer verifies
with the existing key; altered bytes are rejected. Companion ZIPs contain 0.3.10.

## Version 0.3.9 — five rows and sustained Melody (2026-10-04)

Current tracks are Kick, Clap, Hi-hat, Bass and Melody. The former snare
band is labeled Clap (a frequency-band approximation, not source
separation). Older companion snare events normalize to Clap at the app.
The new Melody envelope measures tonal energy between 250 and 4000Hz,
requires 120ms of stability and releases after 240ms without tonal energy.
The capture silence check includes this range so held midrange notes do
not prematurely stop analysis when the percussion bands are quiet.

The envelope is sent at most every 100ms plus state transitions, with the
current capture/session identity. No audio samples leave the analyser.
The app holds the Melody row, or a stable whole-grid decorative shape
during a drumless phrase, with a subtle 2.4s breathing glow. Its lifetime
comes from the envelope, not simulated onsets. Silence/pause/lost capture
clears it; a missing envelope expires after 700ms. Reduced motion keeps
the illuminated state without breathing. Icons remain static.

Accent-triggered heart/wave/diamond/smile shapes now hold for 2.8s
(plus stagger) before fading. Raw onset and tempo-grid counters remain
separate. Dev-only opt-in debug includes the Melody activity/level/note
sequence alongside actual capture mode, onset counts and tempo confidence.

Synthetic harmonic spectra, noise, transients, frequency changes, sustained
tones, leases, stale capture identities and native transport regressions
are covered. This is automated validation, not new real-track tuning or a
claim of isolated melody detection. Live acceptance of the browser-only
native bridge and this new envelope remains pending the new installer.

## Chrome API recipe

- Chrome's [screen-capture guide](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture#record-audio-and-video-in-the-background) uses a service-worker stream ID, `USER_MEDIA`, and matching audio/video `chromeMediaSource: 'tab'` constraints. This extension uses that recipe and immediately stops video tracks. No MediaRecorder is created.
- [`USER_MEDIA`](https://developer.chrome.com/docs/extensions/reference/api/offscreen#type-Reason) is the reason for `getUserMedia()`. `DISPLAY_MEDIA` belongs to `getDisplayMedia()` and is not used here.
- [`tabCapture`](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) requires browser-granted access on the target tab. App messages alone cannot grant it. Version 0.3.1 always asks Chrome automatically rather than trusting an in-memory invocation flag. API denial is reported as `capture-permission`, with bounded retries and static squares. A toolbar click can grant permission and retry immediately. The original audio output must be restored through AudioContext.destination.
- The manifest keeps Chrome 120 as its minimum (service-worker-to-offscreen IDs require 116+). Hidden offscreen pages use a 60Hz timer rather than rAF, with a six-second capture lease.

## Version 0.3.3 site/capture policy

Historical policy below: version 0.3.5 permitted Spotify capture; version 0.3.6 supersedes all remaining host/media-keys capture blocks. Every explicitly supported service now attempts ordinary browser-authorized capture, subject to audible analyser proof. Nothing guarantees every track/browser is capturable or bypasses DRM. Chrome's tabCapture documentation describes consent and audible-output routing, but does not establish a universal protected-player silence rule.

The manifest, scanner and toolbar share an explicit list of music hosts for YouTube (including Music), SoundCloud, Spotify Web, Apple Music, Deezer and Tidal (including listen.tidal.com). The same HTML audio/video and Media Session reader runs on every supported tab. Discovery and the app bridge no longer discard sessions after 30. Each session has a truthful mode snapshot; sync.state events remain scoped to the selected session/subscription, with one capture at a time.

Spotify and Apple Music are conservatively clock-only (`drm-protected`), and an element with encrypted-media keys also disables capture. This is a product policy, not a verified claim that tabCapture necessarily produces silence for every protected track/browser. [Spotify's web player documentation](https://support.spotify.com/us/article/web-player-help/) confirms protected-content playback. Chrome's tabCapture reference does not promise a universal DRM/silence result. No DRM bypass is attempted.

An opened stream is no longer enough to publish capture mode: the offscreen analyser must first report an audible sample for the same capture ID. Silent streams fall back and release tracks after 2.5 seconds. The dock never animates clock-based squares or prompts for capture permission on policy-protected playback.

Automated mocks cover exact registration/permissions, generic encrypted media metadata and play/pause, srcObject identity, all 35 test sessions reaching the picker, protected-site clock mode even after invocation, audible-only confirmation, silence, per-session snapshots, and stale onsets during switching. Live tests on the newly added sites and paid/protected tracks remain unverified; no new real-browser compatibility claim is made.

Verification: 87 focused music/companion tests and all 331 unit tests passed. Scoped lint and production build passed, with existing Vite config/chunk-size warnings. The packaged ZIP contains v0.3.3 and 18 runtime files, including sites.js, without tests, credentials or development dependencies.

## Version 0.3.4 detached-player discovery

The user reported SoundCloud playing with no music panel in Floating Focus. The 0.3.3 reader only queried document audio/video elements, so an off-document `new Audio()` player was invisible before capture could even start. This gap is reproduced in regression tests; it is not yet confirmed as the only cause in the user's Brave tab.

A generic MAIN-world document-start observer now tracks Audio construction and HTMLMediaElement.play(), including detached elements. Weak references avoid retaining unused players; IDs survive DOM reordering. Discovery/control use the same registry, while source-guarded, six-second leased clock samples cross to the isolated content script as JSON CustomEvents. Native play promises, pause/resume, seek, ended/source replacement, repeated injection, and stale/malformed sample rejection are tested. This is not site-specific DOM code and does not add WebAudio-only player support. Permissions, DRM policy, actual-capture confirmation and onset-only squares are unchanged.

After updating, refresh the music tab once so observation starts before its player is created. Reloading the extension alone cannot recover a pre-existing detached object that the page never exposes. See [Audio constructor documentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement/Audio) and [Chrome content-script execution worlds/timing](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

Verification: all 336 unit tests (52 files), changed-file lint and production build passed. The rebuilt ZIP contains v0.3.4 and 19 runtime files, including media-observer.js. Live Chrome reproduction of the public SoundCloud track reached a sign-in prompt before playback; the user's Brave session was not connected for inspection. No live SoundCloud beat-sync success is claimed. Existing Vite config/chunk-size warnings remain unrelated.

Follow-up: the user initially confirmed 0.3.4 still omitted SoundCloud in the same Brave profile, while a paused YouTube player was discovered. This ruled out the app relay being wholly disconnected, but did not identify SoundCloud's playback mechanism. **Check music detection** now reports host/audibility, injection success, DOM/observer/ready/playing counts, and Media Session presence/state, without raw errors, URLs, titles or audio. The probe accepts only the extension's own setup page or existing allowlisted Kanban origins; the development app exposes the same safe report. Its regression/security tests pass; the package adds setup.js and discovery-diagnostics.js (21 runtime files). The diagnostic endpoint was unavailable in the installed Brave copy during this check, so that endpoint has automated rather than live acceptance evidence.

### Live Brave SoundCloud acceptance (2026-10-03)

After the user reloaded the companion, they confirmed the music panel worked. The agent inspected the actual SoundCloud player in the same Brave profile: it showed playback controls but zero document audio/video elements, confirming detached-player discovery is relevant. A temporary local page rendered the production useBrowserMusic, MusicPlayer and BeatPattern components against the real extension, with no mock audio or injected onset events.

- SoundCloud was selected while YouTube and Spotify were paused. On one unchanged capture ID, bass counts rose 46→107 and kick 29→63. Real onset samples activated the corresponding squares; no channel icons had the lit class.
- Pausing through the production music control reported playing=false, mode=clock, reason=not-playing and empty onsets, with zero animated squares.
- Resuming without another toolbar click recovered capture. A later sample reported bass 103, kick 77 and snare 7, with six onset squares and zero lit icons.
- Refreshing the production-component check page, again without a toolbar click, recovered a new capture ID. A sample reported bass 87, kick 65 and snare 6, with six onset squares and zero lit icons. The main Kanban page was also refreshed during the check.

An old paused toolbar preference no longer takes over first discovery when another session is playing. New toolbar invocations and deliberate picker changes retain their existing behavior. Paused sessions stay available in the picker rather than being mistaken for current playback.

The temporary browser check pages were removed after validation; automated tests and the dev-only production debug readout remain. All 342 unit tests (53 files), scoped music/extension lint and the production build passed. The packaged version remains 0.3.4 with 21 runtime files. Existing Vite configuration/chunk-size warnings are unchanged.

This is partial live acceptance, not a universal compatibility claim. No live hat onset was observed in these SoundCloud samples; thresholds were not retuned. Edge, mute/unmute, last-tab closure, prolonged denial, end-to-end latency/CPU and all other listed services still require separate live checks. Browser permission can still require a new toolbar click after extension reload or access revocation. The exact cause of the initial delayed recovery was not isolated.

## Version 0.3.5 Spotify investigation (2026-10-03)

The user authorized testing Spotify after the app showed a music panel but still squares. The previous host policy prevented any Spotify capture request, so that UI could not establish whether the browser actually withheld audio. Spotify now goes through the same getMediaStreamId/offscreen pipeline as other eligible sessions, even if its element exposes media keys. Host identity comes from the selected session, not an optional clock field. Apple Music and other encrypted players retain clock-only policy.

Stream creation alone never confirms capture: both stream confirmation and an audible analyser sample for the current capture ID are required. Silent streams stop after 2.5 seconds, publish mode=clock/reason=silent and back off 30 seconds rather than retrying every three seconds. Resume/unmute and a toolbar click can retry immediately. The app explains silent capture without claiming DRM caused it. No onset means no square animation; capture failures leave controls available.

Regression tests cover encrypted Spotify capture with source-less clocks, audible proof, sequenced band events, silence/backoff/resume, stale silent-capture onsets, denied requests and the production square/fallback UI. All 345 tests (53 files), scoped lint, production build and the regenerated 21-file v0.3.5 ZIP passed. No new permissions were added.

### Live Spotify evidence in Brave

After extension activation, Spotify played “Chemical” by Post Malone. The first actual attempt reported mode=clock/reason=capture-permission, not a silent stream. After the user clicked the companion on the playing Spotify tab, normal tab capture succeeded. Under capture ID 0299b9a7-e707-4dc4-bf0a-6e0c62e6cb38, all four counters climbed: kick 51→107, bass 60→147, snare 81→164 and hat 60→135. Computed styles showed square-onset animation and intermediate scale 1.03937 on drum/bass squares, while all four icons had animation=none and transform=none. These were real extension events in production components, not fabricated onset messages.

Pausing with the production music button reported playing=false, mode=clock/reason=not-playing and empty onsets. All 32 squares were gray (rgb(238, 240, 243)), had animation=none and scale 1. Controls remained available. Resume recovered capture with a new ID and kick/bass counts of 7/7; page refresh then recovered ID 77639674-cebd-4469-bd7d-ce50e9ee2638 with kick 28, bass 23 and snare 30, six onset squares and static icons. Neither resume nor page refresh needed a further toolbar click. The temporary verification page was removed after validation; the production debug readout remains.

This proves that a blanket “Spotify cannot be captured” rule was too restrictive for this specific track/browser setup. It does not establish universal Spotify/browser/DRM compatibility, analyser accuracy or playback output quality. No DRM was bypassed and nothing was recorded or uploaded.

The refreshed screenshot showed the next Spotify track, “Better” by Khalid, with the same recovered capture ID and the measured kick/bass/snare counts above. Track metadata changed while discovery and actual capture continued; this additional observation is not a systematic cross-track test.

## Version 0.3.6 common capture path (2026-10-03)

All seven requested services now use the same capture path: YouTube, YouTube Music, SoundCloud, Spotify Web, Apple Music, Deezer and Tidal. Neither hostname nor media keys preemptively disables capture. The allowlist remains explicit, with no new permissions or all-sites access. Capture mode still requires stream confirmation plus audible analyser proof. Actual denial, silence, mute and pause retain honest clock-mode reasons; clock mode never animates squares. Older companions returning the historical `drm-protected` policy show an update hint rather than an unsupported claim that capture is impossible.

Parameterized regressions cover capture attempts, audible confirmation, real sequenced onsets, silent-stream backoff, permission denial and square/fallback rendering on every listed service. All 367 tests (53 files), scoped lint and the production build passed. The first full-suite attempt completed its assertions but reported an unrelated undici WebSocket Event type collision in HomeDashboard; a complete rerun finished cleanly. The ZIP was regenerated as v0.3.6 with the existing runtime allowlist. Existing Vite configuration/chunk-size warnings remain unrelated.

### Live Apple Music and YouTube Music evidence in Brave

The actual extension and production music components were used, without mock audio or injected onset messages. Apple Music initially reported a genuine browser permission denial; after browser consent it reached capture on “Waiting For Love” by Avicii. An initial live sample contained all four counters: kick 163, bass 172, snare 209 and hat 148.

After switching away and resuming Apple Music, capture recovered without another toolbar click. On unchanged capture ID 7d19b199-d8b1-465e-b9f9-84ef503b0d58, kick rose 32→44, bass 31→46, snare 29→49 and hat 18→29. Computed styles showed `square-onset` on the corresponding squares, including intermediate scale 1.02895, while all four icons had animation=none and transform=none.

Pausing through the production music control reported playing=false, mode=clock, reason=not-playing and empty onsets. All 32 squares were gray (rgb(238, 240, 243)), unscaled and animation=none. Resume recovered capture ID 21e55147-946c-4356-b6aa-a34f726f4404 with kick 16, bass 16, snare 15 and hat 5. Refreshing the verification page recovered capture ID fd01194c-5ab2-45f7-aa02-db87fa98e40f with kick 24, bass 31, snare 33, hat 2 and ten onset squares. Neither resume nor page refresh required another toolbar click.

YouTube Music also reached actual capture on “Không biết phải nói gì không biết phải làm sao” by VƯƠNG BÌNH and Lâm Bảo Ngọc. On unchanged capture ID 6c83588b-454c-4c48-996a-55c7ae36923b, kick rose 61→77, bass 78→98 and snare 39→58; hat was 4 in the later sample. Squares had real onset animation, including snare scale 1.12 and drum/bass scale 1.06409. Icons remained completely static. The production picker switched between these services successfully.

The saved Apple Music screenshot subsequently showed the next track, “Talk To Myself” by Avicii, with the same recovered capture ID, all four counters and visible snare-square lighting. This is an additional metadata/capture-continuity observation, not a systematic cross-track test. Temporary verification pages were removed after testing; production dev debug and automated regressions remain.

Deezer and Tidal live testing is intentionally omitted at the user's request; their common-path automated coverage remains. This is measured compatibility for the observed tracks and Brave setup, not a universal account/track/browser guarantee or detector-accuracy claim. Browser consent may still be needed on a new tab or after extension access is revoked. No audio was recorded, uploaded or decrypted, and thresholds were not retuned.

## Detector baseline

### Version 0.3.7 tempo lock and glass layouts (2026-10-04)

The capture analyser maintains six seconds of combined positive band-energy flux. Every 500ms it autocorrelates candidate periods from 60–180 BPM. A lock requires correlation of at least 0.48, peak-strength confidence of at least 0.42, and a consistent candidate for one second. Four seconds of low confidence releases the lock; flat input reports zero confidence. An incompatible tempo releases the previous grid before reacquiring, and smoothing preserves the grid phase.

Sparse-transient music uses the estimated eighth-note grid while locked: kick on quarters, hat on eighths, snare on beats 2 and 4. Dense drum music retains direct onset lighting. Unlocked music stays in accent mode, with no generated ticks. Neither clock fallback nor paused playback generates square motion. The optional development readout (`?musicDebug=1`) reports lock, BPM, confidence, raw onset counters and estimated-grid counters separately.

Synthetic envelope and FFT-pipeline regressions cover regular sparse pulses, dense drums, irregular/free-tempo accents, flat-signal confidence loss, tempo changes, and mode transitions. These do not establish real-track beat accuracy: live tempo tuning on drumless tracks has not been performed.

All five detached dock layouts use the same glass treatment; the inline focus dock is unchanged. Browser layout checks used an explicitly labeled synthetic UI preview, including narrow-window Deck and desktop Split/Mixer/Tabs/Island. The temporary preview files were removed. These are layout checks, not live music acceptance evidence.

Verification: all 380 unit tests across 55 files passed, along with scoped music/dock lint and the production build. The rebuilt ZIP contains v0.3.7 and 22 runtime files, including tempo-tracker.js, without test or preview files. Existing Vite configuration/chunk-size warnings remain unrelated.

FFT size 2048; no AnalyserNode temporal smoothing. Bands: kick 45–150Hz, bass 60–250Hz, snare 1.5–5kHz, hat 6–12kHz. Mean linear power is compared with a 700ms adaptive baseline at a 1.6 ratio, a -70dB mean-power floor, a 15% rising edge, and a 120ms per-band debounce. The ratio rises when a band's two-second onset rate exceeds 3/s and decays naturally when activity slows. A 400ms warmup avoids treating the initial steady signal as a hit. Kick and bass deliberately overlap; this identifies band transients, not isolated instruments.

The default ratio/debounce/floor are constructor options in `beat-detector.js` for controlled tuning. Do not describe these defaults as tuned to a particular song without a live measurement.

## Automated coverage

Synthetic 44.1kHz/48kHz spectra cover onset bands, debounce, silence, and sustained tones. Capture tests cover constraints, video disposal, audio passthrough, permission failure, delayed capture cancellation, lease expiration, pause, mute, tab closure, session switching, and stale-document/subscription rejection. Tests also cover automatic attempts after app/worker restart, permission backoff/retry, confirmed-only sync.state, sequenced real onsets, stale-capture timeout despite continuing clock messages, duplicate/old event rejection, and no square motion in clock mode.

A local synthetic detector-only benchmark processed 3,600 frames in 25.05ms (about 0.007ms/frame). This excludes browser FFT cost, message delivery, and rendering; it is not an end-to-end CPU or latency measurement.

## Live track validation — partial

Requested reference: [Timeless remake/instrumental supplied by the user](https://www.youtube.com/watch?v=-_7VAs6gu0o).

Chrome is connected. Live checks confirmed music discovery and play/pause controls with the actual song clock. The user's captured test screen also confirms successful live capture on this track (playing, `mode: capture`, and onset counts kick 61 / snare 69 / bass 73 / hat 109). This validates that Chrome accepted the capture recipe and that all four bands reached the page; these counters alone do not establish detection accuracy, audible output quality, or latency. Systematic threshold tuning across track sections and the complete live lifecycle matrix remain unverified. No real-track tuning or end-to-end latency claim has been made.

The final visual specification keeps icons static at idle opacity. Each band's onsets restart a 150ms full-color, 1.12× pop on that row's active squares only. Regression tests cover independent/repeated/simultaneous band events and removal of motion on pause or capture loss. The island-bar dot is unchanged.

### Square idle-lighting fix (2026-10-02)

Pattern-selected squares no longer have a permanent tinted background. All 32 squares are gray between onsets; a real band onset briefly colors and scales that row's pattern-selected squares, then they return to gray. Pause or capture loss immediately cancels the pop. Without a session, MusicPlayer hides the entire panel. Icons stay at 0.35 opacity with no animation or transform.

Chrome computed-style checks confirmed gray/unscaled squares while paused and in the live clock/capture-permission fallback. A separately labeled synthetic UI fixture exercising the actual BeatPattern component and stylesheet measured independent band flashes reaching scale 1.12 and returning to gray; it is rendering evidence, not a live capture acceptance test. That check was initially blocked by clock mode with empty onsets. After invoking the companion on the music tab, the user confirmed that the real square animation works, including after reloading. Music regressions (20 tests), TypeScript, scoped lint, and production build passed. The temporary browser test pages and screenshots were removed after acceptance; automated regression tests and the dev-only in-player debug readout remain.

### Pre-change acceptance evidence (2026-10-02)

Before modifying the capture gate, the agent observed real capture on the user's selected “Lose My Mind” instrumental. All four counters increased (kick 32→69, snare 56→107, bass 29→65, hat 47→106). In a tight DOM sample, kick 69→70 and bass 65→66 coincided with those rows' active squares changing from no transform to scale(1.12), settling back over 150ms. There were zero clock-driven .hit squares during capture and all icons had animation: none. This was live extension traffic, not injected test events.

### Version 0.3.1 reload test

After the user reloaded v0.3.1 without clicking the YouTube action, the automatic attempt reached Chrome and returned mode: clock, reason: capture-permission, empty onsets. This demonstrates genuine API denial rather than an application click flag. Squares must remain static in this state. A fresh browser/tab session was present, so this does not isolate which browser action revoked the earlier grant. Click-free capture cannot be promised when Chrome has revoked access.

The user subsequently confirmed working square animations and reload recovery after granting capture access. This is user-reported acceptance, not a new agent-measured lifecycle trace. Remaining live matrix: muted/unmuted tab, second-session switching, tab close, and prolonged permission denial. Measure sampler CPU and end-to-end event delay before claiming a latency range. Capture errors must remove the listening line and leave squares static without a toast. The in-player Beat debug (dev) readout is retained only in development builds.

### Version 0.3.2 setup flow (2026-10-03)

The user's Brave screenshot showed a genuine `capture-permission` fallback; they confirmed capture worked after invoking the companion. Version 0.3.2 does not bypass this browser requirement. Its toolbar action can be used before Floating Focus opens: it remembers the music tab, opens/focuses an allowlisted Kanban app tab, and makes the next discovery select that song. A new click has a new selection token; regular polls do not overwrite subsequent manual selection. The permission fallback now shows a visible button to focus the selected music tab and instructions to click the pinned companion. Capture-busy and unknown request failures are distinguished from permission denial.

Automated tests cover trusted-origin reuse, opening the app, window focus, duplicate-click coalescing, worker restart, song selection, manual-selection preservation, permission-help visibility/recovery, and static fallback squares. These are API-mocked and DOM tests, not proof of the new toolbar flow in a live Brave session. Live v0.3.2 acceptance remains pending an extension reload and user check in Brave. No temporary browser validation page is added.

Verification: 59 focused music/extension tests and the complete 278-test suite passed. Scoped music/guide lint passed. The production build and regenerated 17-file v0.3.2 ZIP passed; existing Vite configuration/chunk-size warnings remain unrelated to this change.
