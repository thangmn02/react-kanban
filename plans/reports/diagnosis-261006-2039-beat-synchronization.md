# Beat synchronization foundation / timestamped look-ahead

Baseline recovery is complete at `2cb55a5`; diagnostics started at `c492ab8`.
The separately requested compact glass Music controls are isolated in
`399b9c2`. This change completes only the corrected Phase 2 / original Step 3.
No detector, model, row semantics, random pattern or CSS animation is changed.
The grid remains five rows by eight cells. Later phases remain unstarted.

## Contracts and event path

Both DOM and detached media observers report actual HTML media position/rate,
paused/playing state, buffering/seeking flags and seek generations. Explicit
generations catch even small seeks; legacy companions retain sampled-clock
discontinuity handling. Capture still restarts on seek/rate discontinuities;
the scheduler can re-arm retained targets on rate changes without changing
their song positions.

Capture and existing instrument producers emit before their current audio
deadlines. Shared `beat-timing.js` maps AudioContext deadlines to epoch time,
then `targetPlaybackTime` in song seconds plus its audible `playbackClock`.
Offscreen → BeatSync → widget/native bridge → media bridge preserves these
fields. Native PCM analysis uses the same boundary without treating its muted
monitor AudioContext as the speaker clock. Valid browser output timestamps are
used where available; unsupported/invalid/throwing capabilities use sampled
context time. Native capture timing remains an estimate, ready for later
normalization improvements; no new hardware timestamp is claimed.

The controller's scheduler holds future events against the media clock rather
than receipt time. One timer, 2,048 queued events, eight-second look-ahead and
3.5-second clock freshness bound the work. It processes one distinct target per
task to avoid collapsing a delayed phrase into one React commit. Pause,
buffering, seeking, capture/source replacement and recovery flush queued work.
Old captures, generations and pre-reset anchors cannot replay after recovery.
Fresh events rebuild the queue. Cleanup cancels timers and pending notes.

Older transport timestamps may survive if their validated playback target is
still timely and bounded. Existing coalescing/recovery applies to other delayed
transport work. Target lateness is logged; over 600 ms expires with renewal
throttled to once per second. Full queues evict oldest enqueued work, allowing
fresh activity. Malformed timing cannot become an immediate flash. Legacy
untimestamped events keep their existing arrival path.

## Observability and verification

`EVENT_SCHEDULED` adds target, projected position, delay and depth. Existing
IDs and onset/tempo/random/lifecycle provenance survive transport and release.
Controller, DOM commit and animation records expose target offsets; the render
deadline is recalculated from the latest media sample. Original producer
mapping remains in earlier records. No semantic onset is fabricated by tempo
or recovery. Late/drop diagnostics also work without producer trace sidecars.

| Check | Evidence |
| --- | --- |
| Continuous/quiet playback | Existing detector/capture recovery test and new accelerated 30-minute scheduler run: 1,800 timestamped releases, no accumulated drift or retained timer. Detector→transport→controller→DOM→animation integration resumes after ten seconds of silence. |
| Pause, buffering, seeks, rate | Clock observer and scheduler tests cover waiting/playing, small seek generations, forward/backward jumps, stale anchors, pause/resume and re-arming at 2×. |
| Delay, late events, queued work | Early deadlines, 650 ms processing delay, late target logging/expiry, 2,048-event saturation, stale-clock timeout and old transport/future-target tests pass. |
| Source and lease recovery | Controller test flushes pending flashes on capture expiry and selected-source replacement, then accepts fresh captures. Existing lease/native recovery regressions pass. |
| Provenance | Real existing BeatDetector → capture engine → BeatSync → postMessage → scheduler → controller → DOM → animation integration retains the same IDs and sources. Tempo remains structural. |

Fresh checks: **617 tests across 83 JS files**, **14 native tests**, TypeScript,
Companion packaging (34 runtime files), production build and diff whitespace
checks pass. ESLint has zero errors and 23 existing warnings; Vite retains its
existing config-import and large-chunk warnings.

Existing E2E suite: **15/15 pass** in installed Edge. The first run passed 13/15;
the first two tests timed out during initial `page.goto('/home')` while full
unit/type/lint checks ran concurrently. No assertion failed or test was weakened.
The unchanged full suite passed on rerun after those processes finished.

## Browser evidence and limits

An owned calibration page played real 40-second WAV media with known attacks at
`n + 0.25` seconds through the production bridge, hook, scheduler and renderer.
Connected Edge and in-app Chromium exercised normal playback, 2×/1× rate,
pause/resume, forward/backward seeks, 350 ms delivery delay, intentionally late
1,800 ms delivery, source interruption and capture/lease replacement. Fresh
events resumed after discontinuities; late work appeared as `schedule-late`
or stale-owner/reset drops instead of replaying.

Representative Edge DOM offsets were 4.60–21.51 ms at 1× and 6.60–17.66 ms at
2×. The 350 ms processing-delay check included a 111.65 ms commit outlier;
subsequent commits were 12.16 and 19.98 ms. Post-recovery commits returned to
4.35–17.54 ms. These are observed samples, not a latency guarantee or detector
quality benchmark. Existing masks and decorative CSS delays remain intentional;
animation-start records can occur much later than semantic DOM commit, including
background-tab paint/restarts. Physical speaker/display latency was not measured.

The connected Edge Companion probe returned `not-installed`; no installed
Companion/live-provider end-to-end claim is made. Browser buffering was exercised
through lifecycle interruption and automated waiting/playing clock tests, not a
real provider network outage. Temporary fixtures, owned browser tabs and servers
are removed after checks. The separately verified glass player uses real media
seek/volume capabilities and keeps source/AI setup secondary.

Review: inspected timestamp normalization, ownership/lifecycle cancellation,
transport validity, bounded queues, telemetry privacy and cleanup against the
request. No blocking finding remains. The scheduler/clock boundary was also
simplified without changing its thresholds or behavior.

Rollback: revert this focused synchronization commit. No release, deployment,
dependency change or mandatory inference model is included. Stop before Phase 3.

References: [execution plan](../261006-1813-beat-look-ahead/plan.md),
[corrected roadmap](../261006-2039-beat-grid-roadmap/plan.md),
[recovery report](diagnosis-261006-1659-beat-recovery.md),
[Music UI report](review-261006-2039-dock-player.md),
[owning protocol documentation](../../extensions/kanban-music/README.md).
