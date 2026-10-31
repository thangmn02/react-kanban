# Kora 0.1.33 release report (November 1, 2026)

**Status: RELEASED.** Production deploy `6ae62d9c4ec969dfab60877b` was published on November 1, 2026, replacing `6aceb65d7544427364f295f3` (0.1.31).

Release verification (the first two drafts were rejected by smoke tests and never published):

- **Pages and functions:**
  - `/today`, `/notes`, `/focus` and board links return 200.
  - `note-images`, `beat-events` and `task-breakdown` answer exactly as on 0.1.31.
- **Feed and installer:**
  - `koraspace.online` and `kanthangboard.netlify.app` both serve the 0.1.33 feed.
  - The live installer has SHA-256 `726305b9…273f`.
  - It verifies against the live feed signature and the installed updater key, so 0.1.31 clients will update.
- **Companion download:** unchanged at 0.3.24.
- **GitHub:** branch `codex/final-completion-wave` (`f2ca50a`) and tag `v0.1.33` are pushed.

Earlier draft status, kept for history:

- **Production database:** migrated.
- **Signed Windows installer and production web build:** built, verified and committed (tag `v0.1.33` → `7f0d073`).
- **Not done yet:** the Netlify draft and promotion could not be run from this session. Tool policy blocks running the publisher and handing the production service-role key to Netlify, so the owner runs those commands (below).
- **Live site:** web and update feed stay on 0.1.31 (deploy `6aceb65d7544427364f295f3`) until promotion.

## A. Shipped in 0.1.33

| Area | Change | Commit |
|---|---|---|
| Tasks | The task drawer closes on an immediate Escape, and focus returns to the opener. A late `?task=` URL can't reopen a dismissed drawer. A closed modal's 2 s focus-restore watcher no longer steals focus from a newer modal. The page body is never a focus return target. | `1a8aaec` |
| Tasks | A leave-page warning appears while a board save is unacknowledged (optimistic moves were silently lost on refresh). | `1a8aaec` |
| Floating Focus | Root cause: `.floating-focus button` (specificity 0,1,1) outranked the single-class rules `.dock-icon-button`, `.music-skip`, `.music-mute` and `.dock-time-button`. That forced `padding: 8px 12px`, a grey fill and a border into 26–30 px buttons, so 18–20 px icons spilled out and overlapped neighbours. Fix: zero-specificity `:where()` element defaults. The now-playing slot is reserved only while a session exists and another tab is active, and duplicate rules are removed. | `8515377` |
| Beat Grid | The Kinetic four-row grid is the default presentation, driven by the same accepted, playback-timed onsets that public Companion 0.3.24 already sends. Developer comparison and late-live controls stay behind preview flags. The inert legacy colour-mode picker is removed. | `d3d9cb0` |
| Notes | Enabled in the production build (`VITE_ENABLE_NOTES_PREVIEW=true`). Uses the existing durable outbox: a local transaction before any send, a persisted operation token, conflict retention, retry, and close blocked until the draft is durable. | `25b3918` |
| Release | 0.1.33 builds from a committed tree with production public settings only. The installer bundles the published Companion 0.3.24, not the branch's 0.3.27. | `0818064`, `25b3918`, `b35f324`, `7f0d073` |

## B. Verification

**Gates on the release commit:**

| Gate | Result |
|---|---|
| TypeScript | clean |
| ESLint | 0 errors (2 pre-existing warnings) |
| Vitest | 1,311 / 1,311 |
| Rust | 30 / 30 |
| Playwright | 69 tests. Two failed under CPU contention during the native build; both specs passed 45 / 45 over three repeats on an idle machine. |
| Bundle budget | within budget |

**Layout regression suite (`e2e/focus-layout-geometry.spec.ts`):** 22 tests across Tasks, Music (playing, paused, empty, no Companion) and Beat Grid (active, idle) at 600, 900 and 1280 px. They check:

- no control overlap;
- every icon inside its button;
- the timer label inside its ring;
- the timeline and time labels inside the player;
- no horizontal overflow;
- no empty band;
- no height shift on pause.

The suite fails against the old CSS (the Previous-track icon is outside its button) and passes with the fix.

**Native Windows window** (an isolated `app.kanthangboard.qualification` build of the same source, mock data, 175% display scaling):

- The same checks show zero problems at 380, 520, 900 and 1575 CSS px for Tasks, Music and Beat Grid.
- Icon buttons compute `padding: 6px` with a transparent fill.
- 100%, 125% and 150% scaling were not exercised, because changing the system display scale is out of scope.

