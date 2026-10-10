# Dependency-aware test infrastructure

Implemented against the current development working tree. No Lead, percussion,
Bass, renderer, scheduler, model or audio-threshold changes. No existing test removed.

## Existing CI and delivered lanes

Before this change, `ci.yml` ran full JS coverage, lint/types/build/bundle checks,
database reset/lint/RLS and 21 mock browser tests on main pushes and PRs to main.
The path-filtered Windows widget build was separate. Public-auth browser tests
were excluded from the main config; Python/native contracts had no PR lane here.

PRs now use the base/head Git diff. Main pushes, nightly (19:23 UTC), published
releases and manual CI runs force full JS, mock/public-auth browser, Python and
Windows regression. Full lint/types/build/budget and database/RLS remain mandatory.
The signed Windows workflow is unchanged. No deployment was performed.

The selector follows transitive imports/re-exports, types, aliases, literal
dynamic imports, mocks and local assets. Shared contracts expand into Web,
Companion, Python and Windows lanes, including dependencies feeding those contracts.
Unknown/deleted paths, unresolved imports (including in tests), uncovered source,
global configuration, missing Git refs or missing named journeys select full
regression. Selected unit runs still collect coverage; partial percentages are
not a full-suite coverage result. Existing coverage configuration is unchanged.

## Measured timings

One Windows machine, installed dependencies; Node 26.8.1 locally versus Node 22
in CI. Browser runs use one Chromium worker. These are observed lane times,
not GitHub billing or total pipeline duration; installation/Docker costs excluded.

| Lane | Existing full lane | Timer change selected lane |
| --- | ---: | ---: |
| JS coverage | 800 tests / 112 files, 31.59 s | 91 tests / 12 files, 10.00 s |
| Browser | 21 tests, 92.55 s | 10 tests, 48.52 s |

Selected timings include runner/selector self-tests, but use a saved impact plan.
Building that plan separately takes median 4.19 s (nine previews, 4.09–4.94 s).
Coverage lane reduction: 68%; browser lane reduction: 48%. Single-run results
vary with cache and system load. Final full browser validation, after adding the
new Beat Grid journey: 22 mock tests in 82.20 s and 14 public-auth in 30.16 s.

Mandatory checks remained enabled and passed: lint 12.11 s, typecheck 7.95 s,
packaging 0.14 s, Vite build 6.77 s, budget 0.05 s. Existing lint/build warnings
remain visible. Python: 28 passed (5.96 s command); Windows: 14 passed (29.79 s,
including compilation). No heavy model inference is required by these contracts.

## Representative exact selection

For `src/utils/pomodoroTime.ts`, the selected unit files are:

```text
src/app/RequireAuth.test.tsx
src/components/focus/floating-focus-tabs.test.tsx
src/components/focus/FloatingFocus.test.tsx
src/components/focus/FocusDock.test.tsx
src/components/home/HomeFocusView.test.tsx
src/components/organisms/HomeDashboard.test.tsx
src/features/focus/useFocusSessionController.test.tsx
src/features/music/MusicPlayer.test.tsx
src/features/native/NativeSurface.test.tsx
src/hooks/useDocumentPictureInPicture.test.tsx
src/hooks/usePomodoroTimer.test.tsx
src/utils/pomodoroTime.test.ts
```

Each has an explicit import-chain reason in the plan. For example:
`pomodoroTime → usePomodoroTimer → useFocusSessionController → its test`.
The 10 browser cases are all three `briefing` cases, the `task-breakdown` case,
all four `workflows` cases, the named empty-dock timer case in `smoke`, and the
new `beat-grid` navigation/refresh case. The reason is transitive timer/dock/task
usage; unrelated toast/public identity/auth journeys are not replayed.

| Changed file | Selection and reason |
| --- | --- |
| `extensions/kanban-music/protocol.js` | 62 shared unit files; Beat Grid + two named Focus journeys; all five Python files + Rust. Shared transport boundary. |
| `src/features/music/lead-events.ts` | 66 unit files; same three journeys/Python/Rust. Shared event contract + transitive consumers. |
| `server/audio-analysis/test_service.py` | 62 shared unit files, three journeys, Python/Rust. Analysis boundary. |
| `src-tauri/src/main.rs` | Same shared lanes. Desktop boundary. |
| `e2e/toasts.spec.ts` | That spec only: four browser cases; no unit/Python/Rust lane. |
| `README.md` | Mandatory checks only; documentation. |
| `package.json`, deleted file, missing base ref | All 112 unit files, nine browser specs, Python/Rust; explicit fallback reason. |

All exact filenames, test-title filters and dependency reasons are in ignored
[representative plans](../../src-tauri/target/test-impact/representative-plans.json).
[Timing evidence](../../src-tauri/target/test-impact/) remains local and ignored.
CI stores selection/coverage artifacts for seven days; no generated JSON is tracked.

## Verification and operating limits

All 15 selector invariants pass. Review found and resolved variable test imports
and executable README classification gaps. Named journey changes and missing
coverage cannot silently skip tests. YAML parsing, event triggers and GitHub
output flags were checked. The runner propagates failures and does not use
`passWithNoTests`. Full JS baseline and final 36 browser cases pass.

Browser ports 5183/5184 are test-owned, strict and never reused; the user's 5173
server is untouched. Playwright shuts down its servers. Initial missing Chromium
runtime and the new test's incorrect no-capture assumption were corrected and rerun.

GitHub-hosted Linux/Windows jobs have not been dispatched. Database/RLS commands
are preserved unchanged in CI, not rerun against a user's local database. This
infrastructure must be published with the completed upstream development changes
and all new scripts/tests before clean-checkout CI can exercise that integration.
Static dependency analysis cannot prove arbitrary runtime loading; uncertainty
therefore falls back to full regression. Source/model content and musical quality
remain outside this task.
