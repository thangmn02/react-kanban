# Four-row baseline recovery and verification

**Listening gate failed; Rows 1–4 are not frozen.** The user confirmed that
capture counters now increase, but reported off-beat activity and Kick flashes
in drum-free sections. No detector/model thresholds were changed during this
pass. Melody tuning and Phase 5 remain stopped. The failed PrimaryMelodyTracker
candidate and previous diagnostic artifacts are preserved.

## Separate renderer repair

Commit **`f7a2445`**, `fix(music): separate decorative fallback from instrument hits`,
contains only the renderer, its CSS and its targeted integration regression.
It removes degraded tempo's semantic-looking cell fan-out while preserving
explicitly decorative global border pulses and normal random shapes. The
commit excludes unrelated pending quality/model/server changes in this checkout.
The exact staged snapshot also passed its focused regression before commit.
The earlier [repair report](repair-261008-1003-decorative-render.md) preserves
the paired normal/semantic-only evidence. No publication occurred in this pass.

The temporary local `musicFourRows=1` mode keeps five rows × eight cells,
disables Melody and decoration, and renders only typed normalized semantic
events. Regression tests protect exact type-to-row mapping, inert Melody,
counter/capture readouts, recorder controls and absence of diagnostic controls
outside development/debug mode.

## Capture startup recovery