**Screenshots:**

- `scratch/focus-layout/before`
- `scratch/focus-layout/after`
- `scratch/focus-layout/native`

**Notes durability:**

- Unit coverage spans local-commit-before-send, the restart outbox, the backend unavailable at restart, retry with the same operation token, conflict retention, account change, quota failure, and blocked close on a failed local write.
- Browser coverage spans autosave and reload, two-tab concurrent edits, and same-note conflict rejection.
- Production Notes have not been exercised by a signed-in user yet; that's a post-promotion check.

**Artifacts:**

| Artifact | Detail |
|---|---|
| Windows installer | `Kora_0.1.33_x64-setup.exe`, 15,925,131 bytes, SHA-256 `726305b94cf81b8693e8c7e7ba2843cd684678e10c6e77cfe645e89936ac273f`. The updater signature verifies against the configured key; the trusted comment says version 0.1.33; a tampered copy is rejected. Windows Authenticode is not signed (unchanged from earlier releases). |
| Bundled Companion | 0.3.24. Its 44 extension files are byte-identical to the live public download. |
| Web build | 126 files, no source maps. No staging reference, service key, secret key, Lead detector or contour code. The `127.0.0.1` matches are security allowlist code only, with no loopback player. Experiment flags are false. The Design Lab can't be reached. The public Companion download is published byte-for-byte from the live site. |

**Database:**

- Read-only, TLS-verified history preflight showed the three expected entries.
- A fresh DPAPI-encrypted backup `1793468630039-lthlvntvjgnornrdxnms` was restore-verified (database only; the October 29 verified object backup remains).
- Offline rehearsal on that backup: PASS for 12 migrations, plan `fd80a81ce5daa5979dc23b51a6ed2c7b56c4e3fcbeadfa1be1de88c46e1514ca`.
- Applied to production as one transaction: history matches the rehearsal and pre-existing rows are preserved. Receipt: `%LOCALAPPDATA%/Kora/backups/production/release-0.1.33-apply.json`.
- The 0.1.31 schema and task-write compatibility were part of the rehearsal.

**Known issues:**

- The `note-images` function needs `SUPABASE_SERVICE_ROLE_KEY` (Functions scope, secret) on the production site. Without it, Notes images fail with "Your text is retained"; Notes text is unaffected.
- The playback worklet for saved Lead and the private-Companion strings are compiled in but unreachable.
- 100%, 125% and 150% scaling are unverified.

## C. Deployment

| Item | Value |
|---|---|
| Release tag | `v0.1.33` → `7f0d073` |
| Publish scripts | `3f51904`, `b34dc5c` |
| Production database | applied: 12 migrations |
| Netlify site | `kanthangboard` / `koraspace.online` (`0c8406d3-9d2e-4afd-8351-140813bfbaf9`) |
| Current published deploy (rollback point) | `6aceb65d7544427364f295f3`, Kora 0.1.31 + Companion 0.3.24 |
| Web and updater feed | pending owner-run draft and promotion |

**Owner steps, run from the release worktree:**

1. *(Recommended, for Notes images.)* Netlify → koraspace.online → Site configuration → Environment variables: add `SUPABASE_SERVICE_ROLE_KEY`, scope **Functions**, mark it secret, value = the production service-role key.
2. Create the draft:
   `node scripts/publish-production-release.mjs --draft --linux-functions="C:/Users/thang/OneDrive/Documents/react-kanban/react-kanban/scratch/product-completion-261027-0846/release-candidate/linux-functions/functions"`
   It prints `DRAFT_READY` with a draft URL; production stays unchanged.
3. Smoke-test the draft URL.
4. Promote: `node scripts/publish-production-release.mjs --publish=<draft deploy id>`.

**Rollback:**

- **Web:** Netlify → Deploys → `6aceb65d…` → Publish deploy. This also restores the 0.1.31 update feed.
- **Database:** the migrations are additive and 0.1.31-compatible, so a web rollback needs no database change. A full database restore uses backup `1793468630039-…` and needs a separate decision.

## D. Deferred

- **Melody / Lead fifth row:** decision B; see `plans/261031-1500-melody-ship-decision/report.md`.
- **Enhanced Beat Sync:** BLOCKED; see `enhanced-beat-sync-contract.md`.
- **Companion:** stays 0.3.24; 0.3.27, 0.3.28 and 0.3.29 remain unreleased candidates.
- **Nine historical task records:** still excluded.
