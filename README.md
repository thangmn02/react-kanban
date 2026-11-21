# Kora

A calm, focus-first task manager for individuals and small teams. Plan your day,
keep work on a drag-and-drop board, take notes and run focus sessions, in English
or Vietnamese.

**Website:** <https://koraspace.online>

## Features

- **Boards**: drag-and-drop lists and cards with priorities, due dates and a
  rich-text (TipTap) task editor. Completed tasks move to the board's Done list.
- **Today**: a short list of tasks to focus on now, grouped by due and overdue.
- **Notes**: Quick Notes with history, import/export and links to tasks.
- **Focus**: a focus dock with a Pomodoro timer, your task list and music. The
  optional [Kora Music Companion](extensions/kanban-music/README.md) browser
  extension shows what's playing and drives the Beat Grid visuals.
- **Workspaces**: with Supabase you get sign-in, shared workspaces, invites,
  realtime sync and read-only share links.
- **Desktop app**: a Windows app (Tauri 2) with a frameless dock, native notes
  and signed in-app updates.

## Download

- **Web:** <https://koraspace.online>
- **Windows:** choose **Download Kora** on the website, or get
  <https://koraspace.online/downloads/Kora-setup.exe>. After you install it once,
  later versions arrive through **Update** inside the app.

## Run it locally

You need Node.js 22.12 or newer and npm.

```bash
npm install
cp .env.example .env    # VITE_AUTH_MODE=mock is already set
npm run dev             # http://localhost:5173
```

With `VITE_AUTH_MODE=mock` there is no backend. You sign in as a mock user and
data is saved in the browser. Set `VITE_LOCAL_SAMPLE=true` to start with a
sample board. `.env.example` lists every other variable.

**Supabase mode.** Install the [Supabase CLI](https://supabase.com/docs/guides/cli)
and Docker, then:

```bash
supabase start
supabase db reset       # applies supabase/migrations
```

In `.env`, set `VITE_AUTH_MODE=supabase` and fill in `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` from `supabase status`. The row-level security model is
described in [docs/security-rls.md](docs/security-rls.md).

**Desktop app.** You need Rust (MSVC), the Visual Studio C++ Build Tools and
WebView2. Run `npm run tauri dev`. See [src-tauri/README.md](src-tauri/README.md).

## Tests and checks

| Command | What it does |
| --- | --- |
| `npm test` | Vitest unit and component tests (jsdom) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project check |
| `npm run copy:check` | Flags UI text that bypasses the English/Vietnamese translations |
| `npm run build` | Type-check and production build |
| `npm run e2e` | Playwright end-to-end tests in mock mode (run `npx playwright install chromium` first) |
| `npm run quality` | Lint, copy check, typecheck, tests with coverage, build and bundle-size budget |

Two more Playwright suites have their own configs:
`npx playwright test --config e2e/playwright.first-run.config.ts` and
`npx playwright test --config e2e/playwright.public-auth.config.ts`.

## Project layout

| Path | Contents |
| --- | --- |
| `src/` | React 19 app: `features/` (board, today, notes, focus, music, …), `pages/`, `services/`, `i18n/` |
| `server/` | Vite dev-server plugins and shared server code |
| `netlify/functions/` | Serverless API: task breakdown, share feed, note images, beat events |
| `supabase/` | Database migrations, tests and the contact Edge Function |
| `src-tauri/` | Windows desktop app (Rust) |
| `extensions/kanban-music/` | Kora Music Companion browser extension |
| `e2e/` | Playwright tests |
| `scripts/` | Build, packaging, release and maintenance scripts |
| `docs/` | Design system and feature notes |

Contributors: the UI uses the Astryx design system. Read
[docs/design-system.md](docs/design-system.md) before adding controls.

## License

The code is under the [MIT License](LICENSE). Some bundled assets carry their own
licenses: the tarot art and dataset are listed in [NOTICE](NOTICE), and the
hi-hat model's terms are in [third-party/cnn-hihat](third-party/cnn-hihat).
