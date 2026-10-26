# Product UX acceptance

Decision: **UX PARTIAL**. The implemented core workflow passes local-mode functional qualification. Product-wide connected-service, live playback/PiP, native-window and physical-device qualification remains open; this is not a final P4 or release approval.

## Delivered increments

| Increment | Delivered |
| --- | --- |
| UX-1 | Contextual task URLs retain the originating route; fresh-load and stale-request guards; browser Back/close return; retained route/panel scroll; arrow/Enter/Escape command palette; Table and Focus commands. |
| UX-2 | Real planned/service-ranked task action leads Home; pins become secondary; Today puts work before statistics, collapses secondary groups, shares task actions across suggestions and plan; direct persisted completion with duplicate locking, failure feedback and reflow. Finished plan slots retain existing removal behavior. |
| UX-3 | Board/Calendar/Table share contextual editing; saved context links at the top of the editor; saved-task Focus action protects drafts; retained Calendar selection and Table sort; keyboard and pointer drag with persisted results and rollback coverage. |
| UX-4 | Shared finite motion tokens, reduced-motion sort/drop behavior, lifted card settling, Today layout/removal feedback, Dock layout spring and mode announcement. Existing indicator, mounted panels, intention/session controller and playback ownership retained. |
| UX-5 | Five reachable narrow-screen navigation destinations; scoped Dock base styles; prebuilt theme eliminates runtime typography overrides; workspace-shell loading; neutral loading copy and unavailable-task feedback. |

Existing components were extended rather than replaced. Reused: HomeDashboard, TodayPage/TodayTaskCard/TodayTaskSection, TaskDialog, KanbanBoard/TaskItem/TaskList, CalendarBoardView, TableView, BoardChrome, CommandPalette, AppNavigation, FloatingFocus, existing task/Focus/board services. New production boundaries: ViewContextBoundary/view-context, use-dialog-focus, use-summary-completion, shared motion tokens. Three focused unit files and one product workflow E2E file cover the new contracts. See [audit and inventory](audit.md) and [durable interaction rules](../../docs/task-workflow.md).

## Workflow comparison

| Workflow | Before | After |
| --- | --- | --- |
| Today → running Focus | 2 actions, including intention | 2; intentionally preserves session semantics |
| Home without a plan → running Focus | Add to Focus → Start → intention (3) | Start → intention (2), visible in the first viewport |
| Today → details → Today | Open → close → navigate Today (3) | Open → close/Escape (2), same originating pathname |
| Complete from Today | No direct completion; required another surface/session flow | 1 completion action; task retained on failure |
| Saved related document → task | Existing attachment link in lower editor content; return via tab | Named context link at editor top (1 action); close related tab retains the open task/draft |
| Calendar/Table switching | Shared filters already survived; month/sort reset on remount | Filters retained; month/day/sort and relevant scroll also retained in the mounted workspace |
| Board keyboard move | Pointer-only sensor | Grip: Space → arrows → Space, with live announcements and persisted positions |

The baseline browser receipt measured Today’s two-action Focus entry and the task-open route change. Other baseline paths above are verified against existing handlers and the prior briefing workflow. No AI recommendation text or production data was fabricated.

## Verification

- Full suite: **1,149 passed, zero failed**. Covers P3 and existing service/controller contracts as well as new snapshot ordering, cancellation, dirty draft and optimistic rollback regressions.
- Browser suite: **17 workflows**, zero unexpected failures or skips on the final static local-mode app. Includes existing CRUD/history/auth routing/briefing/Beat Grid checks plus contextual URLs, save/reload/complete, related document popup/return, Calendar/Table/filter retention, Focus timer and tab continuity, keyboard traps, reduced motion, pointer and keyboard movement, scroll restoration and unavailable-task feedback.
- Pointer drag, keyboard drag and narrow keyboard/focus workflows also passed twice each in independent fresh contexts before final qualification.
- Responsive matrix: **24 cases** (Home, Today, Board, Table, Calendar, Focus × 320/390/768/1280px), reduced motion enabled, no document horizontal overflow, all five navigation destinations present. Table/Board retain their own internal horizontal scrolling.
- TypeScript build check and isolated Vite production build pass. Final changed-file lint checks have zero errors/warnings. Broader application/server/E2E lint has zero errors and 29 warnings; the untouched baseline source has 31 warnings. Existing warnings were not suppressed or used to weaken checks.
- Independent review: stale overlays, dirty Focus entry and completion focus loss repaired; reviewer found no remaining product-code blocker. The misplaced JSON reporter receipt was copied to its declared location and the configuration corrected.
- Source ownership receipt: **83 protected music/Focus files unchanged**, including renderer/event/scheduler code and the Focus/session/PiP hooks. Existing extension/detector/model/compensation sources were not edited. Prior P3/P4 evidence remains untouched.

