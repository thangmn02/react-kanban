# Beat Grid Phase 0: pipeline trace

Inspected baseline: `0a8bd80` (Kora 0.1.14 / Companion 0.3.13).
Scope: instrumentation only. Previous unfinished timing changes were archived
locally and removed before this phase. No detector, tempo algorithm, model,
threshold, playback-delay or CSS change is included.

## Complete production path

`E/` below means `extensions/kanban-music/`; `M/` means
`src/features/music/`; `N/` means `src/features/native/`.

| Stage | Exact owner/functions | Existing queues, clocks and gates |
| --- | --- | --- |
| Discovery/selection | `E/background.js: scan, handle`; `E/media.js: readMedia`; `E/media-observer.js: track, list`; `M/useBrowserMusic.ts: poll, updateSelection, updateClock` | Two-second discovery; DOM/detached media and Media Session metadata select a source. This is control, not captured sound. |
| Playback clock | `E/clock.js: receive, state.report, stopClock`; `E/media-observer.js: receive, state.report` | 100 ms samples plus media events; six-second lease; MAIN-world clock uses CustomEvents, then runtime messages to `createBeatSync.clock`. |
| Native PCM producer | `src-tauri/src/browser_process.rs: from_companion_port`; `browser_audio_windows.rs: ProcessCapture::new, packet`; `browser_audio.rs: native_audio_start, native_audio_renew, native_audio_stop` | Process-only Windows loopback; 10 ms polling; Tauri binary Channel; five-second lease; maximum 128 unacknowledged packets. Header: sequence, frames, 44.1 kHz, then stereo Float32 PCM. |
| Native feed/replay-for-analysis | `N/nativeMusic.ts: ensureFeed, requestNativeMusic`; `N/nativeAudio.ts: createNativeAudioFeed, begin, clock, decodeNativeAudio`; `E/native-audio-engine.js: start, push, renew, stop` | Sequence/fresh-clock validation; 500 ms acknowledgement; three-second retry; AudioBufferSources into a MediaStreamDestination, minimum 20 ms reserve / 300 ms backlog cap. This graph is muted and does not replay audible music. |
| Browser tab capture | `E/beat-sync.js: createBeatSync.capture, ensureOffscreen`; `E/offscreen.js: engine callbacks`; `E/capture-engine.js: createCaptureEngine.start, stop, renew` | `tabCapture` stream ID → getUserMedia → AudioContext/Analyser. Web output restored once. One 60 Hz interval, 2,048-point FFT with reused 1,024-bin spectrum, six-second lease. Native uses this same analyzer through the graph above. |
| Four-row producer | `E/beat-detector.js: BeatDetector.analyze` | Band energy, rising threshold, 700 ms adaptive mean, 400 ms warmup. A common 120 ms refractory value is stored **per band**, not one global last-hit timestamp; density raises the threshold. |
| Structural producer | `E/tempo-tracker.js: TempoTracker.analyze, estimate, snapToBeat, weaken`; `E/capture-engine.js: sampling callback` | Six-second envelope, estimates every 500 ms, eight-step clock generates kick/hat/clap labels. Real kicks nudge phase. Capture publishes locked grid ticks only below 20 drum hits / four seconds. |
| Optional fifth-row producer | `E/instrument-worklet.js: InstrumentCapture.process`; `E/instrument-runtime.js: createInstrumentWorker, prepareInstrumentCapture`; `E/instrument-worker.js: prepare, pump, self.onmessage`; `E/instrument-note-tracker.js: InstrumentNoteTracker.analyze` | Worklet transfers 2,048 stereo frames; runtime rejects over 96 pending messages. Existing model inference uses an eight-second ring, FFT 4,096, hop 1,024, 64-frame stride and 32-frame context. Tracker emits attack/envelope states. No new model is introduced. |
| Event scheduling | `E/capture-engine.js: enqueue, instrumentError, sampling/dequeue callback`; `E/native-instrument.js: createNativeInstrument, notes callback, clear` | Sorted capture queue capped at 2,048; target AudioContext time includes existing output/base latency and web AI delay. Events over 600 ms late drop. Web AI has a 3.5 s playback delay and 50 ms missed-deadline gate. Native AI uses its existing delayed visual offset, 500 ms reserve and at most 256 note timers. |
| Extension routing | `E/beat-sync.js: serialize, publish, offscreen, confirmCapture, cancelCapture, start, stopCurrent`; `E/offscreen.js: send` | Serialized control Promise queue; stream/audibility/owner checks; runtime messaging. Existing pause/mute/seek/stop, 2.5 s silence drain, and three/30-second retries remain. |
| Web bridge | `E/relay.js: runtime/message listeners, reply`; `M/mediaBridge.ts: requestBridge, subscribeBeatEvents` | `tabs.sendMessage` → content relay → window.postMessage. Relay limits four pending requests. App validates origin, subscription, payload and rows. Browser transport queues are not application-owned. |
| Native bridge | `E/widget-bridge.js: createWidgetBridge.connect, send, beat`; `src-tauri/src/browser_music.rs: BrowserMusic::start, request`; `N/nativeMusic.ts: ensureFeed, publish` | Loopback WebSocket 47635; nonce/origin/source checks, eight connections, 64 KiB frames, 64-message outbound channels; 600 ms stale-beat gate. Tauri `native-music-beat` → native feed → app subscribers. Companion clocks/control stay in use; native capture suppresses Companion beat fallback. |
| Controller | `M/useMusicBeatSync.ts: subscribeBeatEvents callback, renew, watchdog` | Per-row 120 ms gate, owner/sequence checks, latest counters/state in React; 700 ms melody lease, two-second sync renewal, 500 ms watchdog expiring after 3.5 s without live events. Batched same-row traces can coalesce before a state commit. |
| Renderer/decoration | `M/MusicPlayer.tsx: MusicGrid`; `M/BeatPattern.tsx: pulse, melodyGate, momentGate effects`; `M/beatVisuals.ts: activeSteps, pulseDelay, momentDelay, patternAt`; `src/components/focus/floatingFocus.css: square/shape/melody animations` | Existing zero-delay React timers; locked tempo replaces raw percussion counters. Seeded cell masks and pop/wave/splash/ripple timing; wave delays up to 280 ms. Random shapes begin after 35–45 s, hold about eight seconds and affect four rows. Melody attacks flash independently for 150 ms. |

