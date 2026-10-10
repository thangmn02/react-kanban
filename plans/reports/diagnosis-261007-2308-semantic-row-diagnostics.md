# Cross-row flash provenance investigation

## Decision before behavior changes

The all-five-row symptom is reproducible in **normal degraded rendering** with
no semantic detections. The renderer consumes generic tempo fallback as the
same `.onset` animation used for actual instruments. Semantic-only rendering
stays dark on the identical playback/controller state.

No normal visual behavior, detector thresholds, audio models or Melody selector
was repaired in this investigation. The failed PrimaryMelodyTracker candidate,
benchmark outputs and listening diagnostics remain intact. Melody tuning and
Phase 5 stay paused. This is evidence for a rendering/fallback repair, not a
declaration that five-row perceptual quality has passed.

## Verified reproduction

Two simultaneous renderers consumed one real HTMLMediaElement playback and one
production `useMusicBeatSync` controller. Companion **0.3.14** was loaded from
the project into a disposable, isolated **Edge** profile. Its actual content
scripts and worker supplied discovery and the media clock. The supplied Nujabes
30-second WAV played normally. The cache comparison served the existing real
`server-colab-v1` EventTrack from a private local API fixture, through the normal
cache reader, merger and scheduler. No synthetic semantic events or fake timer
were injected. A second playback of the same audio returned an explicit cache
miss with clock-only capabilities to exercise degraded mode.

This is **not** verification of the user's original YouTube session, provider
capture quality, live native PCM, production cache availability or the failed
PrimaryMelodyTracker. No hosted database or model deployment was changed.

| Semantic row | Normal cache mode | Semantic-only cache mode | Source |
|---|---:|---:|---|
| Kick | 26 | 26 | server-cache |
| Snare | 24 | 24 | server-cache |
| Hat | 94 | 94 | server-cache |
| Bass | 73 | 73 | server-cache |
| Melody | 23 | 23 | server-cache |

All **240** source events appeared in both renderers with the same event IDs and
target timestamps. There were **zero** semantic type/row mismatches and no trace
overflow. DOM and animation records remain distinct; multiple lit cells of one
attack are deduplicated only in the row summary.

The full 0–30-media-second cache and cache-miss exports, row timestamps, event
sources, causal parents, per-cell records and coincidence calculations are in
[the private comparison directory](../../src-tauri/target/semantic-row-check/).
Specific artifacts: [row timestamps](../../src-tauri/target/semantic-row-check/row-timestamps.json),
[cache trace](../../src-tauri/target/semantic-row-check/cache-trace.json),
[degraded trace](../../src-tauri/target/semantic-row-check/degraded-trace.json),
[cache playback screenshot](../../src-tauri/target/semantic-row-check/cache-live.png)
and [degraded playback screenshot](../../src-tauri/target/semantic-row-check/degraded-live.png).
They stay ignored/private rather than entering the release bundle.

In degraded mode both semantic summaries contained **zero** events. Normal
mode produced **1,595 decorative cell commits and 1,499 animation starts**
(3,094 observations; these are not 3,094 detector hits). Of 126 decorative
origin groups, **95 lit cells in all five rows**. Semantic-only produced **zero**
decorative observations. For example, row 5 cell 2 flashed a `generic` event
from `random`, with `semantic:false`, `origin:tempo-fallback`, target media time
0.035 seconds, and a tempo parent ID. It was not a Melody note.

## Root cause and routing audit

1. [beat-event-engine.ts](../../src/features/music/beat-event-engine.ts):
   a cache miss plus unavailable local analysis selects `degraded`. It announces
   a 120 BPM clock with zero confidence and emits generic ticks from the media
   clock (`floor(position * 4)`). These events correctly retain tempo identity;
   they are not real instrument detections.
2. [BeatPattern.tsx](../../src/features/music/BeatPattern.tsx):
   `pulse.shapeHit` reacts to any onset or tick increase. `fallbackFlash` uses
   that shared flag for every row, including Melody, and enters the same
   `.onset` CSS appearance as a real hit. This is the confirmed all-five-row
   fan-out. Counters remain semantic, but the appearance suggests instruments.
3. Its intentional decorative moment also broadcasts `shapeHit` across its
   shape mask on any onset/tempo tick. The current mask excludes Melody, so it
   can synchronize the first four rows but cannot alone explain all five.
   The existing integration test reproduces held decoration alongside a
   separately identified semantic Hat attack. No shape design was changed.
