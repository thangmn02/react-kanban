# Combined Kora build results

Integration scope: existing qualified P3 presentation + product UX + task correctness + identity/settings/card motion, shared by Kora Web and Windows. The qualified presentation was integrated without reimplementation. This report is fresh integration evidence, not a promotion of previous receipts.

## Decisions

| Area | Final decision |
| --- | --- |
| P3 tested software presentation | **PASS**, preserved; two fresh 50-case matrices pass |
| Product UX | **PARTIAL**, local engineering checks pass; connected/native/physical qualification remains open |
| P0 correctness | **PARTIAL**, required local/isolated regression matrix passes; hosted qualification remains open |
| User/settings | **PARTIAL**, local browser/service/policy tests pass; connected uploads/auth are unqualified |
| Card motion | **PARTIAL** across target platforms; browser behavior passes, new Windows executable is blocked |
| P4 Engineering | **PARTIAL**, unchanged |
| Production Release | **BLOCKED**; no production publication authorized by these results |

## Fresh results

| Check | Result and receipt |
| --- | --- |
| Full Vitest suite | **1,179 passed, 0 failed**; `scratch/p0-261026-2311/full-tests-final.json` |
| Complete Playwright suite | **22 passed, 0 failed**, 1.5 minutes; `browser-final.log`, `browser-results.json`. Dedicated automation contexts, browser closure owned by Playwright |
| Required counts assertions | Additional focused 8/8 task workflow tests passed after strengthening per-transition counts; no production code changed afterward |
| ESLint | **0 errors, 33 warnings**; `lint-final.log`. Existing hook/ref warnings remain visible. Git-ignored scratch backups and downloaded vendor packages are excluded from source linting |
| TypeScript | **PASS**, exit 0; `typecheck-final.log`, `checks-final.json` |
| Connected Web/shared Windows frontend | **Build PASS** in unpublished `connected-final/`; no installer or deployment was produced |
| Entry bundle budget | **824,231 bytes**, below 1,000,000-byte budget |
| Windows native unit tests | **20 passed, 0 failed**, `cargo test --manifest-path src-tauri/Cargo.toml --locked`; `windows-tests.log` |
| Windows executable build | **BLOCKED**. Tauri build helper rejected by Windows Application Control, os error **4551**; `windows-build.log`. No successful new executable/installer claim |
| Transactional workflow SQL | **8 isolated PostgreSQL groups PASS**, actual migration executed under PGlite; `sql-results.json` |
| Private image policies | **6 isolated PostgreSQL groups PASS**, actual migration with authenticated/anonymous role checks; `profile-policy-results.json` |
| Frozen boundaries | **91 protected files + 3 model hashes PASS**; `protected-check.log`. **79/79** saved music/timer/CSS files byte-identical to integration admission; `presentation-preservation.json` |
| Committed dependency closure | 382 modules checked; no missing staged relative imports. Source-only safety scan found no forbidden artifact/dotenv paths or tested secret patterns |

Connected frontend entry: `assets/index-DFiIf9xz.js`. SHA-256 `9bc0b180ca9e35b89948634cce1c053ef3e0f953372a9d1711d756d7cf396345`; HTML SHA-256 `a6e772f17097fe107c718b614c39597fb09298056faab43ac0da8218f05e2974`. Full asset manifest stays in the private qualification folder. This compile is not authenticated hosted-service acceptance.

The browser suite includes one real UI-created canonical board/task completed and reopened through Board, Task Detail, running Focus, Today and keyboard drag. It inspects persisted rows/membership and reload behavior. Actual rich-editor paragraphs appear as readable Today text. Identity cases validate proportional landscape/portrait/square previews and saved 512×512 output, cancel/default/error behavior, localization, keyboard focus and mobile/reduced-motion layout. Existing CRUD/history/routing, pointer drag, Calendar/Table/filter, contextual URL and timer/tab continuity regressions also pass.

## Presentation evidence

The unchanged qualification fixtures compiled the current production renderer sources. Fresh 50-case matrices:

- `scratch/p3-p4-261026-1706/browser-60-2026-10-26T17-30-33-412Z/result.json`: PASS, zero reported errors.
- `scratch/p3-p4-261026-1706/browser-120-2026-10-26T17-33-40-705Z/result.json`: PASS, zero reported errors.

These cover accepted identity, batched/rapid events, Heartbeat, Pattern Exclusive suppression/fresh recovery, source/capture/epoch/view lifecycle, reduced motion and Opal profiles. Requested compositor rates are software flags, not independently verified physical 60/120 Hz displays. The existing [P3/P4 report](p3-p4-implementation-and-qualification.md) remains supporting historical evidence with its original build identities and limits. It does not qualify this candidate's Windows executable, hosted database or physical A/V behavior.

## Blockers and unchanged production

1. Windows Application Control must permit a legitimate Tauri build helper in an approved build environment before a fresh executable, native-window lifecycle and WebView qualification can be completed. The policy was not disabled or bypassed.
2. The two database migrations are **source-only**. A restorable hosted backup and non-production migration/RLS/storage/auth/realtime/reconnect tests are required. The attempted Docker-based dump did not succeed because the Docker daemon was unavailable; metadata-only linked queries were read-only.
3. The historical read-only audit found 8 distinct affected tasks: 4 completed-in-active-list findings and 8 timestamp mismatches. The private dry-run preview requires review; no rows were repaired and no historical timestamp was invented.
4. P4 physical display/A-V, weaker-device/resource-budget, actual owner-browser/native lifecycle and broader connected capture/playback gates remain open. Frozen P2 detectors and compensation are not promoted by the presentation PASS.
5. This is a feature-branch source integration, not a merge into newer `origin/main` or a release candidate approved for deployment. Subsequent base integration requires its own checks while preserving the frozen baseline.

No hosted schema/data write, production web deployment, version bump, signed installer/update, installed-app replacement or automatic bulk repair occurred. Existing inherited runtime sources required by the qualified presentation were preserved as source; unrelated research files remain outside the integration commit. Source publication on the feature branch does not authorize production publication.

See [task correctness](kora-p0-functional-correctness.md) and [identity/settings/motion](kora-user-identity-settings-card-motion.md) for contracts and scope-specific limits. Private snapshots contain operational metadata and must remain outside Git.
