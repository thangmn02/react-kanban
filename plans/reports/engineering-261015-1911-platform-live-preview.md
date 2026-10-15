# Private platform live preview

Delivered locally on `codex/beat-grid-quality-recovery`, based on `a29e2a4` plus the current working-tree changes. No deployment or production qualification. User retry is pending.

## Behavior

The user confirmed successful local buffered activation, then requested YouTube and other-platform testing. The new private `experimental-live` mode permits explicitly consented, unverified predictions from the current browser tab capture while playback continues. It requires authorized audio, heard output and acceptance of late/incorrect flashes. No calibration or intentional audio delay is used. Enabling, disabling and cancelling live activation preserve the existing zero-delay audio graph.

This extends the original private video fallback decision at the user's request. Video still cannot enter the calibrated audio buffer. Spotify, protected sources, native monitoring, unknown media, multiple active sources, missing output ownership and unhealthy clocks/capture remain ineligible. Non-private builds retain the disabled candidate flag. The normal decoder and the original source/event timestamps remain authoritative; stale events still face the existing 600 ms scheduler limit.

Pause, seek, source/generation/rate changes or lost eligibility end live preview. It must be explicitly enabled again while playing. Capture identity, owner and synchronization epoch guard asynchronous results. The optional audio-only buffered experiment remains available separately.

The [owning guide](../../docs/beat-event-cache.md) and generated private listening guide describe the workflow. Reload Kora Music Companion Private on the browser's Extensions page, refresh source/grid tabs, play the desired YouTube/supported source, invoke Companion on that source tab, select it in the grid, complete the three Live preview checks and click **Enable live preview (no audio delay)**. This workflow does not require pausing.

## Actual browser evidence

Final private package: `0.3.24 browser-first-v2 live preview private`, 46 packaged files, ZIP SHA-256 `99f07eac4ab4e0f6f0279cb502b449b1734de67105e2e3a11fe66140196dfb8b`. [Current ZIP](../../scratch/browser-first-candidate/kora-music-companion.zip), [unpacked extension](../../scratch/browser-first-candidate/extension/manifest.json).

Actual isolated Edge `155.0.4283.45` loaded that private extension and exercised its toolbar capture and real UI consent path:

- Generated CC0 percussion produced three viewport-visible instrument animations with zero reported and actual offscreen output buffer, before delay calibration was complete. Disabling and seeking revoked predictions.
- A real playing, unmuted YouTube video (`jNQXAC9IVRw`, readyState 4, playback time approximately 5.5 s at observation) entered `experimental-live`. Four new viewport-visible Bass prediction animations were observed; both status and the actual output buffer stayed zero. Video buffer eligibility stayed false and `allowSemantic` stayed false. Pausing revoked preview.
- The YouTube clip is a short capture/routing check, not a drum reference or natural-music benchmark. Bass flashes are model outputs, not verified musical events. These observations do not establish speaker/video timing, accuracy or user hearing.

See [raw result](../../scratch/browser-first-candidate/real-msedge-live-preview.json) and [YouTube preview screenshot](../../scratch/browser-first-candidate/platform-live-youtube.png). Run `scripts/verify-private-companion.mjs` against the existing review server with `KORA_CANDIDATE_LIVE=1`, `KORA_CANDIDATE_REUSE_SERVER=1`, `KORA_CANDIDATE_BROWSER=msedge` and `KORA_CANDIDATE_SECONDS=0`. The [platform verification helper](../../scripts/verify-platform-live-preview.mjs) contains the checks.

## Validation and review

Full-suite run: **907/907 tests, 116 files**. A subsequent compatibility-copy correction explains when an older private extension needs reloading; all four focused live-control tests pass after adding that regression. Typecheck, private page build, normal production build, script syntax, normal/private packaging and bundle budget pass. Main entry is approximately 717.8 KiB against 976.6 KiB. Lint has zero errors and 25 existing warnings. Vite reports its existing native-config import and chunk-size warnings; none is hidden.

Focused coverage includes mode/consent/private/provider proof, video zero delay, unchanged graph nodes/connections, stale epoch rejection, source revocation, delayed configuration cancellation and UI controls. Review caught paused mode admission and an output-graph replacement during failed activation cleanup; both were fixed and re-reviewed without remaining findings. The real browser check also exposed relay fields being stripped; explicit allowlisting and its regression test now preserve live/timing consent while stripping unrelated configuration fields.

The original v1 ZIP is retained as [kora-music-companion-v1.zip](../../scratch/browser-first-candidate/kora-music-companion-v1.zip), SHA-256 `625a548deb0c02466c8605b88007c0300ac9db7d0bd98c3a6413cbb2f07c54e3`. The earlier soak belongs to its recorded artifact, not this v2 package. No new 30-minute soak was run.

Owned verification browsers exited and their four temporary profiles were removed. The user review server remains on PID 22692 at 127.0.0.1:5173/5174. No browser belonging to the user was changed.

## Open gates

User platform retry, natural accuracy, verified reference coverage, model release rights and physical synchronization remain unresolved. Provisional human annotations remain `provisional-human-reference`, with no official precision/recall/F1 derived from them. Production remains **NO-GO**.
