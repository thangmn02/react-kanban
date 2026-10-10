# Live Clap delivery and Lead status

Follow-up: Playwright now connects to the installed test Companion. A normal-renderer animation cancellation bug was demonstrated and repaired. See [the follow-up report](repair-261009-0856-independent-percussion-flashes.md) for current evidence, passing validation and remaining limits. The investigation below records the earlier state.

The live failure remains unresolved. The user's enabled folder is `src-tauri/target/percussion-latency/candidate`, containing the preserved original ADTOF model. An earlier suggestion that the user was running the rejected causal model was incorrect; that model belongs to a different private bundle. Keep the currently identified Companion.

The exact local Bích Phương recording was replayed from 60–90 seconds using the user's bundle in an isolated Edge profile. Real HTML media capture, AudioWorklet features, learned inference and the existing controller/scheduler/semantic renderer produced:

| Row | Raw events | Semantic DOM commits |
|---|---:|---:|
| Kick | 86 | 86 |
| Snare / Clap | 47 | 47 |
| Hat | 52 | 52 |

There were no browser errors, bridge replay drops or inference backlog. Animation delay was 246 ms median and 278 ms p95. These are event-to-animation measurements, not physical speaker/display latency or musical accuracy scores. The probe replays bridge payloads and does not certify the user's installed extension transport or YouTube session.

A second identical-audio run with four tab switches delivered 47 Snare events again. Headless `document.hidden` stayed false, so this does not establish correct recovery from actual hidden-tab throttling. Its animation delay was 247 ms median and 274 ms p95 for observed animations; 191 DOM commits produced only 117 observed animation starts, illustrating why DOM delivery alone cannot certify visible background animations.

The user confirmed the live Snare counter stays at 0–1 during 60–90 seconds. The difference between raw classification, installed transport, scheduling and rendering therefore needs the live trace. No threshold, model, merger, scheduler, renderer or Bass changes were made speculatively.

The existing normal `/beat-grid?musicDebug=1&view=app` UI now exposes live counters and the existing recording/export controls. `kora-live-grid-trace.json` includes bounded Phase 0 telemetry, semantic/decorative row records, capture/playback state and focus/visibility timestamps. Recording clears the diagnostic buffer; it does not clear playback events or counters. Debug telemetry is enabled when the development route requests it. Four-row recording and its export name remain compatible. Production pages receive no new diagnostic controls.

Row 5's Lead policy is off by default. This local capture bundle generates percussion/Bass, not precomputed Lead events. `musicLead=1` selects the new cache version but cannot supply an absent analyzed EventTrack. Debug status now distinguishes disabled Lead from enabled-but-waiting Lead. Saved comparisons remain available through “Use saved Melody demo”; fixture events are never injected into unrelated YouTube playback.

Validation: both new diagnostics tests failed before implementation and passed afterward. All 111 test files / 788 tests passed, including 92 focused playback/routing tests. Type checking and scoped lint passed. Original ADTOF SHA256 remains `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`; Lead policy SHA256 remains `a9e78c0256fd54367a3377b115ae0f0274701db98f3c18fb15d9b101ad6de07b`.

Private evidence is in `src-tauri/target/live-grid-delivery/browser-before.json` and `browser-tab-switch.json`. Both owned browser probes closed. The existing port-5173 server remains PID 1924 for listening. No deployment, model training, database change or Phase 5 work occurred.

Remaining questions: which stage drops or omits live Claps, and whether returning from an actually hidden tab introduces additional lag. Refresh the normal debug page, click “Record 30 seconds” while playing 1:00–1:30, switch to YouTube and back once, and export the live row trace. Browser control could not connect because its runtime import failed with `EPERM`; the user's live tab was not inspected.
