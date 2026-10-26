# Product-wide audit

## Priorities

| Surface | Working foundation | Evidence / action |
| --- | --- | --- |
| Home | Real service metadata, pinned task context, daily plan, Quiet typography | P1: pinning precedes task action; mobile plan comes after main sections. Add compact first-task action ahead of pins, using planned order then service order. Keep pins secondary. |
| Today | One-click Focus, deterministic due/priority suggestions, persisted plan | P1: no direct completion; stats precede work. Add pending-safe completion through existing task services and move stats below primary work. |
| Navigation | Long-lived AppLayout/controller, shared board filters, auth return routes | P1: opening Today/Home task navigates to Board. Keep origin route/editor; restore scroll per route/board. Avoid full-page animation. |
| Command palette | Search, Enter first result, action catalog | P1: no selected option/arrow keys, dialog focus handling incomplete. Add keyboard selection, focus containment/restoration and Table/Focus routes. |
| Board | Optimistic task movement, dnd-kit transitions and rollback in operations | P1: pointer-only sensor despite focusable sortable nodes. Add keyboard sensor, finite lift/drop, reduced motion. Preserve data reducer. |
| Calendar / Table | Same filters and task editor, real task identity | Preserve existing behavior; retain view/scroll and unify editor actions instead of adding another preview. |
| Task editor | Existing modal editor, rich text, checklist, attachments, sessions/activity | Reuse as contextual preview; improve safe one-click saved context access and direct Focus entry. Preserve unsaved editing behavior. |
| Focus Dock | Shared host/controller, mounted panels, moving tab indicator, PiP | Preserve identity and useBrowserMusic ownership. Refine finite transitions and accessible mode feedback only. |
| Music / Beat | Functional playback plus P3 semantic renderer | No renderer/engine/capture changes. Run combined regressions; live audio quality remains separate qualification. |
| Workspace | Existing roles, invites and member surface | Keep lightweight existing architecture; no new team/data platform. Verify navigation and narrow-layout access. |
| Design Lab | Isolated QuietHome/Today/Board/Focus previews | Adopt restrained task hierarchy, not mock data or unsupported AI reasoning. Production already uses many Quiet primitives. |

## Component inventory

Reuse HomeDashboard, TodayPage/TodayTaskCard/TodayTaskSection, existing TaskDialog, BoardChrome/BoardTabs, TaskItem/TaskList, CommandPalette, FloatingFocus and existing services/controllers. New boundaries limited to shared motion constants, route scroll retention, and service-backed summary completion if required. No new document model, preview subsystem or collaboration architecture.

## Baseline workflow

Today → running Focus: 2 actions including the existing intention confirmation (browser measured). Today → task details → return Today: open task, close modal, navigate Today (3). Home with no plan → running Focus: add focus, find planned card, start, confirm intention (3 actions plus visual search). Related saved attachment opens in one action within the lower editor content; return uses browser tab. Board filters persist via AppLayout but scroll resets on remount. Today has no direct completion action; its editor preserves the existing completion value, so completion requires another task/Focus surface. The acceptance report distinguishes browser-measured counts from source-verified paths.
