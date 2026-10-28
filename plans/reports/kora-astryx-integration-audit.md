# Astryx integration audit — October 28, 2026

Astryx is now integrated through a compatible local CLI, explicit CSS layers, the neutral theme and the existing shared Button contract. Kora's shell, identity profile, Notes architecture and Focus/audio systems retain their owners. Final browser validation passes; Windows coverage is scoped to the native evidence described below.

## Decisions

| Gate | Result | Scope |
|---|---|---|
| Astryx tooling | PASS | Core, theme and CLI are pinned to 0.1.9; final doctor has six passes, zero warnings/failures and two informational checks. |
| Agent documentation | PASS | Official initialization plus Kora's bounded scope override and concise design-system guide. |
| Theme integration | PASS | Explicit reset/theme/component layers, actual tokens, portal reach and supported light product behavior. |
| Component adoption | PASS | The shared Button uses the documented Astryx primitive while preserving the public contract and Kora styling. |
| Visual regression | PASS | Seven final route/dialog surfaces, identity/mobile, keyboard containment and reduced motion pass with no runtime errors. |
| Windows compatibility | PARTIAL | Real WebView shell, Notes/images/Focus and lifecycle smoke pass. Physical display/capture/performance scenarios remain unproven. |

## Baseline and compatibility

Branch `codex/product-ux-upgrade` started this qualification at HEAD `513d7e5a0158443c221eb8e1dd5a3da4fc1df178`. Existing dirty work was preserved. The installed Core/theme were already 0.1.9, while manifest ranges and the tracked npm lock could resolve 0.1.2. The active app used the theme provider but no control primitive.

Core, `@astryxdesign/theme-neutral` and the project CLI now resolve 0.1.9. The tracked npm lock was updated as well as the current pnpm workspace. Existing transitive version changes are StyleX 0.18.3→0.19.1, jiti 2.6.1→2.7.0 and zod 4.3.6→4.6.7; the detailed lock comparison is retained with the bundle evidence. This is version alignment, not an upgrade to the newer public 0.7.x documentation examples.

Every adoption used the pinned CLI's actual API. `pnpm exec astryx --json doctor`, component inventory/Button API, styling/tokens/theme references and templates were inspected. Incorrect newer CLI syntax encountered during discovery was corrected; no skill implementation was changed. The CLI's postinstall was reviewed before allowing its initialization reminder.

## Adoption and cascade

| Surface | Baseline | Final decision |
|---|---|---|
| Theme provider | Neutral Core theme | Retained with explicit package/layer integration. |
| Shared Button | Kora HTML adapter | Astryx Button with preserved text/icon/type/disabled/callback/variant/size contract and existing utility classes. |
| Shell/navigation | Established Kora layout | Retained. |
| Identity profile | Qualified centered profile | Retained. |
| Notes editor/data/native windows | Specialized TipTap/repositories/Tauri | Retained; no replacement to increase adoption. |
| Focus, audio, Beat Grid and DnD | Established owners/contracts | Retained and preservation-checked. |

`src/index.css` loads the reset, component CSS and neutral theme with explicit layer order. Theme CSS keeps its own package layers instead of an extra outer base layer. `src/styles/astryx-bridge.css` maps actual tokens into Kora semantic aliases. The full upstream Tailwind bridge was not imported because it would replace existing scales. Existing Tailwind wrappers and specialized CSS remain valid within Kora's scope override.

The official managed block in `AGENTS.md` is followed by the bounded Kora rules and a link to [the design-system guide](../../docs/design-system.md). That guide points to the official CLI instead of copying a component catalog. The project-local setup is sufficient; a machine-wide CLI/skill installation was unnecessary.

## Validation and cost

Final representative checks cover Home, Today, Tasks, Notes, Focus, Beat Grid and a real task dialog containing Astryx-backed buttons. The identity modal and mobile Today were captured separately. Task keyboard focus remained contained, Escape closed the drawer, mobile had no horizontal shell overflow and reduced-motion preferences were active. A dark OS preference preserved Kora's supported light product mode; this is not a claim of a fully styled dark product.

The complete regression run passes 153 files and 1,244 tests, including the five final frame tests after the startup handshake repair. Seven native Notes tests pass. TypeScript and the production frontend build pass. Scoped lint has zero errors and one existing workspace-hook effect warning; no rule was disabled. Existing JSDOM media load/pause notices and a missing development ONNX source map are not physical audio test results. Protected checks pass for 88 source boundaries and three frozen models.

| Emitted assets | Change from baseline |
|---|---:|
| CSS | +130,709 raw / +23,319 gzip bytes |
| All JavaScript | +85,522 raw / +25,384 gzip bytes, including the final native handshake repair |
| Main entry | Approximately 23 KB against the existing 1 MB budget |

The total JavaScript delta includes Notes product work and cannot be attributed entirely to Astryx. CSS loading has a measurable cost. `scratch/astryx-recovery-261027-2144/final-bundle-comparison.json` records the exact final asset sizes/hashes and supersedes rounded values above.

Before/after screenshots are in `baseline-surfaces-verified/` and `final-surfaces-261028-1852/` beneath the same evidence directory. `doctor-final-1852.json` contains tooling results. The [source/build manifest](../../scratch/notes-completion-261027-1806/final-source-build-manifest-261028-1852.json) lists exact changed files and identities, including package files, CSS/provider/bridge, Button, agent guide and validation harnesses.

Actual Windows screenshots and connected-native image/offline/restart/sign-out evidence are linked in the [external Notes report](kora-p2-external-floating-notes.md). The late native registry cleanup has separate Rust/build validation. Additional generic primitives can be evaluated through the pinned CLI when an affected workflow needs them; no repository-wide migration is authorized. Physical display, tray/shortcut and combined capture/performance checks remain release prerequisites. No production deployment occurred.
