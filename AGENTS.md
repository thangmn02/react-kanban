# Browser automation and preview process lifecycle

- Use a dedicated automation browser: Chrome for Testing or a browser managed
  by Playwright. Use a separate automation profile; never use the user's daily
  Chrome, Edge, or other personal browser profile for automated tests.
- Wrap browser ownership in `try/finally` and await `browser.close()` in
  `finally`, including failure and cancellation paths. Close persistent browser
  contexts with `context.close()` in their owning `finally` block.
- Before launching a preview server, check the intended port and reuse an
  existing server only when its project and owner are known. Record the command,
  PID, creation time, port, and worktree of every process started.
- Stop preview servers and watchers started for the task when the task ends.
  Use the owning terminal/session's graceful stop mechanism first and wait for
  the server and its children to exit. Close owned automation browsers through
  their controller so browser children can exit normally.
- Never kill browsers or servers in bulk by executable name. Never stop a
  personal browser, another session's process, or an unknown owner. For cleanup
  of existing processes, inventory them and obtain approval for the exact scope
  before stopping anything.
- Before stopping an individual orphan PID, recheck its executable, command,
  creation time, parent identity, and ownership to guard against PID reuse.
  A missing launcher or an old start time alone does not establish abandonment.
  Attempt graceful shutdown first; use forced termination only as a last resort
  for an identified orphan within the approved scope.
- Delete only an identified temporary automation profile, after checking that
  no process still uses it directly or through its browser parent/context.
  Verify the resolved absolute path is inside the intended temporary directory
  and is not a personal profile or a link to one. If usage or ownership cannot
  be established, leave the profile in place.

<!-- ASTRYX:START -->
Astryx v0.1.9 · 153 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   153 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

## Kora integration scope

Preserve Kora's established shell, palette, workflows and public component contracts. The upstream Astryx section above is discovery guidance; its blanket layout/style replacement rules do not authorize a repository-wide migration. Existing Tailwind wrappers and specialized CSS remain valid. Do not replace the centered employee profile, TipTap editor, Notes repository/durability, Tauri window management, DnD, Focus/audio ownership or frozen Beat Grid contracts to increase adoption.

Before a new generic control, use the pinned project CLI to search components, read its exact API, and consult tokens/theme references. Inspect templates for complex layouts, then adopt only the necessary primitive with a concrete accessibility or maintenance benefit. Preserve keyboard/focus behavior and verify affected browser and Windows surfaces. Project instructions and the user's scope take precedence over upstream examples. Keep the official CLI as the API authority instead of copying its reference documentation into this repository.

Read [Kora's design-system guide](docs/design-system.md) for the supported version, commands, CSS layers, token ownership and validation route. This is the lightweight project discovery pointer; do not create a second copied component catalog.