4. The priority merger keys equivalence by **row and timestamp**, not a generic
   pulse. Same-time Kick/Snare/Hat/Bass/Melody events retain separate semantic
   keys and cached IDs. Local multi-band packets split into typed row events;
   normalization maps `snare ↔ clap` and `melody ↔ melodic` without broadcasting.
5. The scheduler delivers distinct targets separately and preserves identity;
   same-target events can be grouped without becoming a generic beat. Queue
   resets, expiry recovery and late rejection remain unchanged.
6. The bridge's late-backlog coalescer can drop an older whole onset packet by
   message kind; it does not broadcast its bands or turn them into other types.
   This remains a delivery limitation, not evidence for all-row contamination.
7. Actual row animations use band-specific counters/origins. Shared moment and
   fallback state are the exceptional visual paths. The semantic-only renderer
   removes those paths, masks, hue flow and generic timing entirely, rendering
   only accepted, timestamped, typed source traces in exactly one of five rows.

## Pairwise timestamp coincidence

Counts are directional: how many events in each row have at least one event
in the other row within ±50 ms. They are not one-to-one matches or accuracy.

| Pair | Row counts | Coincident counts |
|---|---|---|
| Kick / Snare | 26 / 24 | 0 / 0 |
| Kick / Hat | 26 / 94 | 23 / 23 |
| Kick / Bass | 26 / 73 | 25 / 25 |
| Kick / Melody | 26 / 23 | 4 / 4 |
| Snare / Hat | 24 / 94 | 24 / 24 |
| Snare / Bass | 24 / 73 | 8 / 8 |
| Snare / Melody | 24 / 23 | 1 / 1 |
| Hat / Bass | 94 / 73 | 39 / 39 |
| Hat / Melody | 94 / 23 | 8 / 8 |
| Bass / Melody | 73 / 23 | 9 / 9 |

Kick/Bass and Snare/Hat overlap heavily in this recording; the reverse
denominators differ and Kick/Snare never coincide. This does not resemble
near-total five-stream synchronization and does not prove detector accuracy.

## Instrumentation and limits

Opt in with `?musicSemanticOnly=1` or
`window.__koraBeatRows.semanticOnly(true)`. Normal mode remains the default.
The bounded 30-second recorder exports eventId, traceId, normalized type, source,
targetPlaybackTime, actualRenderTime, row, cell, semantic flag, origin, capture
owner, commit/animation stage and decorative causal parent. Existing Phase 0
records remain bounded and retain their stage counters; the row recorder is a
separate, bounded diagnostic capture, not a replacement for those diagnostics.

Use `start(30, 0)` for a known 0–30-media-second range and `stop()` when it ends.
A fixed 30-wall-second window initially omitted the final seven observations
because Edge's audio device took about 0.65 seconds to begin advancing. Existing
Phase 0 records proved all 240 events still committed. The media-range diagnostic
now allows ten seconds of bounded startup/buffering grace; no playback scheduling
policy was changed to make the export complete.

Cache IDs and local detector origin survive the allowlisted telemetry transport.
When upstream diagnostics are disabled, real typed local events get a receipt
trace at normalization, explicitly `local-detector`; no upstream detection stage
is invented. Full detector→transport proof still requires enabling the existing
Companion diagnostic setting. Untimed legacy signals remain outside semantic-only
proof. Source/capture replacement and pause clear the diagnostic visual owner.

## Validation and proposed next repair

- Final full Vitest: **96 files / 710 tests passed**; focused renderer/provenance
  checks: 56 tests passed; TypeScript passed.
- Web production build passed. Whole-tree lint: zero errors / 23 existing
  warnings; scoped diagnostic lint passed.
- Both real-audio comparisons: zero page errors, valid visible 5×8 cell geometry,
  Companion 0.3.14, audio ended at 30 seconds, no recorder overflow.
- Existing normal decorative, onset, sustain, scheduling, recovery and bridge
  tests remain intact. Models and model benchmarks were not edited.
- Existing broader Edge UI regression run: all 21 tests passed in isolated Edge.
- Scoped debugging/code review found no semantic routing regression introduced
  by instrumentation. Test/browser processes were closed; ports 5173/1420 have
  no remaining listener. Pre-existing analyzer/selector work was preserved.

The next behavior repair should prevent degraded tempo/filler from using the
semantic row-hit presentation, and explicitly keep any retained decoration
separate from detected events. It must preserve intentional shapes/randomness
and prove the five typed streams stay independent. **No such repair has been
applied yet:** this report is the requested evidence checkpoint. Keep Melody
tuning and Phase 5 paused until that repair and the ordinary-session provenance
check have been reviewed.
