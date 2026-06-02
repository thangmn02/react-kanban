# Session Handoff — React Kanban (Focus-first)

> Purpose: let a fresh session continue without re-discovering context.
> Last updated: 2026-06-01. Read this top-to-bottom before doing anything.

---

## CURRENT HANDOFF (2026-06-01) — Quiet Velocity UI rollout

### Where we are
Running the **Quiet Velocity UI** redesign (design language: "Calm surface, decisive execution";
signature concept = **Focus Layer**, reserved ONLY for focus surfaces). Spec lives at
`.kiro/specs/quiet-velocity-redesign/` (requirements.md, design.md, tasks.md). Every phase gates on
`npm run build` (exit 0) + `npm run lint` (0/0) + `hig-doctor` audit + manual QA. NOT a clone of
Apple/Linear/Notion/Trello/Jira/Raycast/Superhuman — borrow principles only.

### Phase status
- **Phase 0 — Design Lab**: DONE. Preview-only routes `/design-lab/quiet-{home,today,board,focus}` in
  `src/design-lab/`. Gated by `shouldMountDesignLab()` (dev OR `VITE_ENABLE_DESIGN_LAB==="true"`),
  branched in `main.tsx` before `<App/>`. Do NOT change this guard.
- **Phase 0.5 — Lab refinement**: DONE. Promoted canvas token `--color-canvas:#f8f9fa` (→ `bg-canvas`)
  in `index.css`; focus-first quiet-home; contrast fixes.
- **Phase 1 — Shared surfaces**: DONE + reviewed + **COMMITTED** (`cfb603f`). App shell `bg-canvas`,
  AppHeader/Auth/Onboarding/ProtectedRoute polish, focus-visible standardization, shadow normalization.
- **Phase 2 — Home + Today**: DONE + reviewed, **UNCOMMITTED**. Focus-first "Focus Now" hero on Home
  (uses `myTasks[0]` + existing `onOpenTask`/`onToggleFocusTask`; no-task empty state). Today numbered
  focus plan + token/focus polish. Files: `HomeDashboard.tsx`, `MyTasksSummary.tsx`, `TodayPage.tsx`,
  `TodayTaskCard.tsx`.
- **Phase 3A — Board shell + columns**: DONE, **UNCOMMITTED**. `bg-canvas` on board surfaces, arbitrary
  shadows → `shadow-card`/`shadow-md`, focus-visible + eyebrow tracking normalization, add-task focus
  ring. Files: `KanbanBoard.tsx`, `TaskList.tsx`, `BoardHeader.tsx`, `BoardTabs.tsx`, `QuickSearch.tsx`,
  `BoardEmptyState.tsx`. NO dnd-kit wiring touched.

### Gates: build exit 0, lint 0/0, hig-doctor board/today/home 0 critical (all green as of this handoff).

### NEXT: Phase 3B — Task card polish (`src/components/task/TaskItem.tsx`)
- Visual-only: arbitrary `hover:shadow-[0_18px_48px…]` → `hover:shadow-md`; assignee-menu
  `shadow-[0_18px_60px…]` → `shadow-md`; Focus-toggle button `focus:ring`→`focus-visible:ring`;
  metadata/badge calm polish.
- **CRITICAL — preserve dnd-kit**: do NOT touch `useSortable`, `setNodeRef`, `{...attributes}`,
  `{...listeners}`, `transform`/`transition` style, `isDragging`/`isOverlay` branches, `stopPropagation`,
  or `onPointerDown`. Do NOT convert the inner `role="button"` div → `<button>` (that's deferred 3C,
  unproven safe). Manual drag QA gate required (within list / across lists / reorder lists / overlay).
- **Phase 3C** (inner div→button a11y conversion): DEFERRED until DnD-safety can be proven.

### First actions for the new chat
1. Read this section + `docs/design-guidelines.md` + `.kiro/specs/quiet-velocity-redesign/*`.
2. **Recommend committing Phase 2 + 3A first** so the DnD-coupled 3B gets an isolated diff. Suggested:
   `git add` the 10 files → `feat(ui): quiet velocity phase 2 (home+today) + phase 3A (board shell)`.
   (User commits explicitly — ask first; pushing not done.)
3. Confirm gates green, then proceed to Phase 3B as a separate, carefully-reviewed unit.

