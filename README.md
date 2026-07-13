# React Kanban

[![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/code-MIT-success)](#license)
[![Supabase](https://img.shields.io/badge/backend-Supabase(optional)-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)

A calm, focus-first task manager for **individuals and small teams**. Plan your
day, organize work on a drag-and-drop Kanban board, run Pomodoro focus sessions,
and collaborate in shared workspaces — with a fully bilingual
(English / Vietnamese) interface.

React Kanban is built to answer one question well: *what should I focus on
right now?* Today planning surfaces a small set of recommended focus tasks,
grouped by due/overdue context, while the board stays available for the wider
picture. It also includes **Arcana** — a playful, collectible tarot mini-game
you can unlock by completing tasks, for a moment of reflection between work.

> **Two ways to run it:** A no-backend **local mode** (mock auth + persistent
> `localStorage`) for exploring and demoing, and a full **Supabase mode** with
> auth, workspaces, invites, realtime sync, and Row-Level Security.

---

## Table of contents

- [Feature matrix — Local vs Supabase](#feature-matrix--local-vs-supabase)
- [Quick start — local mode](#quick-start--local-mode)
- [Full Supabase setup (from a clean clone)](#full-supabase-setup-from-a-clean-clone)
- [Tech stack](#tech-stack)
- [Architecture and data model](#architecture-and-data-model)
- [Testing and quality commands](#testing-and-quality-commands)
- [Deployment](#deployment)
- [Security / RLS model](#security--rls-model)
- [Internationalization](#internationalization)
- [Arcana mini-game](#arcana-mini-game)
- [Design Lab](#design-lab)
- [Accessibility & motion](#accessibility--motion)
- [Known limitations and project status](#known-limitations-and-project-status)
- [License](#license)

---

## Feature matrix — Local vs Supabase

| Feature | Local mode (`mock`) | Supabase mode (`supabase`) |
| --- | :---: | :---: |

---

## Quick start — local mode

Run the whole app in your browser, no backend required. Data persists to
`localStorage`, scoped per mock user/workspace.

**Prerequisites:** Node.js 20+ (a current LTS is required by Vite 8) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment for local demo mode
cp .env.example .env
# .env contents (mock = no Supabase needed):
#   VITE_AUTH_MODE=mock
#   VITE_SUPABASE_URL=
#   VITE_SUPABASE_ANON_KEY=

# 3. Start the dev server
npm run dev
```

The dev server prints a local URL (default: <http://localhost:5173>). Open it
and you're ready to plan — your boards, tasks, and focus stats survive page
refreshes because they're written to `localStorage`.

> The only required variable for local mode is `VITE_AUTH_MODE=mock`. The
> Supabase URL/key can be left blank.

---

## Full Supabase setup (from a clean clone)

For collaborative mode with auth, workspaces, invites, realtime sync, and RLS,
run the full Supabase stack. Migrations are tracked in `supabase/migrations/`
and applied by `supabase db reset`.

**Prerequisites:** the [Supabase CLI](https://supabase.com/docs/guides/cli)
(`supabase` on your PATH) and Docker (the CLI runs a local stack in containers).

```bash
# 1. Install JS dependencies
npm install

# 2. Start the local Supabase stack (API, Postgres, Realtime, Studio, Storage)
supabase start

# 3. Apply all tracked migrations to a clean database
#    (creates tables, RLS policies, RPCs, the cover-image storage bucket, …)
supabase db reset

# 4. Configure environment for Supabase mode
cp .env.example .env
```

Edit `.env` with the local Supabase credentials printed by `supabase start`
(`supabase status` shows them again any time):

```dotenv
# Local Supabase (defaults shown — confirm with `supabase status`)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
VITE_AUTH_MODE=supabase
```

> `VITE_AUTH_MODE=supabase` requires valid `VITE_SUPABASE_URL` and
> `VITE_SUPABASE_ANON_KEY` — the app throws at startup if they're missing or
> empty. (See `src/lib/supabase.ts`.)

```bash
# 5. Start the dev server
npm run dev
```

Local Supabase services (from `supabase/config.toml`, `project_id = "react-kanban"`):

| Service      | Port  | Notes |
| ---          | :---: | --- |
| API (PostgREST) | 54321 | `public` + `app_private` schemas |
| Postgres     | 54322 | major version 15 |
| Studio       | 54323 | local admin UI |
| Inbucket     | 54324 | test email (auth invites) |
| Storage      | 54325 | task cover image bucket |

To target a **remote** Supabase project instead, set `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` to your hosted project values and apply the migrations
there (`supabase db push` or the Supabase dashboard).

| Kanban board (drag-and-drop columns/cards, priorities, due dates, Tiptap rich-text) | ✅ | ✅ |
| Today daily planning + focus task suggestions | ✅ | ✅ |
| Home overview dashboard | ✅ | ✅ |
| Focus dock + Pomodoro timer | ✅ | ✅ |
| Command palette (keyboard navigation) | ✅ | ✅ |
| Arcana tarot mini-game | ✅ | ✅ |
| Bilingual UI (English / Vietnamese) | ✅ | ✅ |
| **Persistent storage** | `localStorage` | PostgreSQL |
| Real user authentication | ❌ (mock user) | ✅ (Supabase Auth) |
| Multi-workspace organization | ❌ (single local workspace) | ✅ |
| Member invites & workspace membership | ❌ | ✅ |
| Realtime sync across devices/sessions | ❌ | ✅ (Supabase Realtime) |
| Task cover image uploads | ❌ | ✅ (Supabase Storage bucket) |
| Row-Level Security / tenant isolation | n/a | ✅ |
| Works fully offline | ✅ | ❌ (needs Supabase) |

Local mode is the easiest way to try the product end-to-end; Supabase mode is the
collaborative, multi-user configuration.

---

## Tech stack

| Area | Choice |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Drag & drop | dnd-kit |
| Forms & validation | React Hook Form + Yup |
| Rich text | Tiptap |
| Animation | Framer Motion |
| Backend / auth | Supabase (optional — local mock mode runs without it) |
| Notifications | React Toastify |
| Dates | date-fns |
| Testing | Vitest 4 + `@vitest/coverage-v8` (jsdom) |
| Linting | ESLint 9 (typescript-eslint) |

---

## Architecture and data model

### `src/` structure

```
src/
  components/          UI organized by area:
    atoms/               small primitives (Button, Badge, skeletons…)
    molecules/           InputField, TextAreaField, dialogs
    organisms/           KanbanBoard, HomeDashboard, CalendarBoardView,
                         TableView, QuickSearch, dialogs & toasts
    board/ today/ home/ focus/ task/ workspace/ invite/
    auth/ onboarding/ command/ layout/ error/
  features/            self-contained feature modules
    arcana/              the tarot mini-game (cards, packs, reading engine)
    today/               daily planning rituals + suggestions
  infrastructure/
    local/              LocalBoardStore — localStorage-backed repository
  services/            data-access layer (one service per domain)
    board.service.ts    workspace.service.ts   task.service.ts
    list.service.ts     label.service.ts      checklist.service.ts
    activity.service.ts focusSession.service.ts  invite.service.ts
    home.service.ts     today.service.ts      taskCoverUpload.service.ts
  hooks/               reusable hooks (task ops, Pomodoro, focus, realtime…)
  contexts/ providers/ app-wide state (Auth, I18n, AstryxTheme)
  i18n/                English / Vietnamese translations + useI18n()
  design-lab/         dev-only UI preview sandbox (gated, stripped in prod)
  shared/             cross-cutting helpers (e.g. storage adapter)
  lib/ utils/ types/ constants/  shared helpers and TypeScript types
  data/               seed data, board templates, holidays, assignees
public/
  arcana/             card/pack art atlases + generated reading data (runtime)
docs/
  sql/                reference SQL + RLS verification notes
  *.md                design/integration/handoff notes
supabase/
  migrations/         tracked DB migrations (RLS, RPCs, storage bucket…)
  config.toml         local Supabase project config
scripts/
  pull_hf_tarot.py    regenerates the local tarot reading corpus
```

### Services layer & local fallback

Each `src/services/*.service.ts` is a thin domain module that branches on the
active auth mode. When `import.meta.env.VITE_AUTH_MODE !== 'supabase'` (or no
Supabase client is configured), every call falls back to the
**`LocalBoardStore`** (`src/infrastructure/local/localBoardStore.ts`), a
persistent, `localStorage`-backed repository.

- `src/lib/supabase.ts` exports `authMode` (`'mock' | 'supabase'`) and a
  `requireSupabaseClient()` guard used by Supabase-side code paths.
- `LocalBoardStore` is the single source of truth for all mock-mode board
  data. On first access it seeds itself from `src/data.ts` (converted to the
  normalized row shape used elsewhere), and every read/write goes through the
  store so mutations survive page refreshes.
- Data is scoped under a typed storage key
  (`kanban:mock-user:local-mock-workspace:board_store:v1`) so it's isolated
  from any real Supabase user's cached data.

### Data model (Supabase)

The normalized core is `boards → lists → tasks`, plus supporting tables. Key
tables and their workspace-scoped RLS boundaries (see
[SECURITY_RLS.md](SECURITY_RLS.md) and `docs/sql/`):

- `boards`, `lists`, `tasks` — read: workspace members; write: workspace editors
- `workspace_invites` — read: workspace managers or the invited JWT email;
  write: workspace managers
- `task_activities`, `task_checklist_items`, `task_labels`, `task_label_links`
- `focus_sessions`, `holidays`
- RPCs: `create_workspace_with_owner(...)`, `update_task_positions(jsonb)` for
  atomic, transaction-validated reordering
- Storage bucket: task cover images (created by migration
  `20260701000000_create_task_cover_storage_bucket.sql`)

Migrations are timestamped and applied in order by `supabase db reset`. See the
`supabase/migrations/` directory for the full history.

### Bundle & code splitting

The production bundle is code-split: heavy views (`CalendarBoardView`,
`TableView`, `HomeDashboard`, `TodayPage`, the Arcana dialogs) are loaded with
`React.lazy`, and `vite.config.ts` defines manual vendor chunks
(`react-vendor`, `supabase`, `dnd`, `tiptap`, `framer`).


---

## Testing and quality commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the Vitest suite once (`vitest run`) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run tests with V8 coverage (`vitest run --coverage`) |
| `npm run lint` | Lint with ESLint 9 (`eslint .`) |
| `npm run build` | Type-check (`tsc -b`) then build (`vite build`) |
| `npm run preview` | Preview the production build locally |

Tests run in jsdom via Vitest. Coverage is collected through
`@vitest/coverage-v8`.

---

## Deployment

The repo ships with a `netlify.toml` containing a single SPA fallback redirect
so client-side routing works on Netlify:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

**Build command:** `npm run build`
**Publish directory:** `dist`

### Environment variables for the deployed build

Set these in your hosting provider's environment (Netlify → Site settings →
Environment variables). For the full Supabase deployment:

```dotenv
VITE_SUPABASE_URL=<your hosted Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon/public key>
VITE_AUTH_MODE=supabase
```

For a deploy that runs in local/demo mode (no backend), use:

```dotenv
VITE_AUTH_MODE=mock
```

> All variables are Vite build-time (`VITE_` prefix) — they're inlined into the
> bundle at build time, so they must be present during the build step, not just
> at runtime.

Remember to apply the database migrations to your hosted Supabase project
(`supabase db push --linked`, or paste the SQL from `supabase/migrations/` and
`docs/sql/` into the SQL editor) before pointing the app at it.

---

## Security / RLS model

Supabase's anon key is public in the browser, so client-side filters are **not**
an access-control boundary. Tenant isolation is enforced by database
**Row-Level Security** with **workspace-scoped** policies.

The full checklist and verification queries live in
[**SECURITY_RLS.md**](SECURITY_RLS.md). In summary:

- RLS is enabled on `boards`, `lists`, `tasks`, `workspace_invites` (and
  related tables); none of these has a permissive `USING (true)` /
  `WITH CHECK (true)` policy.
- Policies reference the helper functions `is_workspace_member`,
  `can_edit_workspace`, and `can_manage_workspace_members` so access is gated
  on workspace membership/role rather than identity alone.
- Task reordering goes through the `update_task_positions(jsonb)` RPC so the
  database validates all task/list/workspace relationships and applies the
  reorder in a single transaction.
- See `docs/sql/rls-verification.md` for copy-paste verification queries, and
  the migrations under `supabase/migrations/` (notably
  `20260616000000_harden_workspace_foundation.sql`,
  `20260702000000_harden_rls_and_function_grants.sql`) for the hardened
  policies.


---

## Internationalization

The interface is available in **English** and **Vietnamese**. Strings live in
`src/i18n/translations/` (`en.ts` and `vi.ts`) and are resolved through a small
`useI18n()` hook. The selected language is persisted across sessions and
switchable in-app.

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

The reading corpus JSON under `public/arcana/data/` is generated from a tarot
dataset and committed as a runtime asset. `scripts/pull_hf_tarot.py` documents
the local preprocessing path: it reads `public/tarot_readings.parquet` when
present, or pulls `barissglc/tarot` from Hugging Face during regeneration. The
browser runtime only fetches the static JSON under `public/arcana/data/`.

---

## Design Lab

`src/design-lab/` is a development-only preview sandbox for UI exploration. It
is gated behind dev builds (or an explicit `VITE_ENABLE_DESIGN_LAB="true"`
opt-in) and is unreachable in a normal production build — a disabled
`/design-lab/*` visit falls through to the app (which shows NotFound). In
production the entire design-lab chunk is dead code and stripped from the
bundle.

```dotenv
# opt in for a production build (rarely needed):
VITE_ENABLE_DESIGN_LAB=true
```

---

## Accessibility & motion

- Interactive elements expose clear focus states.
- Decorative animation honors the OS-level "Reduce Motion" setting.
- An offline banner and error boundaries keep the app usable under failures.

---

## Known limitations and project status

- **Local mode is a persistent demo mode.** It runs without any backend, stores
  data in `localStorage` (scoped per mock user/workspace), and does **not**
  support real authentication, multi-workspace collaboration, invites,
  realtime sync, or cover-image uploads. It's ideal for evaluation and demos
  but is not a multi-user deployment.
- **Supabase mode requires the full setup.** You must run the local Supabase
  stack (or point at a hosted project) and apply all migrations; without the
  database, RLS policies, and storage bucket, collaborative features won't
  function.
- Arcana card/pack art is derived from GPL-3.0 third-party assets — review
  those obligations before any public/commercial release (see [License](#license)
  and `src/features/arcana/ATTRIBUTION.md`).
- The project is actively developed; expect rough edges and breaking changes
  to the schema/UI. Not production-hardened.

---

## License

- **Project code** is licensed under the **MIT License** — see
  [`LICENSE`](LICENSE).
- **Arcana card/pack art** under `public/arcana/atlas/` is derived from the
  **DX-Tarots (Deluxe Consumables)** Balatro mod by JeffVi, licensed under
  **GPL-3.0**. Bundling this art carries GPL obligations, and the underlying
  card imagery may itself derive from Balatro. Verify license compatibility and
  asset provenance before any public/commercial release; if the obligations are
  unacceptable, replace `public/arcana/atlas/*` with original art (the rest of
  the feature is asset-path driven and will keep working). See
  [`src/features/arcana/ATTRIBUTION.md`](src/features/arcana/ATTRIBUTION.md)
  for the full attribution and the Hugging Face `barissglc/tarot` corpus
  notes.

