# Design Guidelines — React Kanban (Focus-first)

> Living design-system reference. Phase 0 (visual foundation) + low-risk Phase 1
> (accessibility / control consistency). Layout-heavy work (navigation model, Home
> bento, TaskItem div→button, undo-delete) is intentionally **deferred** to later phases.

Product direction: **calm, focused, minimal** productivity workspace. Apple-HIG-inspired
clarity, Linear/GitHub-like control structure. Not a Trello/Jira/Notion clone.

---

## 1. Color

- **One neutral system: `slate-*`** is the primary neutral going forward.
  `gray-*` is legacy and should be migrated to `slate-*` opportunistically when a file is
  already being edited (do not do a risky global sweep).
- **One accent: blue/sky** (`blue-600` primary actions, `sky-*` focus rings/active states).
- **Semantic intent colors:** `emerald` (done/success), `amber` (warning/due-today),
  `rose`/`red` (destructive/overdue).
- Avoid introducing additional hues for decoration.

## 2. Radius

Prefer the standard Tailwind steps. Two documented semantic tokens exist in `index.css`:

| Token | Value | Use |
|-------|-------|-----|
| `--radius-card` | 16px (`rounded-2xl`) | cards, controls, inputs |
| `--radius-panel` | 24px | large panels / dialogs |

- **Allowed:** `rounded-md (6) / lg (8) / xl (12) / 2xl (16) / 3xl (24) / full`.
- **Avoid** new arbitrary values like `rounded-[1.35rem]`, `rounded-[32px]`, `rounded-[36px]`.
  Existing arbitrary radii are left in place for now (cosmetic, low priority) and should be
  normalized when their component is next touched.

## 3. Shadow

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-card` | `0 10px 28px rgba(15,23,42,0.07)` | standard card/surface |
| `--shadow-focus-surface` | `0 20px 60px rgba(15,23,42,0.25)` | **Focus Dock / Floating Timer only** |

- Default to subtle card shadow. Reserve the heavy/dramatic shadow for the focus surfaces.
- Avoid stacking large `shadow-[0_28px_90px...]` on ordinary content; normalize when touched.

## 4. Glass / backdrop-blur

- **Restricted to Focus Dock and Floating Timer.** Those are the "depth" surfaces — keep their blur.
- Other surfaces should trend toward flat/subtle. Existing `backdrop-blur` on headers/panels is
  left untouched in this phase (removing it touches layout-heavy areas) but **do not add new** glass.

## 5. Gradients

- Avoid decorative/random gradients. Existing radial gradients on Auth/Today/Onboarding are
  cosmetic and deferred; **do not add new** gradients.

## 6. Eyebrow tracking

Standardize labels/eyebrows to **two** values:

- `tracking-[0.2em]` — default eyebrow / section label.
- `tracking-[0.28em]` — hero / page-level eyebrow.

(Existing one-off values like `0.16em`/`0.22em`/`0.24em` are normalized when a component is touched.)

## 7. Motion (accessibility)

- **CSS animations/transitions** honor `prefers-reduced-motion: reduce` globally via `index.css`
  (durations collapse to ~0; rules are not deleted, so state still changes).
- **Framer Motion** (JS-driven) honors reduce-motion per component via `useReducedMotion()`.
  Applied so far: `AppleCard` (hover/tap scale), `HomeDashboard` animated day counter.
- Do not remove purposeful animation — just provide a reduced/instant alternative.

## 8. Controls — the cursor/hover/focus contract

Every clickable control must be **visually discoverable and keyboard-operable**:

- `cursor-pointer` on hover for enabled controls.
- A clear **hover** state.
- A clear **`focus-visible`** ring (we use `focus-visible:ring-2`/`ring-4` with a sky/slate tint).
- Disabled controls: **`disabled:cursor-not-allowed`** + **`disabled:opacity-60`**.
- Prefer real `<button>` over clickable `<div>`. If a `<div>` must stay clickable, it needs
  `role="button"`, `tabIndex`, keyboard handling, and `cursor-pointer`.
  *(Note: the TaskItem card-as-div is a known exception, deferred to Phase 2 because it also
  hosts drag-and-drop.)*

### Shared primitives

- **`Button`** (`atoms/Button.tsx`): all variants now share a base with `focus-visible` ring +
  `disabled:cursor-not-allowed disabled:opacity-60` + `cursor-pointer`. Supports a `disabled` prop.
- **`ButtonIcon`** (`atoms/ButtonIcon.tsx`): reusable icon-only button. **Requires `label`**
  (renders `aria-label`), ships consistent cursor/hover/focus/disabled affordances.

## 9. Icon-only controls & decorative SVGs

- Icon-only buttons **must** have an `aria-label` (and usually a matching `title`).
- Purely decorative SVGs **must** have `aria-hidden="true"` so screen readers skip them.

## 10. Dialogs (low-risk a11y this phase)

- Base `ContentDialog` now sets `role="dialog"` + `aria-modal="true"`; backdrop is `aria-hidden`.
- Close buttons have `aria-label`.
- **Deferred:** full focus-trap, Escape-to-close, and return-focus (modal architecture rewrite)
  — planned for a later phase.

---

## Deferred (NOT in this phase)

Phase 2+: TaskItem `div→button`, global navigation model, Home bento redesign, undo-delete,
full dialog focus-trap, full `gray→slate` + arbitrary-radius/gradient/glass sweep across
layout-heavy areas.
