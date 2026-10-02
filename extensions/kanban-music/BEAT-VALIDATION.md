# Beat sync validation

## Chrome API recipe

- Chrome's [screen-capture guide](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture#record-audio-and-video-in-the-background) uses a service-worker stream ID, `USER_MEDIA`, and matching audio/video `chromeMediaSource: 'tab'` constraints. This extension uses that recipe and immediately stops video tracks. No MediaRecorder is created.
- [`USER_MEDIA`](https://developer.chrome.com/docs/extensions/reference/api/offscreen#type-Reason) is the reason for `getUserMedia()`. `DISPLAY_MEDIA` belongs to `getDisplayMedia()` and is not used here.
- [`tabCapture`](https://developer.chrome.com/docs/extensions/reference/api/tabCapture) requires browser-granted access on the target tab. App messages alone cannot grant it. Version 0.3.1 always asks Chrome automatically rather than trusting an in-memory invocation flag. API denial is reported as `capture-permission`, with bounded retries and static squares. A toolbar click can grant permission and retry immediately. The original audio output must be restored through AudioContext.destination.
- The manifest keeps Chrome 120 as its minimum (service-worker-to-offscreen IDs require 116+). Hidden offscreen pages use a 60Hz timer rather than rAF, with a six-second capture lease.

## Detector baseline

FFT size 2048; no AnalyserNode temporal smoothing. Bands: kick 45–150Hz, bass 60–250Hz, snare 1.5–5kHz, hat 6–12kHz. Mean linear power is compared with a 700ms adaptive baseline at a 1.6 ratio, a -70dB mean-power floor, a 15% rising edge, and a 90ms per-band debounce. A 400ms warmup avoids treating the initial steady signal as a hit. Kick and bass deliberately overlap; this identifies band transients, not isolated instruments.

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