`src-tauri/src/beat.rs` and `tempo.rs` contain compiled detector implementations
and tests, but no production call sites in the inspected native capture path.
The shipped native PCM path currently uses the JavaScript analyzer above.

## Failure points verified in source

- **Wrong row:** tempo subdivisions manufacture percussion identities; UI
  selects those counters while locked. Fixed frequency ranges overlap and do
  not establish instrument identity. Telemetry labels these sources separately.
- **Missing dense hits:** the same 120 ms value applies independently to every
  band at detection and again in the controller; density increases the detector
  threshold. This differs from the reported single shared debounce.
- **Delayed flashes:** native Web Audio buffering, web AI delay, native AI
  offset, event-queue polling and decorative CSS delays are separate stages.
  Existing AI inference/timeline mapping can drift relative to immediate audio.
- **Starvation:** low-energy timeout, capture/clock lease failure, native packet
  gaps/backlog, late queue events, AI backlog/deadline failure and transport
  rejection can remove events while other audio continues. Silent tab capture
  can wait 30 seconds to retry.
- **Post-delivery loss:** controller owner/sequence/debounce checks, React
  coalescing, tempo selection and visual masks can prevent a detected event from
  reaching a semantic flash. Existing shapes intentionally exclude row five;
  its independent note flashes do not follow the shape. These remain unchanged.

These are source-proven failure mechanisms, not measurements attributing a
particular user's recording to one of them.

## Instrumentation and evidence

The shared recorder is opt-in and bounded at 2,048 local records per realm.
Opaque event IDs accompany existing payloads through queues and bridges.
Producer/receiver/controller/DOM/CSS stages, dropped-event reasons, leases,
silence/recovery, queue depths and analysis/batch durations are observable.
Random shapes have separate IDs and a triggering parent. Instrument envelope
updates are lifecycle events rather than new note claims. No audio, spectra,
media URLs, titles or account information enters the recorder.

- Full Vitest suite: **576 tests / 81 files passed**. The integration test uses
  the actual BeatDetector, capture queue, BeatSync, page bridge, controller and
  renderer; only browser audio/transport plumbing is supplied by the test.
- Tests cover disabled callback compatibility, bounded buffers/queues, malformed
  sidecars, producer ID preservation, late drops, leases, recovery, packet gaps,
  coalescing and metadata-only updates leaving visual timers intact.
- In-app browser: one kick ID reached three real CSS animation starts with
  recorded decorative delays **0 / 80 / 240 ms**. This validates event correlation
  and CSS observations, not audible-to-display latency. Fixture hot reload logged
  duplicate-root warnings before the fresh-page check; production UI is unchanged.
- TypeScript and production build passed; Companion packaging includes all 33
  runtime files. Native binary tests: **12 passed**, including the opt-in PCM
  diagnostic-envelope contract. Lint: zero errors, 23 existing warnings. Build
  chunk/config warnings remain outside scope.

Limitations: no physical speaker/display timestamps or low-end hardware
benchmark; classic relay/browser-internal queues are bracketed by send/receive
observations, not independently buffered. Closed realms and evicted history
cannot be reconstructed. No live music account, recording or model download was
needed for this phase. No reliability/accuracy fix or later roadmap phase is
claimed.

See [diagnostic usage and clock semantics](../../extensions/kanban-music/README.md#beat-grid-telemetry).
