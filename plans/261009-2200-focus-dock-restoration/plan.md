# Focus dock restoration

Superseded navigation decision: the later [unified Focus plan](../261010-0123-unified-focus-lead/plan.md)
intentionally replaces separate Music/Beat Grid pages with internal Focus tabs.
The preservation of the original dock and explicit pop-out remains applicable.

Stop the unaccepted motion exploration. Preserve its source and ignored captures,
but remove its mount from the actual dock. No new visual direction or deployment.

Restore the existing task-gated compact island and user-invoked Document PiP
workflow. Normal feature routes must use their existing content components, not
mount an additional FloatingFocus timer. Keep the shared Focus session owner.
The clarified issue concerns Home's Music / Beat Grid / Focus navigation, not
internal dock tabs. Preserve the original internal tab visibility and DOM state.

- [x] Inspect route history, local diffs, island, tabs and PiP lifecycle.
- [x] Remove prototype mount; restore empty-browser-island policy.
- [x] Separate normal route content from the pop-out dock; preserve internal tabs.
- [x] Verify focused regressions, normal routes, real PiP, timer continuity,
      minimize/restore/dismiss and distinct tab contents using Playwright MCP.
- [x] Record concise evidence, limitations and exact changed files; stop.

Evidence: [restoration report](../reports/validation-261009-2200-focus-dock-restoration.md).

Safety boundary: no detector, model, scheduler, backend, CSS flash-duration or
pattern-lifetime changes. No native GUI claim without actual native execution.
