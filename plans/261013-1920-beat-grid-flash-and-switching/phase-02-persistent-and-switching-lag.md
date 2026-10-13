# Phase 2: persistent and switching lag

Status: implemented and reviewed; endurance/draft checks passed; live listening pending.
Dependency: Phase 1 delivery repairs; the user authorized publishing for their
own listening test. Work context: repository root.

## Requirements and files

Cover both handoff delays and lag that starts during one song and lasts until
switching songs. Preserve continuous original audio, one capture/inference owner,
valid user selection, browser permission boundaries, Bass holds, and existing
Focus Dock/PiP ownership. Hiding a Beat pane is not itself a reason to reacquire
an already audible stream.

Inspect `src/features/music/useBrowserMusic.ts`, `mergeMusicSessions.ts`,
`useMusicBeatSync.ts`, `mediaBridge.ts`, `beat-event-engine.ts`,
`extensions/kanban-music/beat-sync.js`, `offscreen.js`, `capture-engine.js`,
`clock.js`, `background.js`, `widget-bridge.js`, and the native routing/feed.
Use `src/components/focus/FloatingFocus.tsx` and native surface owners to check
visibility changes. Adjacent tests and `e2e/beat-grid.spec.ts` own coverage.
Native Rust capture/bridge files are investigation targets only if native traces
show the fault; do not expand into backend changes based on browser lag alone.

## Steps

1. Record separate timestamps for user selection/playback change, source discovery,
   old-owner retirement, offscreen stop/close, new clock/capture, model ready,
   first processed batch, first valid onset, and first visible flash. Distinguish
   permission waits, media buffering, inference latency, and UI freezing.
2. Reproduce repeatedly: next/previous track within one platform; YouTube↔Spotify
   and other used sources; switching with A paused versus A still playing;
   manual source selection; seek/rate/pause/resume; source-tab closure;
   browser tab/window focus changes; Kora Music/Beat/Focus pane changes;
   minimizing/restoring; long same-song playback until lag, then a song change.
   Preserve the observation before switching clears it.
3. Profile worker progress, main-thread long tasks, frame intervals, audio/capture
   packet continuity, queued-event age, active subscriptions, timers, contexts,
   workers, native PCM buffering, and cache requests. Existing queues are bounded;
   do not assume a memory leak. Check for accumulation or restart churn empirically.
4. If metadata churn causes capture resets, stabilize the subscription around real
   source/asset identity and move mutable metadata updates through the existing
   owner. Do not suppress genuine song changes, clock generations, or seeks.
5. If teardown/cold startup dominates, minimize only measured redundant work.
   Consider reusing the offscreen document across a safe source handoff while
   fully releasing the previous stream and resetting its detector/clock/events.
   Preserve the six-second orphan lease, explicit stop, tab closure cleanup,
   and one-owner rule. Reuse model resources only if isolation, cancellation,
   memory, and measured benefit are proven; do not add a worker pool.
6. If automatic discovery is the bottleneck, use existing lifecycle information
   where available, with the current bounded polling as recovery. Do not replace
   a two-second poll with an aggressive timer before measuring its contribution.
7. If same-song lag arises from inference failure/backlog, apply Phase 1 recovery
   and validate sustained throughput. If UI/worklet CPU causes lag, optimize its
   proven hot operation while preserving FFT/model outputs and semantic event
   spacing. A stalled browser should recover without requiring the next track.
8. Check Web/Companion and Desktop/native routes independently. Asset availability
   is not proof of active inference. Any routing change must retain one owner
   and reject stale callbacks. Overlapping audio in the same browser process
   remains the existing native limitation; do not claim tab isolation.

## Validation and proposed gates

- Repeat at least 30 source/track handoffs and 30 minutes of uninterrupted
  playback in the affected browser, with foreground/background/window and Kora
  view transitions. Include the previously failing song range. Use a normal
  desktop and an available weaker machine; report unavailable coverage explicitly.
- No stale old-song flashes, duplicate owner, monotonically increasing active
  worker/context/timer counts, or permanent need to switch tracks for recovery.
  Memory measurements must distinguish browser/GC fluctuations from retained
  resources. Playback remains audible when analysis recovers.
- For already-authorized manual handoffs, propose ready/progressing analysis
  within one second p95, excluding real media buffering. Measure automatic
  selection separately against the discovery interval plus request/setup time.
  Do not promise an onset in drum-free passages; measure model progress instead.
- Foreground grid/UI should retain at least 30 fps while animated; switching
  should introduce no attributable main-thread task longer than 200 ms. Record
  p95 frame/long-task behavior alongside user-visible responsiveness. These are
  proposed gates, not established baseline results.
- Validate permission denial/revocation as an explicit authorization state,
  never as falsely active drums. No permission bypass or repeated retry storm.
- Fault tests cover pending old startup, delayed old worker completion, pending
  stop/close, rejected lease, reconnect, failed native capture, and hidden-pane
  transitions. Run focused lifecycle/integration tests, then shared checks and
  actual packaged Web/Desktop listening when their routes changed.
- Re-run Phase 1 accuracy/timing checks after handoff changes. Improved switching
  must not regress note identity, holds, accepted effects, or capture cleanup.

## Risk, rollback, and finish

Resource reuse can retain old-song state; premature teardown can interrupt audio;
over-eager routing can duplicate capture. Prefer small measured changes, owned
generation checks, and bounded cancellation/recovery. Compare before/after on
the same input and browser. Stop all test processes this work starts, checking
the project ports before starting a server and keeping its PID/port/worktree.

Revert only new Phase 2 changes if lifecycle or listening regresses. Record
results and remaining limits in `plans/reports/`; update owning product docs only
for verified behavior/operational changes. Do not publish a new version based
solely on automated checks. Prepare reviewable artifacts and obtain release
authorization if publication is subsequently requested.
