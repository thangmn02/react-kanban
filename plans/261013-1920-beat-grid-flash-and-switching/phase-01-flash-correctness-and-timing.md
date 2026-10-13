# Phase 1: wrong and slow flashes

Status: implemented and reviewed; independent accuracy/user listening acceptance pending.
Work context: repository root. Evidence:
[investigation](../reports/diagnosis-261013-1920-beat-grid-flash-and-switching.md).

## Requirements and baseline

Reproduce the user's symptoms using the current rolled-back engine. Record
browser/version, Web or Desktop build, actual loaded Companion ID/path/version,
audio output device, selected source, track segment, playback rate, capture owner,
cache/local path, and motion preference. Inspect runtime readiness as well as file
presence. Disable competing Companion instances only with clear user ownership.

Collect paired 30-second segments in semantic-only and normal presentation using
existing `__koraBeatRows` and `__koraBeatTelemetry` diagnostics. Repeat recordings
to cover more of the same song, including the range where lag begins. Keep onset
timestamp error, processing age, transport delay, DOM commit, animation start,
and visible brightness timing separate. Record queue depth, worker completion
progress, dropped frames/events, capture restarts, and UI long tasks.

Use independent human-verified drum labels for representative EDM, pop, rock,
sparse/quiet music, dense hats, repeated attacks, and non-drum controls. Compare
the identical audio segments before/after. Do not use predictions as reference
labels. Evaluate Bass under its existing low-pulse/hold contract. Existing local
recordings may help reproduce symptoms, but require confirmed sample format and
reference labels before scoring.

## Owning files

- Inference/progress: `extensions/kanban-music/percussion-runtime.js`,
  `percussion-worker.js`, `percussion-classifier.js`, `percussion-features.js`.
- Capture/timing: `extensions/kanban-music/capture-engine.js`, `beat-timing.js`.
- Delivery: `src/features/music/beat-scheduler.ts`, `beat-event-engine.ts`,
  `useMusicBeatSync.ts`.
- Presentation: `src/features/music/BeatPattern.tsx`, `SemanticBeatPattern.tsx`,
  `beatVisuals.ts`, `beat-row-diagnostics.ts`,
  `src/components/focus/floatingFocus.css`.
- Validation: existing adjacent tests, `scripts/score-percussion-annotations.mjs`,
  `e2e/beat-grid.spec.ts`; package owners only if production inspection proves a
  packaging failure. Avoid editing every listed file without a demonstrated cause.

## Implementation steps

1. Establish the above baseline and identify the first failed stage. Check actual
   config/model fetches, WASM startup, worklet loading, feature continuity, scored
   events, clock mapping, scheduler acceptance, and row rendering. A missing row
   must be attributed to a specific stage rather than guessed from its color.
2. Fix confirmed production asset/CSP/worklet defects if reproduced in the
   affected build. Local assets are already present; do not repeat the earlier
   missing-model diagnosis without runtime evidence. Capability availability
   must remain distinguishable from successful, progressing inference.
3. Add explicit runtime health/progress observation and bounded recovery in the
   active capture. Use completion of frame processing, including empty results,
   rather than accepted note activity as liveness. On failure or a proven stall,
   terminate/disconnect the old inference runtime, clear its pending events,
   and restart one runtime with bounded retries/backoff while original playback
   and Bass analysis continue. Abort recovery when capture ownership changes.
   Make failures observable through allowlisted diagnostic reasons. Permanent
   initialization failures must not become tight restart loops.
4. If paired views prove a presentation delay, give every distinct semantic drum
   attack a consistent immediate flash, including the first attack of a Wave or
   Ripple cycle. Keep decorative geometry, masks, stagger, shape lifetimes and
   Bass holds intact. Verify new attacks are neither coalesced away nor mistaken
   for extra instrument detections. Measure visible rise as well as CSS start.
5. If semantic-only events have wrong identities, score the existing classifier
   against the fixed annotated corpus. Adjust only the proven responsible
   threshold/peak/dedupe behavior, one change at a time. Preserve simultaneous
   different-row attacks and rapid valid same-row attacks. If model quality or
   irreducible lookahead prevents the target, report that boundary and concrete
   options before introducing a replacement model, audio delay, or new analysis.
6. Repair deadline mapping only when trace evidence identifies a clock-domain,
   discontinuity, output-device, or timestamp error. Do not move an onset's
   timestamp to arrival time to conceal latency. Tighten stale-event handling
   only against the measured budget; do not loosen the existing 600 ms safety
   limit to make missed notes appear as a successful check.

## Validation and proposed gates

- On a fixed annotated corpus, propose per-drum-row precision at least 90% and
  recall at least 80% using one-to-one timestamp matching within ±50 ms, with no
  regression on previously accepted excerpts. Report absent-row false hits and
  denominators separately. These are initial targets; measure baseline first.
- For visible, foreground playback at 1×, propose local audio-to-semantic-flash
  p95 lateness at most 250 ms and cache-driven p95 absolute error at most 50 ms.
  Propose receipt-to-semantic-commit p95 at most 50 ms. Report median, p95, worst
  case, missed events, and measurement boundaries. The model's existing 100 ms
  right context rules out a zero-latency promise for local detection.
- Fault injection covers initialization failure, post-ready worker error, hung
  inference, repeated backlog, and late results. Recovery must resume on the same
  playing song, keep one runtime, and reject pre-recovery events. Normal silence
  must not trigger model restarts. Choose watchdog/retry timing from measured
  healthy progress, including slower hardware, and test it explicitly.
- Run the narrowest changed-behavior tests first. Broaden to current percussion,
  capture, scheduler/merger, hook, renderer, native integration, lint, typecheck,
  and production build when their shared contracts change. Unit doubles verify
  failures and lifecycle; actual browser WASM/worklet playback verifies execution.
- Repeat installed-browser listening in normal mode. A count of four flashing
  rows, a valid model hash, or a successful mock test is not the exit gate.

## Risks, rollback, and documentation

Excessively short progress deadlines can restart healthy workers; incorrectly
kept old callbacks can duplicate notes. Threshold changes can trade precision
for recall. Separate detector fixes from presentation fixes so each is measurable.
Keep diagnosis artifacts under `plans/reports/` and raw bounded traces under
ignored scratch/target. Stop only test processes created for this work.

Use focused reversible changes based on `2ae6703`. Revert only the new phase
changes if the fixed corpus or listening regresses; do not reset unrelated work.
When implementation changes observable behavior, update the smallest owning
Companion README/validation surface. Correct their verified packaging mismatch
and distinguish historical measurements from new acceptance evidence.
