# Saved Lead listening acceptance

The previous demo defaulted to legacy stems and requested a live analysis API
despite already having saved Lead events. Automatic fixtures now load first;
the private adapter validates their unchanged events/provenance and supplies the
existing EventTrack engine. No inference or backend request is needed for them.

The existing 5×8 grid and one original-audio HTMLMediaElement remain authoritative.
Visible Play/Pause, Replay and seek controls share that clock. Loaded count,
readiness, ownership and latest onset are explicit; unavailable/empty/invalid
analysis cannot masquerade as successful zero detection. Counts survive pause
and passage end; seeking/replay starts a fresh run. Normal-renderer preview
uses the same saved events with its existing semantic-only option. Private CSS
is mounted inside the existing dock shadow root so primary controls/grid/counts
fit together. Models, Rows 1–4, production scheduler/merger/renderer are unchanged.

## Reproduce

Open http://127.0.0.1:5173/beat-grid?musicDebug=1&view=app&musicDemo=lead&musicFixture=lead-lee_hi_hskt
in the signed-in development browser. It selects automatic H.S.K.T., 0–30 s,
with 95 saved Lead events. Wait for Original audio ready; click Play original
audio. Listen and watch Row 5. Pause original audio stops both; Replay passage
restarts at zero. Other automatic fixtures are available in Saved listening
fixture. Legacy model/stem auditions are secondary diagnostics. Pause other music.

## Verified on the running application with Playwright MCP

- Navigation and real original WAV loading succeeded (30 s, readyState 4,
  unmuted, volume 1); visible controls started playback.
- Complete H.S.K.T. pass: **95/95 semantic DOM commits and animation starts**,
  exclusively Row 5. DOM delay vs target: median **13.3 ms**, p95 **26.0 ms**;
  animation delay: median **22.7 ms**, p95 **35.4 ms**. One foreground desktop run,
  not musical-accuracy or cross-hardware evidence.
- Pause held the clock at 0.993869 s and count 2 for 500 ms, clearing active cells;
  Replay returned to 0.019763 s and resumed. Piano fixture switching loaded the
  correct original WAV, 38 events, paused at zero with no stale cells. Optional
  normal renderer also showed only Row 5 from the selected saved input.
- Visible CSS animation confirmed for saved-lead-0, target 0.618231 s, audio
  0.655074 s; no other-row activation. Screenshot:
  `src-tauri/target/lead-listening-acceptance/acceptance-visible-flash.png` (ignored).
- No demo runtime exceptions. Existing unrelated live YouTube requests still
  return `404 (Not Found)` at `/api/beat-events?...analysisVersion=server-primary-melody-range-v1`;
  these were present before the correction and do not serve the saved fixture.
- **809 JavaScript tests passed**; typecheck, changed-file lint and Vite build
  passed. Full lint exited zero with 23 existing warnings; build retained existing
  config-loader/chunk-size warnings. No Python/native analysis changed.
- Regression coverage includes pause/seek/rate/buffering, empty/invalid data,
  cross-chunk overlap, one audio clock, automatic default and recorded trace
  identity/timing after fixture replacement. Review findings were addressed.

Generated browser output/screenshots remain ignored. No large tracked traces,
deployment, model/threshold changes or new development server. Human musical
listening acceptance remains the user's next step.