The persistent `clock · capture-stream · playing · degraded` status was a real
extension startup failure. The offscreen document called `chrome.storage`
before registering its runtime listener. Offscreen documents support only
`chrome.runtime` among extension APIs, as documented by
[Chrome](https://developer.chrome.com/docs/extensions/reference/api/offscreen).

A runtime-only test reproduced the startup exception. An actual isolated Edge
offscreen probe reproduced the missing receiver even after waiting for startup.
The repair removes offscreen storage access and carries diagnostic opt-in in
existing start/lease runtime messages through app, relay and worker. Existing
capture retry/lease recovery remains. Safe failure stage/code diagnostics now
distinguish receiver failure from stream denial without exposing error messages
or source identifiers.

After repair, the actual offscreen listener answers the intentionally invalid
stream probe with `stream-open / AbortError`, rather than a missing receiver.
This probe verifies startup and error delivery; it is not successful audio
capture. The user subsequently reloaded the project Companion and confirmed
increasing counters on real YouTube playback. The local Companion still reports
**0.3.14**; no packaged release/version bump was made.

## User's live trace

The supplied `kora-four-row-trace (1).json` was exported before the requested
30-second window ended (`complete:false`, zero overflow). It contains about
24.9 seconds of rendered events, spanning media time approximately
125.63–150.50 seconds.

| Row | Typed events |
|---|---:|
| Kick | 67 |
| Snare | 85 |
| Hat | 79 |
| Bass | 67 |
| Melody | 0 |

All **298 semantic commits** have source `local`, origin `local-detector`,
and correct type/row mapping. There are zero decorative commits and zero
wrong-row commits. The trace has 294 animation observations; export occurred
before the recording completed, so it is not a complete animation-delivery
assertion. The earlier supplied trace had no recorded interval or events and
could not establish capture behavior.

Pairwise timestamp coincidence within ±50 ms:

| Pair | Matched / first row | Matched / second row |
|---|---:|---:|
| Kick–Snare | 26/67 | 26/85 |
| Kick–Hat | 20/67 | 20/79 |
| Kick–Bass | 67/67 | 67/67 |
| Snare–Hat | 52/85 | 52/79 |
| Snare–Bass | 25/85 | 25/67 |
| Hat–Bass | 20/79 | 20/67 |

Kick and Bass have separate event IDs; they are not one generic rendered
pulse. Their nearest target timestamps differ by at most approximately 20.8 ms.
The unchanged local detector tests overlapping energy bands (Kick 45–150 Hz,
Bass 60–250 Hz) with generic rise/average conditions. It can classify the same
low-frequency instrumental attack as both types. This is a cause-aligned
explanation for the reported false Kick detections, not proof of instrumental
ground truth. Snare/Hat retain separate streams rather than total four-row
synchronization. No detector modification was made to address this quality gap.

The export records wall-clock render time and target media time, but no clock
sample at every commit. It therefore cannot certify absolute speaker alignment
or exclude all stale scheduling errors on its own. The exact drum-free section
and corresponding audio remain necessary to classify the reported off-beat
behavior. No visual fallback contamination is present in this semantic-only
trace. The capture/source status ID and engine-render ID belong to different
pipeline owners; their inequality alone is not evidence of stale delivery.

## Representative unchanged-detector replay

The current detector's normalized source hash matches commit `819a627`.
Ten supplied real WAV clips were analyzed with the same FFT frames and unchanged
default options against both versions. Every four-row timestamp list matches.
This establishes baseline equivalence, not detection accuracy.

The resulting timestamps were replayed through the actual scheduler/controller
and semantic renderer while an isolated Edge session, with the project Companion
loaded, played each clip for 30 seconds. The private API fixture explicitly
supplies the unchanged local-detector events through cache transport; trace
source `server-cache:event-track-cache` identifies that transport, not a new
server/model detection result or validation of provider tab capture.

| Clip | Kick | Snare | Hat | Bass |
|---|---:|---:|---:|---:|
| Nujabes | 70 | 90 | 100 | 73 |
| Hysteria | 95 | 55 | 63 | 91 |
| Yellow | 50 | 69 | 63 | 49 |
| Redbone | 62 | 54 | 48 | 69 |
| Take Five | 73 | 47 | 13 | 74 |
| Levels | 53 | 55 | 49 | 47 |
| Gymnopédie | 46 | 0 | 0 | 35 |
| H.S.K.T. | 72 | 84 | 85 | 77 |
| Vietnamese clip | 57 | 64 | 47 | 77 |
| Ambient clip | 29 | 0 | 0 | 29 |

Every expected timestamp rendered: zero missing events, wrong-row commits,
decoration, Melody events, overflow or page errors. Per-clip median DOM offset
against real `audio.currentTime` was approximately 5–7 ms, p95 approximately
11–16 ms, worst observed offset 21.154 ms. This is media-clock rendering evidence,
not measured physical speaker latency. Ambient's initial Companion discovery
timed out; its isolated retry passed. Sparse piano's Kick activity and sparse
jazz Hat activity remain quality concerns, not reasons to tune within this pass.

Private local artifacts (ignored build output; no audio or personal raw trace
committed):

- [Detector comparison](../../src-tauri/target/semantic-row-check/four-row-baseline/detector-regression.json)
- [Render summary and pairwise coincidence](../../src-tauri/target/semantic-row-check/four-row-baseline/render-summary.json)
- [Independent timestamps and per-event provenance](../../src-tauri/target/semantic-row-check/four-row-baseline/row-timestamps.json)
- [Listening comparison](../../src-tauri/target/semantic-row-check/four-row-baseline/listen.html)
- [Actual offscreen startup probe](../../src-tauri/target/semantic-row-check/four-row-baseline/capture-error-probe.json)

## Checks and remaining gate

The full Vitest suite passes: **98 files / 721 tests**. TypeScript, scoped lint
and production Vite build pass. Existing extensionless-import and large-chunk
build warnings remain. The earlier renderer pass also passed all 21 existing
Edge UI regressions. Automated browser checks used owned isolated profiles;
direct inspection of the user's Edge remains unavailable because the browser
runtime import fails with EPERM. No personal browser-profile bypass was used.

The existing preview is intentionally retained for the user's checks on port
5173, PID 3132, project root. No duplicate dev server or test browser is left
running. The startup/capture diagnostics are local uncommitted changes; the
renderer repair has the separate commit above.

Rows 1–4 **must not be declared perceptually accepted or FROZEN** on these
counts alone. The user's listening feedback explicitly rejects them. Continue
only the provenance investigation when a precise audio section is available;
do not resume Melody tuning or Phase 5. Detector quality changes require a new
accepted scope beyond this threshold-preserving baseline verification pass.
