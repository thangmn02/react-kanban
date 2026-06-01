# Requirements Document

## Quiet Velocity UI Redesign

> **Design language**: *Quiet Velocity UI* — "Calm surface, decisive execution."
> **Scope**: An original, behavior-preserving visual/UX redesign of the existing React 19 + TypeScript
> + Vite + Tailwind v4 (`@theme`, no `tailwind.config`) + Supabase focus-first Kanban app.
> **Mode of this document**: planning artifact. No production UI is edited by creating this spec.
> It extends `docs/design-guidelines.md` (living source of truth) and carries the HARD CONSTRAINTS
> from `docs/SESSION_HANDOFF.md` §4.
> **Verification model**: no automated test framework exists. Every implementation phase gates on
> `npm run build` (exit 0) + `npm run lint` (0 errors / 0 warnings) + code review + `hig-doctor` audit.

## Introduction

This feature defines a premium, original UI/UX direction — **Quiet Velocity UI** — for the focus-first
Kanban workspace. The product's thesis is that it helps users *finish* tasks, not merely organize them.
The redesign expresses that thesis through a **Focus Layer** concept: ordinary planning surfaces stay
quiet, structured, and readable, while focus-related surfaces feel slightly elevated, active, and
intentional. A user should understand what to do next within a few seconds of opening the app.

The direction **borrows principles** (not appearance) from several admired products: Apple-like clarity
and restraint, Linear-like precision and productivity density, Notion-like calm writing and helpful
empty states, Raycast-like keyboard-first command experience, and Superhuman-like fast, premium focus
feel. It **must not clone** any of them — no copied layouts, sidebars, palettes, gradients, card styles,
typography, motion signatures, or product structure.

The redesign is **presentation-only**. It changes no backend, schema, auth, RLS, realtime, drag/drop,
Focus/Pomodoro state logic, localStorage shapes, routing behavior, or task payload shapes. It is
delivered in safe, reviewable phases, each independently revertible, with a Phase 0 design-lab that
adds preview-only routes and changes no production behavior at all.

This document covers: the product design diagnosis, the Quiet Velocity design-system requirements, the
UX principles the redesign must satisfy, the component-level redesign plan, the phased delivery model,
per-phase acceptance criteria, explicit non-goals, and the agent rules that constrain execution.

## Glossary

- **Application**: The React + TypeScript + Vite + Supabase focus-first Kanban single-page app.
- **Quiet Velocity UI (QV)**: The design language defined by this spec. Calm surface, decisive execution.
- **Focus Layer**: The visual treatment that distinguishes active-focus surfaces (Focus Dock, Pomodoro,
  Floating Timer, focus session summary) from quiet planning surfaces. Focus Layer surfaces are slightly
  elevated, use the reserved depth shadow, and may use restrained glass; quiet surfaces stay flat.
- **Quiet Surface**: Any non-focus planning/reading surface (board, Today, Home, dialogs, lists). Flat,
  low-chroma, hairline-bordered.
- **Design Lab**: Preview-only routes that render redesigned components in isolation, gated so they do
  not alter production behavior or default routing.
- **Design Token**: A named style value (color, spacing, radius, shadow, type step) consumed via Tailwind
  v4 `@theme` in `src/index.css` or documented in `docs/design-guidelines.md`.
- **Control Contract**: The mandatory affordance set for every interactive control (cursor-pointer when
  enabled, visible hover, visible focus-visible ring, disabled cursor-not-allowed + reduced opacity,
  real `<button>` for actions, `aria-label` for icon-only controls).
- **HARD CONSTRAINTS**: The list of subsystems that must not change (schema, auth, RLS, workspace/
  members/invite flow, Kanban CRUD, drag/drop, realtime, Focus/Pomodoro state, localStorage, routing,
  task payloads), carried verbatim from `docs/SESSION_HANDOFF.md` §4.
- **Reduced_Motion**: The state where the OS/browser reports `prefers-reduced-motion: reduce`.
- **Phase Gate**: The required checks at the end of each implementation phase (`npm run build`,
  `npm run lint`, `hig-doctor` audit, manual QA).
- **Brand Cloning**: Reproducing another product's distinctive visual identity (layout, palette,
  gradient, card style, typography, motion signature, or structure). Prohibited.

## Requirements

### Requirement 1: Product design diagnosis

**User Story:** As a product owner, I want an honest diagnosis of the current UI, so that the redesign
targets real gaps without re-touching risky areas prematurely.

#### Acceptance Criteria

1. THE design document SHALL record what the current UI does well (calm slate neutral system, single
   blue/sky accent, subtle card shadow, reserved glass/heavy shadow for focus surfaces, established
   control contract, accessibility foundation).
2. THE design document SHALL record what still feels generic (undifferentiated card styling, flat
   information hierarchy on Home, weak focus-first signaling, decorative gradients/glass leaking onto
   non-focus surfaces, inconsistent eyebrow trackings and arbitrary radii).
3. THE design document SHALL record what prevents the app from feeling distinctive (absence of a named
   visual identity, no clear Focus Layer signal, first-impression-after-login does not orient the user
   to "what to do next").