### Pattern notes / gotchas
- **React Compiler lint** is strict: avoid synchronous `setState` in effects and `useCallback` dep
  mismatches. The Home/Today data effects keep an **opaque inline-fetch in `useEffect`** (not the
  extracted callback) specifically to satisfy `react-hooks/set-state-in-effect`. Don't "simplify" that.
- **react-refresh/only-export-components**: a `.tsx` file must export only components — put helpers in a
  separate `.ts` (see `showUndoToast.ts`, `isDesignLabRoute.ts`).
- Windows + PowerShell: use `;` not `&&`. `.env` is gitignored (verified) — safe to `git add .`.
- hig-doctor flags hardcoded dark-surface colors as "critical" but that's N/A for this web app (focus
  surfaces intentionally use `bg-slate-900`). Use it for a11y/structure signal.

---

## 0. TL;DR — current state

- **Project**: React 19 + TypeScript + Vite + Tailwind **v4** (CSS `@theme`, NO `tailwind.config`) Kanban / focus-productivity app. Supabase backend.
- **Product direction**: *Focus-first Kanban for individuals & small teams.* Help users **finish** tasks, not just organize. NOT a Trello/Jira/Notion clone.
- **Two big work streams completed**, both **uncommitted** in the working tree:
  1. **Codebase refactoring** (behavior-preserving) — spec at `.kiro/specs/codebase-refactoring/` (all 51 tasks done).
  2. **UI Phase 0 + low-risk Phase 1** (design tokens + a11y polish) — done, reviewed, 10/10 pass.
- **Gates green**: `npm run build` → exit 0; `npm run lint` → exit 0 (0 errors/0 warnings).
- **NOTHING is committed yet.** `git diff HEAD` mixes both work streams. Recommend committing before more work.

---

## 1. Environment & conventions

- OS: Windows, shell: cmd/PowerShell. Use `;` not `&&`. Use dedicated file tools, not cat/sed.
- Build: `npm run build` (`tsc -b && vite build`). Lint: `npm run lint` (`eslint .`). **No test framework.**
- Verification model: build + lint + code review (no automated tests; do NOT invent a test suite).
- Pre-existing acceptable build note: Vite ">500 kB chunk" advisory — informational, not an error.
- **Workflow rule the user set**: before any task, scan `.agent/` for a relevant persona/skill and apply it; if none, proceed. Personas available: `code-reviewer`, `code-simplifier`, `debugger`, `fullstack-developer`, `planner`, `project-manager`, `tester`, `ui-ux-designer`, plus `SKILL.md` (ck:find-skills). These are reference markdown, not auto-loaded skills.

### MCP: `hig-doctor` (connected)
Apple HIG guidance + audit. Tools:
- `hig_list_skills`, `hig_lookup(skill, topic?)`, `hig_audit(directory, fail_on?)`.
- Note: it scores against Apple-native conventions; this is a **web app**, so "hardcoded color / no dark mode" criticals are largely N/A. Use it for a11y/structure signal, not literal compliance.
- `hig_audit` baseline history on `src/`:
  - Before UI work: **26 critical / 7 serious / 619 positives**.
  - After Phase 0/1: **6 critical / 7 serious / 656→735 positives** (`gateTripped: false`).
  - Remaining 6 critical = deferred items (3 clickable `<div>` in TaskItem/TaskList + arbitrary radii/gradients/glass on layout-heavy pages).

---

## 2. What's been done

