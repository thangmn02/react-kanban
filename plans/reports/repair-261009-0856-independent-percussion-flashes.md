# Independent percussion animation repair

Accepted as mechanically validated on 2026-10-09; this task is closed without further tuning. The focused fix and regression tests are preserved. Next priority: shared general-purpose Row 5 Lead for Web/Desktop, not started by this closure.

Root cause: the normal renderer replaced every row's activation with the latest event batch. Kick/Hat/Bass updates removed an earlier Clap animation, sometimes before its first animation frame. Typed event routing and model thresholds were not responsible for this cancellation.

Code changes: `BeatPattern.tsx` gives Kick/Snare/Hat independent, bounded animation lifetimes covering existing CSS durations/delays (220 ms pop/random; 980 ms wave/ripple). Same-row hits replace their own prior flash; other rows preserve its DOM identity. Keys use processed percussion counts so a new incoming count cannot replay the previous trace. Pause/capture replacement clears hits. Bass, Melody, models, scheduler, merger, cache and decorative effects remain unchanged.

Before: live Clap nodes sometimes lasted only 6–8 ms with no observed animation start. In the earlier 60–90-second transport sample, 33 Snare events reached receive, accept and DOM commit, but only 20 distinct animation traces were observed. The older user's 0–1 upstream Snare result did not reproduce.

After: an 85.16-second live observation measured:

| Row | Completed lifetimes | Observed animation starts | Below 20 ms | Median lifetime |
|---|---:|---:|---:|---:|
| Kick | 101 | 101 | 0 | 225.8 ms |
| Snare/Clap | 51 | 51 | 0 | 230.8 ms |
| Hat | 159 | 158 | 0 | 222.6 ms |

These measure presentation, not musical accuracy or a controlled same-audio accuracy comparison. The post-repair probe did not preserve continuous media identity, so it must not be described as a song-specific benchmark.

Hat investigation: the sole missing-start entry was the first completed lifetime (ID suffix 2786), with only 35.5 ms remaining. The observer was attached during playback and sampled existing cells. A follow-up explicitly separated initially active cells: the already-active Hat had no newly observed start; all six newly arriving Hats, eight Snares and one Kick had observed starts. This reproduces an observation-start artifact. The original trace lacks initial-membership data, so that historical Hat cannot be retrospectively certified; it is not evidence of detector rejection. No thresholds changed.

Regression coverage: two compact tests exercise Clap survival across other-row updates, preserved trace identity, bounded expiry, same-row retrigger and capture replacement. The existing independence assertion now requires preservation; existing decorative tests remain intact. Final suite: 790 tests / 111 files passed; focused renderer suite 30 passed; type checking, scoped lint and Vite build passed (existing compatibility/chunk warnings).

Browser navigation, screenshot, saved-demo activation and Fusion switching succeeded. Actual pause cleared all semantic/decorative flashes; seek/resume restored playback. Live API console errors were 404 cache misses and 503 analysis-unavailable responses, without other error entries.

Separate open issues are recorded in the [task plan](../261009-0557-live-grid-delivery/plan.md): learned percussion timing delay (about 227–246 ms median), analysis-service HTTP 503 availability, and unverified hidden-tab return lag. The old upstream missing-Snare observation is **not reproduced, not fixed**. Row 5 still requires analyzed Lead events. No deployment.

Raw JSON, screenshots and instrumentation evidence are local-only under ignored `src-tauri/target/live-grid-delivery/browser-animation/`. Playwright output is also ignored. Observers/listeners were disconnected; no server was started. Refresh the local grid and keep the existing Timing Test Companion.