## Performance comparison

Historical UX candidate evidence, corrected from the retained final JSON receipt; this does not qualify the later integrated build. Three fresh Chromium contexts per build, same local static server and 4× CDP CPU throttling. Each runs Today → intention → Focus, nine Dock tab transitions, and a 3.5-second frame sample covering transitions. Medians unless stated:

| Metric | Baseline | UX candidate |
| --- | ---: | ---: |
| Today action-ready | 1,625 ms | 1,529 ms |
| Focus action → intention visible | 291 ms | 275 ms |
| Frame gap p95 | 16.8 ms | 16.8 ms |
| Worst sampled frame gap | 66.7 ms | 50.1 ms |
| Recorded long-task total | 736 ms | 911 ms |
| Reported JS heap | 12.7 MB | 12.7 MB |
| Dock host remounts during tabs | 0 | 0 |
| Timer remains running | Yes | Yes |

This is a small synthetic comparison, not proof on a physical low-end device. The increased aggregate long-task time remains a performance qualification concern; the samples do not establish a statistically reliable improvement or memory-leak result. No new continuous task-page animation or Beat timing loop was added. Final receipt/hash and any refreshed performance run are in the machine-readable evidence below.

## Combined application / P4 boundary

The new interface was built and tested together with the current P3 code. Beat browser checks confirm the normal four rows/32 cells, tab/route compatibility and absence of invented onsets without an audio source. Full unit regressions preserve semantic motion, event and Focus contracts. These checks do not replace acoustic or physical A/V evidence.

Not qualified here: authenticated Supabase/RLS/realtime and multi-member workflows; continuous real Companion/provider playback through the new UI; real document PiP transfer on supported owner browsers; native always-on-top/installed execution; 30-minute target-platform runs; calibrated A/V or a physical low-end device. Previous P4 results remain historical, with their existing limitations. The earlier release decision is not promoted by this UX work.

Recommendation: review and continue validation from this local UX branch. Keep unfinished detector experiments behind existing gates. Close connected-service, live playback/PiP, native and hardware qualification before a product-wide UX PASS or release decision. No deployment, installer publication, package distribution or production-data mutation was performed.

## Receipts and rollback

- [Plan / ownership](plan.md), [audit](audit.md)
- [Source hashes and changed-file inventory](../../scratch/product-ux-261026-1904/source-receipt.json)
- [Unit results](../../scratch/product-ux-261026-1904/unit-results.json), [browser results](../../scratch/product-ux-261026-1904/browser-results.json), [browser run](../../scratch/product-ux-261026-1904/browser-run.log)
- [Responsive cases](../../scratch/product-ux-261026-1904/responsive-results.json), [performance samples](../../scratch/product-ux-261026-1904/performance-results.json)
- [Before workflow](../../scratch/product-ux-261026-1904/baseline-browser.json), [Home before](../../scratch/product-ux-261026-1904/before-home.png), [Home after](../../scratch/product-ux-261026-1904/after-home.png), [Today after](../../scratch/product-ux-261026-1904/after-today.png), [mobile Home](../../scratch/product-ux-261026-1904/after-home-mobile.png)

Branch: `codex/product-ux-upgrade`. The inherited dirty workspace is preserved. No combined mass commit was created. Roll back only task-owned differences against `scratch/product-ux-261026-1904/baseline/src`, using the source receipt; do not reset the full dirty tree. Preview processes and dedicated automation browsers are stopped after verification.