### A. Codebase refactoring (spec: `.kiro/specs/codebase-refactoring/`)
Behavior-preserving. Key outcomes:
- Created **`src/constants/`** (board, task, focus, pomodoro, commandPalette, messages, index) — single source of truth for magic values (LIST_POSITION_STEP, TASK_PRIORITIES, DEFAULT_TASK_PRIORITY, DEFAULT_TASK_CATEGORIES, STORAGE_KEYS, MAX_FOCUS_TASKS, FOCUS_LIMIT_MESSAGE, POMODORO_MODES, FOCUS_BUTTON_LABELS, DEFAULT_BOARD_TITLE, COMMAND_PALETTE_ACTION_CONFIG, ERROR_MESSAGES).
- **Decomposed `App.tsx` 1721 → ~947 lines** into hooks: `useViewRouting`, `useBoardDataManagement`, `useTaskOperations`, `useFocusTaskHandlers`, `useCommandPaletteActions`, `useAppDialogState`, plus `useTaskActivityData` (TaskDialog).
- Consolidated service/mapper logic (task.service normalizers, boardDataMapper `applyTaskDefaults` + removed dead `void attachments`, decomposed `buildBoardDataFromRows` & `seedDefaultBoard`, shared `readFromLocalStorage`).
- Renames (atomic): `handleBoardDataChange→handleBoardPositionChange`, `resolveDestinationListId→findValidDestinationListId`, `focusTasksWithLiveData→focusTasksWithCurrentBoardState`, removed `renderAppHeader` wrapper → `appHeader` element var.
- TaskDialog: consolidated `formDrafts`, `resetDialogState(mode)`, `addDraftItem`, extracted `utils/idGenerator.ts` + `utils/timeFormatting.ts`.
- KanbanBoard props regrouped into `filters` / `ui` / `handlers`.
- Docs written: `REFACTORING_CHANGES_EXPLAINED.md` (Vietnamese, detailed, incl. the task-7.4 lint-regression story).

### B. UI Phase 0 + low-risk Phase 1 (this session)
Files changed:
- `src/index.css` — added `@theme` tokens: `--radius-card:1rem`, `--radius-panel:1.5rem`, `--shadow-card`, `--shadow-focus-surface`; global `@media (prefers-reduced-motion: reduce)` guard.
- `src/components/atoms/Button.tsx` — all variants: `cursor-pointer` + `focus-visible:ring-*` + `disabled:cursor-not-allowed disabled:opacity-60`; added `disabled` prop.
- `src/components/atoms/ButtonIcon.tsx` — rebuilt as accessible IconButton: **required `label`** (→aria-label), `onClick`/`disabled`/`title`, focus/hover/disabled states. (Currently has 0 importers — safe.)
- `src/components/atoms/AppleCard.tsx` — `useReducedMotion()` gate on hover/tap motion.
- `src/components/organisms/HomeDashboard.tsx` — `useReducedMotion()` gate on `AnimatedDayCount`.
- `aria-hidden="true"` added to decorative SVGs in: DueDateBadge, QuickSearch, BoardActivityDialog, DeleteDialog, TaskItem, TaskList, TaskCard, TaskDialog (close), WorkspaceMembersDialog (close).
- `aria-label` + focus rings added to icon-only buttons in: QuickSearch (clear), BoardActivityDialog (close), TaskItem (edit/delete/assignee + haspopup/expanded), TaskList (3-dot menu + haspopup/expanded), TaskDialog (close).
- `src/components/molecules/dialog/ContentDialog.tsx` — added `role="dialog"`, `aria-modal="true"`, backdrop `aria-hidden`. (No focus-trap yet — deferred.)
- Docs: `docs/design-guidelines.md` (token system + control contract), updated `docs/SESSION_HANDOFF.md` (this file).

---

## 3. Design system rules (from docs/design-guidelines.md)
- **Color**: `slate` neutral + `blue/sky` accent. `gray-*` is legacy → migrate to `slate-*` only when a file is already being edited (no risky global sweep).
- **Radius**: use `md/lg/xl/2xl/3xl/full`; avoid new arbitrary `[1.35rem]/[32px]/[36px]`.
- **Shadow**: subtle `--shadow-card` for cards; heavy `--shadow-focus-surface` ONLY for Focus Dock / Floating Timer.
- **Glass/backdrop-blur**: ONLY Focus Dock + Floating Timer. Do NOT add new glass; do NOT remove from those two.
- **Gradients**: don't add new decorative gradients.
- **Eyebrow tracking**: standardize to `0.2em` (section) / `0.28em` (hero).
- **Control contract**: every clickable control needs cursor-pointer + hover + focus-visible + (disabled → cursor-not-allowed + opacity). Prefer real `<button>`. Icon-only → aria-label. Decorative SVG → aria-hidden.

---

## 4. HARD CONSTRAINTS — do not change (carried across all phases)
Supabase schema · Auth logic · RLS · workspace/members/invite flow · Kanban CRUD · drag/drop behavior (dnd-kit) · realtime sync · Focus Dock/Pomodoro state · localStorage keys/shapes · routing behavior.

---

