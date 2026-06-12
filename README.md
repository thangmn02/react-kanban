# React Kanban

A calm, focus-first task management web app. Plan your day, organize work on a
drag-and-drop Kanban board, run Pomodoro focus sessions, and collaborate in
shared workspaces — with a fully bilingual (English / Vietnamese) interface.

It also includes **Arcana** — a playful, collectible tarot mini-game you can
unlock by completing tasks, for a moment of reflection between work.

> Built with React 19, TypeScript, Vite, Tailwind CSS v4, and Supabase.

---

## Highlights

- **Kanban board** — drag-and-drop columns and cards (powered by dnd-kit), with
  task priorities, due dates, and a rich-text description editor (Tiptap).
- **Today** — a daily planning surface that answers "what should I do now?" with
  a small set of recommended focus tasks, due/overdue grouping, and focus stats.
- **Home** — a quiet overview that surfaces what matters first.
- **Focus dock** — a built-in Pomodoro timer and focus sessions to work in
  intervals, with completion feedback.
- **Command palette** — keyboard-driven navigation and quick actions.
- **Workspaces & invites** — organize boards per workspace and invite members.
- **Bilingual UI** — full English/Vietnamese support with an in-app language
  toggle; the preference is remembered.
- **Arcana booth** — an optional reward mini-game: open card packs, draw a
  three-card tarot spread (rarity, foil finishes, upright/reversed), and read a
  card-specific reflection. Entirely local, deterministic, and offline.
- **Accessible & resilient** — keyboard focus states, reduced-motion support,
  an offline banner, and graceful error boundaries.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Drag & drop | dnd-kit |
| Forms & validation | React Hook Form + Yup |
| Rich text | Tiptap |
| Animation | Framer Motion |
| Backend / auth | Supabase (optional — a mock mode runs without it) |
| Notifications | React Toastify |
| Dates | date-fns |

---

## Getting started

### Prerequisites
- Node.js 20+ and npm (Vite 8 requires a current Node LTS)

### Install
```bash
npm install
```

### Configure environment
Copy the template and fill in values:
```bash
cp .env.example .env
```

```dotenv
VITE_SUPABASE_URL=        # your Supabase project URL
VITE_SUPABASE_ANON_KEY=   # your Supabase anon/public key
VITE_AUTH_MODE=mock       # "mock" runs locally without Supabase; set to live mode when configured
```

> **No backend yet?** Leave `VITE_AUTH_MODE=mock` to explore the app with mock
> authentication — no Supabase project required.

### Run
```bash
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run lint       # run ESLint
```

The dev server prints a local URL (default: http://localhost:5173).

---

## Project structure

```
src/
  components/      UI by area — board, today, home, focus, task,
                   workspace, invite, onboarding, command, layout, auth, error
  features/
    arcana/        The Arcana tarot mini-game (cards, packs, reading engine)
  i18n/            Internationalization (English / Vietnamese)
  hooks/           Reusable hooks (task operations, Pomodoro, focus, …)
  services/        Data + Supabase access
  contexts/ providers/   App-wide state and providers
  design-lab/      Dev-only UI preview sandbox (gated; not reachable in prod)
  lib/ utils/ types/ constants/   Shared helpers and types
public/
  arcana/          Card/pack art atlases + generated reading data (runtime assets)
scripts/
  pull_hf_tarot.py Regenerates the local tarot reading corpus (see below)
```

---

## Internationalization

The interface is available in **English** and **Vietnamese**. Strings live in
`src/i18n/translations/` (`en.ts` and `vi.ts`) and are resolved through a small
`useI18n()` hook. The selected language is persisted across sessions.

---

## Arcana mini-game

Arcana is a self-contained, offline reward feature:
- A **78-card catalog** (22 Major + 56 Minor Arcana) rendered from pixel-art
  sprite atlases.
- A **deterministic** pack-opening draw: pack type → rarity → foil finish →
  orientation → three-card spread (reproducible from a seed).
- A **card-specific reading engine** that composes a reflection from the actual
  drawn cards, their positions, orientation, and the chosen topic/question — in
  the active language.
- Optional anchoring to a local tarot reading corpus.

The reading corpus JSON under `public/arcana/data/` is generated from a dataset
and committed as a runtime asset. To regenerate it locally:
```bash
python scripts/pull_hf_tarot.py
```

> **Asset license note:** the Arcana card/pack art under `public/arcana/atlas/`
> is derived from GPL-3.0 third-party tarot mods (see
> `src/features/arcana/ATTRIBUTION.md`). Review those obligations before
> publishing or distributing.

---

## Design Lab

`src/design-lab/` is a development-only preview sandbox for UI exploration. It is
gated behind dev builds (or an explicit `VITE_ENABLE_DESIGN_LAB="true"` opt-in)
and is unreachable in a normal production build.

---

## Accessibility & motion

- Interactive elements expose clear focus states.
- Decorative animation honors the OS-level "Reduce Motion" setting.
- An offline banner and error boundaries keep the app usable under failures.
