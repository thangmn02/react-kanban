# Lead availability and visual pattern consistency

2026-10-09. Visual repair: PASS. Normal uncached provider Lead: BLOCKED.
Frozen Lead v1, detectors, musical timestamps, scheduler and merger are unchanged.
No deployment, database changes, audio upload or public-processing activation.

## Actual Lead path

Playwright MCP inspected the authenticated normal application at
`http://127.0.0.1:5173/beat-grid?view=app` with the real Companion connected.
“Know My Name” resolved to YouTube asset `mlFxxNsExJc`; browser capture supplied
Rows 1–4. Its versioned Lead request returned HTTP 503 `{"status":"unavailable"}`.
Subsequent real source changes also returned 503. No simulated transport was used.

| Stage | Verified result |
| --- | --- |
| Companion/source identity | Present; actual provider ID and playback state |
| Lead version | Client and worker use `server-lead-pulse-range-v1` / `lead-pulse-v1` |
| Gateway | First failure: `handleBeatEventCache` returns 503 when `leadEnabled` is false |
| Authentication/admission | Not reached for this request; not evidence of an auth denial |
| Sparse lookup | Not reached; unavailable is not a verified cache miss or empty track |
| Cloud worker/publication | No job admitted; not evidence of a failed inference job |
| Normal Row 5 | Correctly dark without events; cache-ready/replay acceptance remains blocked |

Local Vite configuration has no Lead gateway opt-in, cache backend/origin,
analysis endpoint/key or Supabase service-role configuration. Client Beta UI is
enabled, processing is false. The optional Lead-enabled Modal image is prepared
but has not been built/deployed/validated. Existing legacy service operation is
not proof that the versioned Lead worker is available.

Web Companion spectrum/percussion capture does not provide an authorized raw-PCM
upload path. `canAnalyze` indicates local capture capability, not permission or
capability to deliver audio to Lead analysis. Native bounded audio-input code
exists behind disabled processing gates; its hosted storage/admission setup was
not verified here. Provider identity alone does not authorize fetching its audio.

Independent worker check: a new 175–190s range from the user's local “One More
Time” recording ran through existing ADTOF, separation, frozen Lead v1 and the
range exporter. It produced **39 Lead events / 89 normalized events** with a
validated chunk. The actual isolated Essentia runner executed locally. This was
not a saved Lead fixture and was not mapped to the YouTube asset or published.
It proves inference/export only, not gateway, cache handoff or normal UI delivery.

Required setup remains: private authenticated/versioned sparse gateway and its
Supabase credentials/storage/demand permissions; deployed and validated isolated
Lead worker; authorized bounded audio delivery for the intended Web/native input.
Dependency/weight and audio rights must be cleared before processing opt-in.
See [operational setup and gates](../../docs/server-beat-analysis.md). No secrets
were printed or committed and no clearance flags were enabled.

The normal UI now labels **Row 5 · Lead Beta** and explicitly says
**new audio analysis is disabled · cached Lead ranges only** when unavailable
with processing disabled. Enabled-processing retry wording remains supported.
An unavailable request is never presented as successfully analyzed zero events.

## Historical patterns, defect and repair

Existing definitions remain authoritative in `beatVisuals.ts`: seeded 2–4 cells
per row; pop/wave/splash/ripple rotate every eight media seconds. Wave delays are
column ×40ms, ripple distance from center ×40ms, splash uses its seeded subset
and 0–70ms delays. The semantic anchor remains immediate. Existing heart,
diamond and smile masks, cascade/wave/rain delays, occasional 35–45s trigger and
eight-second held shape lifetime remain unchanged. Mid-fade partial shapes are
valid and are not classified as broken based on a still screenshot.

Confirmed defects: same-row count changes replaced keyed cells before their
multi-cell animations finished; global pattern/epoch changes could alter an
in-progress pattern's CSS, mask or delays. A review additionally found that a
long measured Bass hold could remount after its shorter decorative expiry.

`BeatPattern.tsx` retains the selected row pattern, count/seed, epoch, trace and
deadline until that visual finishes. Later actual hits get the existing immediate
semantic overlay, without delaying/changing musical events. Per-cell pattern
attributes keep CSS stable across global mode changes. Bass retains its allocation
and wrapper through its measured hold. Independent row lifetimes and existing
150/700ms CSS animations remain; no new keyframes or renderer were introduced.
The small CSS selector change is in `floatingFocus.css`.

One selected pattern plus at most one retrigger overlay per row bounds dense
bursts. There is no growing visual queue. Held shape masks were not redesigned;
their established overlays intentionally retrigger. Lead remains event-driven
and is never filled by generic decoration when analysis is missing.

## Evidence and regression checks

| Measurement | Before | After |
| --- | --- | --- |
| Real normal-UI frames | 131 | 333 over approximately 14s |
| Mature pop CSS starts with matched observed ends | 34/82 | See completion measurement below |
| Mature wave CSS starts with matched observed ends | 2/27 | See completion measurement below |
| Mature animations with resolved completion | Not instrumented | **106/106**, zero premature cancellations |

Before counts match node/name/trace; detached-node cancellation does not reliably
bubble to the old listener, so unmatched ends alone are not a cancellation score.
After uses animation completion promises with a 1.5s observation margin, covering
Kick/Snare/Hat/Bass and ripple/pop. Completed fill cleanup is not premature
cancellation. These are different musical passages, not matched accuracy scores.
Wave/splash/boundary and dense same-row behavior also have deterministic tests.

Final full JavaScript suite: **829 tests / 113 files passed**, 29.22s; focused
renderer suite: 36 passed. Affected validation also passed 28 Python tests,
14 native tests, three targeted browser E2E journeys, selector invariants,
typecheck, lint, build and bundle budget (existing lint/test warnings retained).
Tests preserve geometry/node identity through mode changes and dense retriggers,
cross-row independence, pause/source cleanup, held shapes, Lead routing and a
1.8s Bass hold across decorative expiry and mask rotation. Read-only follow-up
review confirmed the Bass finding resolved with no remaining scoped concerns.

Real Companion seeking and source changes were observed. Live pause control did
not pause the provider and direct control returned `MusicBridgeError: playback`;
live pause/resume is therefore not claimed passed. Lifecycle regressions pass,
but real new-Lead handoff, cache-hit replay and Desktop GUI remain unverified.
Expected service 503 console errors remain; no renderer exception was observed.

Cost is bounded row snapshots and existing overlays/timers, with 40 cells and
unchanged animation durations. Bundle budget passes; no new low-end hardware
benchmark or claim of measured CPU improvement. Learned percussion latency
remains separate. The old upstream missing-Snare observation was not reproduced
in this run and is not claimed fixed.

Raw frames, worker output, logs and normal-grid screenshots are ignored under
`src-tauri/target/lead-availability-patterns/`; final screenshot is
`normal-grid-final.png`. No generated JSON/browser output was added to tracked
reports. Existing server on port 5173 was reused; task test/worker processes ended.
