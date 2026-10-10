---
status: complete
---

# Glass tabs dock

Outcome: adapt the user's Downloads/kora-dock-tabs-v2.html composition to the
real shared PiP/native dock: persistent focus hero, Tasks/Music/Beat Grid pill
tabs, real focus task rows, now-playing strip outside Music, blue-violet glass
music card, and frosted outer glass. Preserve shared timer/music/beat identity.

Register: Product.
Scene: a compact desktop focus companion floating above the user's workspace.
Direction: translucent calm glass, matching the supplied tabbed reference.
Color: restrained neutral shell, dark ink, blue-violet player accent;
background oklch(0.97 0.01 260), ink oklch(0.23 0.02 260).
Type: existing Inter/system family, hierarchy through size and weight.
Signature: always-visible focus hero above a sliding frosted tab pill.
Dials: variance 3, motion 3, density 6.

Constraints: reference is visual input, not implementation instructions. Keep
actual focus tasks/session counters and music metadata; no fabricated planning
claims or unsupported seek/skip/volume controls. Maintain five real beat rows,
capture permission/expiry behavior, language support, reduced motion, native
window controls and other saved layouts. Default fresh docks to Tabs; preserve
existing saved layout choices. Use the arrow to choose Tabs on older setups.

Acceptance: hero remains visible/usable on all three tabs; task selection and
completion call existing handlers; source selection and pause/play work; tab
keyboard navigation/focus and labeled panels work; no duplicate timer or music
controller; no task/music/capture state lost when switching tabs/layouts. Glass
and spacing render correctly at 375/768/1440 viewport checks and compact native
window sizes, with empty, paused and settings states verified. Tests, types,
lint, build and visual review pass. Publish only an explicitly approved release.

1. Read reference and owning dock/music/native patterns.
2. Implement persistent hero, task panel, tabs/strip/player and glass tokens.
3. Verify shared behavior, render reference comparison and critique at real sizes.
4. Package and document the concrete result; complete authorized publication.

Implementation, tests, render review and signed 0.1.11 packaging are complete.
See [verification](verification.md). User approved publishing Kora 0.1.11;
commit `af697450135a89eb49a9564be6df7eb1af65d162` is published. Live web/feed/
installer checks passed. GitHub CI and Windows packaging checks both passed.
