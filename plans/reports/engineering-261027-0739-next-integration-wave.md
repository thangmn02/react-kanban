# Next integration wave delivery

The employee card and layered shell are implemented and locally qualified. Notes advanced as an isolated device-only preview. Actual local Supabase qualification and the Windows executable build succeeded. Hosted staging, broader native handling and P4 release gates remain open. No publication, installed-app replacement, security-policy bypass or hosted write occurred.

Baseline: `513d7e5a0158443c221eb8e1dd5a3da4fc1df178`, branch `codex/product-ux-upgrade`. Changes remain in the working tree. Inherited acoustic Lab/research edits were preserved outside this work.

## Scorecard

| Area | Decision |
| --- | --- |
| Employee Identity Card | **PASS** in tested Web/local-connected UI and native smoke scope |
| P0 Connected Qualification | **PARTIAL**; actual local services pass, hosted unqualified |
| User/Settings Connected Qualification | **PARTIAL**; actual local UI/Auth/Storage pass, hosted unqualified |
| Windows Executable | **PARTIAL**; build/native smoke pass, native file-dialog and broader connected/capture matrix remain open |
| Adaptive App Shell | **PASS** in tested desktop/tablet/mobile and native smoke scope |
| Notes | **PARTIAL**; full device-only preview increment passes; connected persistence and cross-context rollout remain open |
| Collaboration | **PARTIAL**; existing local role boundaries pass; Note ACLs and hosted invitations/revocation remain open |
| P3 Preservation | **PASS**; protected hashes and two fresh matrices pass |
| P4 Engineering | **PARTIAL**; physical A/V, device/resource and model licensing gates unchanged |
| Production Release | **BLOCKED** |

## Reviewable increments

1. **Employee card:** repaired desktop downward entry from −10px, 180ms retained exit, repeat-avatar toggle, route/account/workspace invalidation and non-modal keyboard parity. Added clipped portrait framing, pixel accent, Settings gear and drag repositioning in the existing crop editor. The card reuses the same bounded saved identity image; no unbounded metadata blob or duplicate settings/theme owner was added.
2. **Connected correctness:** backup/restore and actual local-service qualification tooling, richer read-only historical preview, read-only hosted preparation and the empirically required task-publication migration. See [connected evidence and blockers](connected-261027-0739-staging-reconciliation.md).
3. **Layered shell:** 56px dark rail, 240px collapsible contextual sidebar, existing main routes/canvas, responsive header/context row, Board lists/filters, Today planning, Notes filters and existing Workspace member/invitation navigation.
4. **Notes:** existing TipTap packages provide compact/expanded formatting and readable previews; persistent checklists, pin, pointer/keyboard drag and resize, minimize, task links, idempotent local task conversion, autosave and reversible Shake-to-Peek. Peek is inert/pointer-transparent with accessible Restore. Shared Notes is an explicit unavailable preview state. Scoped Web Locks plus opaque predecessor tokens preserve concurrent edits and reject dependent writes after conflicts.
5. **Lifetime repair:** the real route test exposed that the pre-existing Focus portal owner unmounted the music view when leaving Focus. It now parks the same host while minimizing presentation demand and reattaches it on return. Timer/audio owners and P3 renderers were preserved. Independent review found no remaining severe defect after the keyboard and same-note conflict fixes.

Source owners are `src/components/layout/identity-card.tsx`, `src/components/settings/avatar-editor.tsx`, `src/hooks/use-dialog-focus.ts`, `src/components/layout/AppNavigation.tsx`, new `context-sidebar.tsx`, `src/AppLayout.tsx`, `src/App.tsx`, `src/app/useAppRoutingController.ts`, `src/constants/features.ts`, both translation files, `src/features/notes/`, `src/pages/notes/`, and `src/hooks/useDocumentPictureInPictureWidget.tsx`. Tests live in the matching unit files and new `e2e/employee-identity.spec.ts` / `layered-shell-notes.spec.ts`. Qualification scripts and the single new migration are listed in the connected report. `playwright.config.ts` now uses explicit loopback/no-proxy, a strict deterministic port and refuses reuse of unknown servers. `playwright-integration.config.ts` provides the source-controlled built-app reproduction matrix.

## Fresh verification

| Check | Result |
| --- | --- |
| Full Vitest | **1,185 passed**, 142 files; `tests-reviewed.log` |
| Final browser matrix | **30 passed**, 1.7 minutes; `browser-delivery.log`, `browser-delivery.json` |
| Focused final review tests | **16 passed**; `review-tests.log` |
| Full ESLint | **0 errors, 33 warnings**; `lint-full.log`; warnings remain visible |
| TypeScript | PASS; `typecheck-reviewed.log` |
| Actual local connected services | Five groups PASS; `local-connected-results.json` |
| Actual connected Settings browser | Four flows PASS; final `connected-ui/results.json` |
| Frontend and isolated native build | PASS; `build-delivery.log`, `windows-delivery-build.log` |
| Native unit tests | **20 passed**; `native-tests.log` |
| Protected baseline | **91 files + three model hashes PASS**; `preservation.log` |
| Fresh P3 presentation | **50 cases at requested 60 Hz and 50 at requested 120 Hz PASS** |