## 5. Pending UI redesign roadmap (audit-derived)

Phases 0 + low-risk-1 are DONE. Remaining:

- **Phase 2 — Task card & board polish (MEDIUM risk, RECOMMENDED NEXT).**
  - `TaskItem` clickable `<div>` (around L89) → real `<button>` / `role=button` + tabIndex + Enter/Space to open. **Must preserve dnd-kit drag**: drag listeners are on the OUTER wrapper (`setNodeRef` + `attributes`/`listeners`), the click-to-open is the INNER div — separate them cleanly so dragging still works.
  - `TaskList` has a similar drag-handle div (legit — it's the grab handle, `cursor-grab`).
  - Bump task action touch targets toward ~44px.
  - Opportunistic `gray-*`→`slate-*` on TaskItem/TaskList/TaskCard.
  - These clear the remaining 3 hig-doctor "concern" divs.
  - **Suggest doing this as a small spec** (requirements→design→tasks), like the refactoring, due to drag/drop coupling.
- **Phase 3 — Navigation unify (HIGH risk).** One persistent left rail (Home/Today/Board/Calendar) + workspace switcher across all pages; remove Home-only sidebar; mobile nav (bottom bar/hamburger). Clarify Command Palette vs QuickSearch. Do NOT change routing logic, only presentation.
- **Phase 4 — Focus-first Home bento (MEDIUM–HIGH).** Reorder dashboard around "today/now focus".
- **Phase 5 — Status & feedback (MEDIUM).** Skeleton loaders + undo-delete toast (replaces confirm dialogs). Undo must not touch localStorage/schema.
- Also deferred: full dialog focus-trap/Escape/return-focus (modal architecture).

---

## 6. Known issues / honest caveats
- **Working tree not committed** — both refactoring + UI Phase 0/1 are mixed. `git diff HEAD` is noisy. **Strongly recommend committing** (ideally two commits: refactoring, then UI polish) before starting Phase 2 so reviews have a clean baseline.
- `ButtonIcon` `label` is now required (type-breaking) — fine now (0 importers), keep in mind when adopting it.
- Global reduce-motion CSS is broad (collapses all durations) — verify dropdowns/toasts still feel right with OS "Reduce Motion" on (manual visual check).
- No automated tests exist — all verification is build + lint + review.

---

## 7. Recommended first actions for the new session
1. Read this file + `docs/design-guidelines.md`.
2. (If user agrees) commit the current working tree as a clean baseline.
3. Confirm gates: `npm run build`, `npm run lint`.
4. Scan `.agent/` for the relevant persona before starting (per user's standing rule).
5. If proceeding to Phase 2: draft a small spec under `.kiro/specs/` (e.g. `task-card-a11y`) — requirements → design → tasks — paying special attention to preserving dnd-kit drag while making the card keyboard-openable.

---

## 8. Key file map
- `src/App.tsx` — thin composition root (~947 lines).
- `src/constants/` — centralized constants (barrel `index.ts`).
- `src/hooks/` — useViewRouting, useBoardDataManagement, useTaskOperations, useFocusTaskHandlers, useCommandPaletteActions, useAppDialogState, useTaskActivityData, useFocusTasks, usePomodoroTimer, useDocumentPictureInPicture, useAuth, useWorkspaceSession, useWorkspaceMembers, useTaskRealtime, useDueDateReminder.
- `src/components/atoms/` — Button, ButtonIcon, AppleCard, DueDateBadge, Typography.
- `src/components/task/` — TaskItem (clickable-div, Phase 2 target), TaskList, TaskCard, TaskListOverlay.
- `src/components/focus/` — FocusDock, FocusDockHeader, PomodoroTimer, PomodoroModeSwitch, FocusTaskMiniCard, FocusLimitToast (glass surfaces — keep blur).
- `src/components/molecules/dialog/ContentDialog.tsx` — base dialog (focus-trap deferred).
- `src/services/` — *.service.ts (DO NOT change behavior; constants wired in).
- `docs/` — REFACTORING_SPECIFICATION_REPORT.md (audit source), REFACTORING_CHANGES_EXPLAINED.md, design-guidelines.md, SESSION_HANDOFF.md (this), sql/.
- `.kiro/specs/codebase-refactoring/` — completed spec (requirements/design/tasks/.config.kiro).
