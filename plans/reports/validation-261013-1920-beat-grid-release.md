# Beat Grid recovery and switching release

Date: 2026-10-13, Asia/Saigon. Versions: Desktop/Web 0.1.29, Companion 0.3.22.
Status: release verified on draft deployment; production publication in progress.

The user approved the implementation plan and explicitly authorized publication
for their own listening test. Installed-browser listening is still a separate
acceptance check. This report does not claim human-scored note accuracy or
universal resolution of the user's lag without their reproduction.

## Repairs

- Bound the entire percussion initialization to ten seconds, including config
  fetch/JSON, worker startup and worklet loading. Cancellation prevents late
  completion from allocating or connecting an obsolete node.
- Detect pending inference that makes no progress for two seconds. Empty results
  count as progress; silence and suspended/absent input do not look like failure.
- Replace failed percussion within the current capture, leaving original audio
  and Bass analysis running. Retry delays increase from one second to at most
  thirty seconds. Old callbacks and pending drum events cannot enter the new
  runtime. No frequency-band drum fallback or new model was introduced.
- Dispatch accepted learned drum events immediately once capture is audible,
  without waiting for another FFT tick. Telemetry opt-in does not affect delivery.
- Give every accepted drum attack an immediately bright semantic overlay,
  including the first Wave/Ripple attack. Keep four rows, Bass holds, masks,
  decorative effects, note timestamps, model weights and thresholds unchanged.
- Release old streams/graphs/workers during handoff while reusing the empty
  offscreen document. Final stop closes the document. Bound unresponsive stop
  and lease requests so a serialized handoff cannot wait indefinitely.
- Start a replacement before sending the retired subscription's final stop.
  Pagehide still stops immediately. Clock stops carry a token, so a delayed old
  stop cannot stop the replacement song's watcher.
- Emit a real worklet URL and its feature-module dependency in production.
  Preserve the ONNX loader and explicitly emit its exact MJS/WASM dependencies.
  Allow that existing WASM execution in Desktop CSP.

## Evidence

The pre-change production build emitted a 53.48 kB bundled percussion worker
and did not emit the worklet or ONNX glue/WASM assets. The corrected build
emits the worklet, worker, configuration, model, ONNX loader, MJS, WASM and
`assets/percussion-features.js`. A real production fixture executed these files
under a CSP matching the relevant Desktop/Companion restrictions.

Eight-second local stereo PCM runs in isolated Edge produced:

| Input | Kick / Clap / Hat events | Completed batches | Maximum waiting blocks | Visible-flash p95 |
| --- | --- | ---: | ---: | ---: |
| Drum stem | 14 / 12 / 0 | 159 | 0 | 248.87 ms |
| Mixture | 14 / 7 / 2 | 159 | 0 | 250.61 ms |
| Vocal stem | 0 / 0 / 0 | 159 | 0 | No attacks |

No worker or page error occurred. These counts are predictions, not reference
labels or precision/recall. The mixed-input p95 slightly exceeds the plan's
proposed 250 ms target; zero latency is not claimed. Measurements compare the
browser audio clock with DOM brightness, excluding physical speakers/display,
real service capture/transport and the user's browser load.

The 30-minute uninterrupted real-audio run completed 35,993 batches and emitted
3,174 Kick / 3,007 Clap / 0 Hat predictions, with no failures or waiting blocks.
For the bounded last 2,000 attack samples, visible-flash median/p95/maximum was
221.66 / 250.39 / 311.50 ms. Mean animation rate was 119.98 fps; the largest
frame interval was 188.80 ms. This used one real AudioContext, ONNX worker and
normal renderer. It did not exercise live service capture or source handoffs.
The final startup/clock review repairs were made during that run; a fresh final
production fixture then passed all three eight-second inputs with the same
counts, no failures or page errors, zero waiting blocks, and visible-flash p95
238.10 / 238.07 ms for drums/mixture. Run-to-run timing variation remains visible.

Automated regressions cover missing assets/frontend, stalled fetch/worklet,
post-ready failure, hung inference, empty progressing results, retry backoff,
stale callbacks, immediate dispatch with diagnostics disabled, thirty source
handoffs, unresponsive stop, delayed clock stop, pagehide and hidden-pane demand.
The code review's two actionable races were repaired and re-reviewed; no
remaining actionable issue was found. All 822 JavaScript tests across 108 files,
14 native Rust tests and the Beat Grid browser integration test passed. All 82
focused runtime/clock/capture/handoff tests passed. Typecheck and the production
build passed. Full lint reported no errors and 25 existing React-hook warnings;
the changed runtime passed scoped lint. The main entry is 702.7 KiB against a
976.6 KiB budget. Existing Vite chunk/config-loader warnings remain visible.

## Build and publication

Connected production `VITE_*` values come from the existing authenticated Netlify
site configuration, kept in process memory. The protected existing updater key
signs the installer; its value is neither printed nor committed. The site is
`kanthangboard`, ID `0c8406d3-9d2e-4afd-8351-140813bfbaf9`, serving
`https://koraspace.online` and the retained Netlify updater/download URLs.

The final native installer and connected Web build were regenerated after review.
The installer and trusted-comment signatures verify against the configured
updater public key using Ed25519 and the Minisign prehash format. All 42 archive
entries and all 42 generated native Companion files match source; both archive
aliases contain Companion 0.3.22. The model hash remains unchanged.

Draft deployment `6ace2f6e6baa6a50a985abbb` served byte-identical index, updater
manifest, installer, both Companion archive aliases, model/config, worker,
worklet, feature module and ONNX MJS/WASM assets with HTTP 200 and appropriate
content types. `/api/beat-events` returned its expected JSON `invalid_asset`
400 for an absent asset, confirming the function redirect is active.

SHA-256 of the verified release files:

- Installer (15,491,404 bytes): `2d6e2c422dbf06ca3c98bfa38db41a867da4ad9a6b6906d3c4936371eb744a75`.
- Companion ZIP (16,305,058 bytes): `2065e1a8f4bbe5432485a2777914d43e6ec6bd69d446e225dab5ff316cd7d9d6`.
- ONNX model: `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.

Production deployment ID and public verification are recorded after publication.
No installed app or user extension folder was overwritten by this task.

## User test and remaining acceptance

Update Kora to 0.1.29. Use **Install or update Companion**, then reload the
Companion extension and music tabs so the loaded files are 0.3.22. Refresh the
Web app if used. Test the same previously failing song range and then switch
tracks/platforms. Report the surface/browser and approximate song time if notes
still look wrong or lag persists. Changing songs should no longer be needed to
recover a failed inference runtime.

Independent per-row precision/recall, the affected user's real-source listening,
Bluetooth/physical output delay and weak-device profiling remain unverified.
Publishing for this requested user test does not mark those gates passed.