Private evidence root is `scratch/integration-261027-0739/`. The browser cases cover entry/exit, rapid toggle, outside/Escape/Tab, focus return, proportional image/cancel/default/reload, reduced motion/mobile, Settings roundtrip, canonical completion/drag/Focus/Today persistence, retained Calendar/Table/filter/history state, shell breakpoints, portal identity across routes, Notes conversion, real two-tab different-note writes, deterministic same-note conflict interleaving and real pointer Shake-to-Peek/keyboard restoration.

Screenshots: `identity-before.png`, `identity-open.png`, `identity-mobile-reduced.png`, `shell-today-desktop.png`, `shell-board-desktop.png`, `notes-desktop.png`, `shell-notes-820.png`, `shell-notes-320.png`, `connected-ui/saved-identity.png`, `native-identity.png`, `native-workspace.png`, `native-beat-grid.png`. Actual exit opacity/transform frame samples are attached as `identity-exit-frames` in the final browser JSON; exit frames occur before unmount. Workspace/account invalidation is additionally covered by the real component regression and actual logout/reauthentication flow.

P3 receipts: `scratch/p3-p4-261026-1706/browser-60-2026-10-27T01-05-22-488Z/result.json` and `browser-120-2026-10-27T01-21-05-264Z/result.json`. The first concurrent 120 Hz attempt missed three observed Opal frames while builds/browser suites competed; its FAIL receipt and log are retained. An isolated rerun of the unchanged renderer passed all 50 cases. Software pacing flags do not qualify physical refresh. Frozen P2 detectors/compensation were not changed.

## Windows identity and limits

The prior 4551 log names `src-tauri/target/debug/build/tauri-89bc7c3211f5bd75/build-script-build` as the rejected helper. Its present `.exe` SHA-256 is `a1c0df05c5aca28356f4e60cedbe1bce9f3b073fddfb22c77fb8aad3a001a064`; no earlier helper hash exists to infer byte identity. Ordinary debug/unbundled builds succeeded in this session, without renaming helpers, substituting executables or changing policy. This proves current execution succeeded, not why external policy behavior changed.

Final `src-tauri/target/debug/kora.exe` SHA-256: `798b340a226c995465852028ddd3c0977aef633549a88157c8a262a6a1e901cd`. The override uses `app.kanthangboard.qualification` to isolate data from the installed app; version remains 0.1.31. Actual WebView smoke evidence covers startup, Dock→workspace resize, portrait card/Settings/Escape focus return, task Focus launch, running timer across navigation/Music/Beat Grid, completion and timer pause. Receipts are `native-lifecycle.json`, process/hash records and screenshots. Native file-picker/upload and full authenticated native/capture/physical A/V acceptance remain unqualified.

The owned native window exited cleanly. Preview ports 5173, 5174 and 1436 and the owned native process are empty in final inventory. Generated local auth/image/restore fixtures were cleaned; user-owned Docker containers were left running.

## Build identities and reproduction

`delivery-identities.json` records 482 source hashes, all generated JS/CSS hashes, HTML identities, installed tool versions and executable SHA. Node is v26.8.1; actual installed versions include Vite 8.2.2, React 19.3.0, Vitest 4.1.11, TypeScript 5.9.3 and Playwright 1.63.0. The local frontend entry is `assets/index-BpsLwewM.js`, SHA-256 `b35606ae3cacb932e102a6ed2c0df4c7d72a15eb6a0f668d215574af80f47831`. The connected entry is `assets/index-DSETOy1E.js`, SHA-256 `0ea1dce9453010467e2c1c4580622d8f86daba8975312e64b9fa1e18168edfca`.

Run from the repository root with the installed dependencies:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=4
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/eslint/bin/eslint.js .
$env:VITE_AUTH_MODE='mock'
node node_modules/vite/bin/vite.js build --outDir scratch/integration-261027-0739/delivery-frontend
$env:KORA_QUALIFICATION_APP_DIR='scratch/integration-261027-0739/delivery-frontend'
node node_modules/@playwright/test/cli.js test --config playwright-integration.config.ts
node scripts/verify-p3-p4-presentation.mjs
node scripts/verify-p3-p4-presentation.mjs --120
node scripts/verify-p3-p4-preservation.mjs
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml
node node_modules/@tauri-apps/cli/tauri.js build --debug --no-bundle --config scratch/integration-261027-0739/native-delivery-config.json
node scripts/qualify-staging-migrations.mjs
node scripts/audit-task-workflow.mjs scratch/p0-261026-2311/hosted-snapshot.json
```

The integration Playwright config points at the built app and owns its preview; the exact delivery run also retains its equivalent private config and receipts. Staging/local backup and authenticated reproduction are documented in [connected recovery](../../docs/connected-qualification.md); use fresh backup/evidence directories to preserve prior receipts. No normal build/recheck command authorizes deployment or installation.

Unresolved: authorize hosted staging and recovery/history alignment; review the three hosted migrations; complete native file/dialog/authenticated-capture coverage; define and review connected Note persistence/ACLs; close the existing P4 physical/device/licensing gates before any production GO.
