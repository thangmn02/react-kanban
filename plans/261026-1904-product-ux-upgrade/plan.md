# Product UX upgrade

Status: implementation complete; final UX qualification PARTIAL. Baseline: codex/p3-p4-qualification at a28d851, inherited dirty workspace retained. Active branch: codex/product-ux-upgrade. See [acceptance and remaining qualification](acceptance.md).

## Outcome and acceptance

Reduce capture → decide → focus → context → complete friction using existing services, routes and controllers. Home and Today must expose an immediate real task action; details must return to their originating context; shared interactions must support keyboard, narrow screens and reduced motion. Validate combined UX and P3 application with browser and automated receipts. No deployment or distribution changes.

## Ownership

UX owns task/navigation surfaces, AppLayout integration, shared interaction motion, and the surrounding FloatingFocus toolbar/tab presentation. One integration point: AppLayout/createAppLayoutRouteContext. P3 owns all Beat renderers, diagnostics, event engine, scheduler, capture, Companion, detectors and compensation. Focus session/timer controllers and persistence contracts remain unchanged. Do not animate/remount the controller or Dock host during route/tab transitions. In floatingFocus.css, semantic/grid/heartbeat renderer selectors are outside UX ownership.

## Increments

1. UX-1: preserve originating task context, scoped scroll restoration, command palette keyboard access and missing navigation actions.
2. UX-2: real first-task action on Home; quieter Today hierarchy; direct persisted completion with pending/failure feedback and predictable reflow.
3. UX-3: consistent task editor context links and actions across Board/Calendar/Table; keyboard sortable Board with reduced-motion lift/drop.
4. UX-4: shared finite motion tokens; Dock mode feedback/expand polish while retaining mounted tabs, timer, playback and PiP.
5. UX-5: loading/error copy, mobile density/focus polish; workflow/browser/accessibility/performance regression and independent review.

## Evidence and risk

Baseline focused suite: 5 files / 42 tests pass. Existing Home places a pin action above task actions; Today requires editor for completion; cross-board task open always navigates away; board filters already live in AppLayout and survive normal view switches; command palette lacks arrow-key selection. Reuse these working foundations rather than rebuilding them.

Browser evidence will use actual local-mode persistent services. This does not qualify Supabase/RLS or live Companion music detection. Previous P4 results are historical evidence only; this new interface needs its own combined qualification. Keep the previous sealed scratch/p3-p4-261026-1706 evidence untouched.

Rollback: revert only this task's recorded file changes, preserving inherited dirty changes; snapshots in scratch/product-ux-261026-1904. See [audit](audit.md), [acceptance](acceptance.md).