4. THE design document SHALL record what must not be redesigned yet because it is risky (dnd-kit task
   card structure, navigation-model unification, full dialog focus-trap, any HARD CONSTRAINT subsystem),
   with the reason each is deferred.

### Requirement 2: Quiet Velocity design system

**User Story:** As a UI engineer, I want a documented Quiet Velocity design system, so that every surface
is built from one consistent, original token set rather than ad-hoc values.

#### Acceptance Criteria

1. THE design document SHALL state a design philosophy for Quiet Velocity UI ("calm surface, decisive
   execution") and the Focus Layer principle that separates quiet planning surfaces from active focus
   surfaces.
2. THE design system SHALL define color tokens built on the existing slate-neutral plus single blue/sky
   accent and the semantic intent colors (emerald success, amber warning/due-today, rose destructive/
   overdue), without introducing decorative hues and without changing the meaning of any existing token.
3. THE design system SHALL define a typography hierarchy (page title, section heading/eyebrow, body,
   meta/caption) with concrete size, weight, tracking, and color conventions.
4. THE design system SHALL define a spacing scale aligned to the Tailwind 4px step system and forbid new
   one-off pixel values on touched surfaces.
5. THE design system SHALL define a radius scale limited to the allowed Tailwind steps plus the two
   documented semantic tokens (`--radius-card`, `--radius-panel`) and forbid new arbitrary radii.
6. THE design system SHALL define a border system (slate hairline conventions for quiet surfaces and
   dashed borders for empty/placeholder states).
7. THE design system SHALL define a shadow/elevation system with exactly two tiers: the subtle card
   shadow for quiet surfaces and the reserved heavy shadow for Focus Layer surfaces only.
8. THE design system SHALL define Focus Layer rules specifying which surfaces qualify, what elevation/
   glass treatment they receive, and that no quiet surface may adopt that treatment.
9. THE design system SHALL define task-surface rules (task card readability, metadata, badges, actions)
   that preserve the existing drag/drop structure.
10. THE design system SHALL define dashboard-surface rules (Home and Today hierarchy that signals
    focus-first priorities).
11. THE design system SHALL define command-surface rules (keyboard-first command/search affordance).
12. THE design system SHALL define motion rules that honor `prefers-reduced-motion` for both CSS and
    Framer Motion, providing a reduced/instant alternative rather than removing purposeful motion.
13. THE design system SHALL define responsive rules with breakpoints for mobile (320px+), tablet
    (768px+), and desktop (1024px+).
14. THE design system SHALL define accessibility rules (WCAG 2.1 AA contrast, 44×44px minimum touch
    targets on mobile, focus-visible rings, icon-only `aria-label`, decorative `aria-hidden`).

### Requirement 3: UX principles the redesign must improve

**User Story:** As a user, I want the redesign to make the app feel calmer, faster, and more focused,
so that I can decide what to work on and start within seconds.

#### Acceptance Criteria

1. THE design document SHALL define how the redesign improves the first impression after login (the
   landing surface orients the user to their next action quickly).
2. THE design document SHALL define how the redesign improves clarity of the Today / My Day surface.
3. THE design document SHALL define how the redesign strengthens focus-first positioning across the app.
4. THE design document SHALL define how the redesign improves task card readability.
5. THE design document SHALL define how the redesign improves command/search clarity.
6. THE design document SHALL define how the redesign makes the focus timer distinctive via the Focus Layer.
7. THE design document SHALL define how the redesign improves empty, error, and loading quality.
8. THE design document SHALL define how the redesign improves mobile usability.

### Requirement 4: Component-level redesign plan

**User Story:** As a UI engineer, I want a per-component redesign plan, so that each surface has a clear
verdict (keep / polish / redesign) and a justification before any code is written.

#### Acceptance Criteria

1. THE design document SHALL assign a redesign verdict and justification to each of: App shell, Header,
   Navigation, Home dashboard, Today page, Board columns, Task cards, Task detail drawer, Focus Dock,
   Floating Timer, Command Palette, Members panel, Auth page, Onboarding page.
2. THE design document SHALL assign a redesign verdict and justification to each shared primitive: Empty
   states, Error states, Skeletons, Toasts, Buttons, Inputs, Badges.
3. WHERE a component is coupled to a HARD CONSTRAINT subsystem (e.g. Task cards with dnd-kit, Focus Dock
   with timer state), THE plan SHALL state explicitly which structures must be preserved and how the
   visual change avoids touching them.
4. THE plan SHALL prefer reusing or generalizing existing primitives over introducing new components
   where duplication already exists.

### Requirement 5: Phased implementation model

**User Story:** As a maintainer, I want the redesign broken into safe, ordered phases, so that each
change is small, reviewable, and revertible.

#### Acceptance Criteria

1. THE plan SHALL define Phase 0 as a design-lab that adds preview-only routes and changes no production
   behavior, routing default, or shipped surface.
2. THE plan SHALL define Phase 1 as shared-surface work (app shell background, header polish, PageHeader,
   Button/IconButton, EmptyState, ErrorState, Skeleton, Toast, Auth/Onboarding polish).
3. THE plan SHALL define Phase 2 as Home and Today work (focus-first dashboard, Today planning surface,
   focus stats, upcoming/due tasks, quick capture if present).
4. THE plan SHALL define Phase 3 as Board and task card work (board hierarchy, column polish, task card
   readability, metadata/badges/actions) that preserves drag/drop.
5. THE plan SHALL define Phase 4 as Focus surface work (Focus Dock, Pomodoro, Floating Timer,
   FocusTaskMiniCard, focus session summary).
6. THE plan SHALL define Phase 5 as final QA (build, lint, hig-doctor, manual responsive pass, drag/drop
   pass, reduced-motion pass).
7. THE plan SHALL order phases so that each phase depends only on already-completed phases, and SHALL
   state a rollback note for each phase.

### Requirement 6: Per-phase acceptance criteria

**User Story:** As a reviewer, I want explicit acceptance criteria per phase, so that "done" is
observable and the safety constraints are verifiable.

#### Acceptance Criteria

1. FOR each phase, THE plan SHALL state what changes in that phase.
2. FOR each phase, THE plan SHALL state what must stay unchanged in that phase.
3. FOR each phase, THE plan SHALL state the validation commands (`npm run build`, `npm run lint`, and
   `hig-doctor` audit where available).
4. FOR each phase, THE plan SHALL state a manual QA checklist.
5. FOR each phase, THE plan SHALL state the rollback risk.
6. THE plan SHALL require, as a global gate on every phase, that `npm run build` exits 0 and
   `npm run lint` reports 0 errors / 0 warnings, and that no new arbitrary radii, gradients, or glass
   are introduced outside Focus Layer surfaces.

### Requirement 7: Non-goals

**User Story:** As a maintainer, I want explicit non-goals, so that the redesign cannot expand into
risky or out-of-scope changes.

#### Acceptance Criteria

1. THE plan SHALL state that no backend changes are in scope.
2. THE plan SHALL state that no database schema changes are in scope.
3. THE plan SHALL state that no auth or RLS changes are in scope.
4. THE plan SHALL state that no product feature expansion is in scope.
5. THE plan SHALL state that no brand cloning of any referenced product is permitted.
6. THE plan SHALL state that no full rewrite is in scope.
7. THE plan SHALL state that no drag/drop rewrite is in scope.

### Requirement 8: Agent execution rules

**User Story:** As a maintainer, I want execution rules embedded in the spec, so that any agent
implementing a phase stays within the safe envelope.

#### Acceptance Criteria

1. THE plan SHALL require that no more than one page area is redesigned at a time (never all pages at once).
2. THE plan SHALL prohibit copying brand-specific UI from any referenced product.
3. THE plan SHALL require preserving all existing behavior (the HARD CONSTRAINTS).
4. THE plan SHALL require running `npm run build` after each implementation phase.
5. THE plan SHALL require running `npm run lint` after each implementation phase.
6. THE plan SHALL require running the `hig-doctor` audit after each implementation phase where available.
7. THE plan SHALL require keeping changes reviewable and modular (per-file/per-surface commits, each
   phase independently revertible).

### Requirement 9: Originality and anti-cloning guarantee

**User Story:** As a brand owner, I want a guarantee of originality, so that the redesign is distinctive
and legally/ethically clean.

#### Acceptance Criteria

1. THE design document SHALL treat the referenced products (Apple, Linear, Notion, Raycast, Superhuman,
   Jira, Trello, and any other) as inspiration for principles only.
2. THE design document SHALL NOT specify copying exact layouts, sidebars, palettes, gradients, card
   styles, typography choices, motion styles, or product structure from any referenced product.
3. THE Quiet Velocity design system SHALL be expressible entirely in the app's own token set (slate
   neutral + blue/sky accent + documented semantic colors) without adopting a referenced product's
   signature palette or chrome.

### Requirement 10: Preservation of existing behavior

**User Story:** As a maintainer, I want the redesign to change only presentation, so that all
established data, security, and interaction behavior remain intact.

#### Acceptance Criteria

1. THE Application SHALL keep the Supabase database schema unchanged.
2. THE Application SHALL keep the authentication architecture, RLS policies, and the workspace, members,
   and invite flows unchanged.
3. THE Application SHALL keep the Kanban create/read/update/delete semantics, the drag-and-drop behavior,
   and the realtime synchronization behavior unchanged.
4. THE Application SHALL keep the Focus Dock and Pomodoro timer state behavior and the Floating Timer
   PiP logic unchanged.
5. THE Application SHALL keep the existing `localStorage` keys and value shapes unchanged.
6. THE Application SHALL keep the existing routing behavior unchanged (Phase 0 preview routes must be
   additive and gated, not a change to default routing).
7. THE Application SHALL keep the task data payload shape unchanged.
8. WHEN `npm run build` and `npm run lint` run after any implementation phase, THE Application SHALL
   complete both with a success status and no errors that were absent from the baseline.
