# Astryx integration recovery

Status: implementation and available qualification delivered; physical Windows/workload gates remain partial. This adds to the active [Notes and external windows plan](../261027-1806-connected-ghost-notes/plan.md); it does not replace its acceptance criteria. Preserve the dirty working tree on `codex/product-ux-upgrade`, admission HEAD `513d7e5`.

Core/theme/CLI are pinned to the tested 0.1.9 API; the tracked npm lock resolves the same Core/theme/CLI and required image dependency. The official agent initialization and bounded Kora guide are present. CSS layers/reset/components load explicitly, and the shared Button adapter renders Astryx while preserving its contract. Doctor reports six passes with no warnings/failures. Final browser evidence covers seven route/dialog surfaces plus identity/mobile, real adopted controls, keyboard focus containment, reduced motion and the supported light product theme under a dark OS preference; no runtime errors occurred. TypeScript and the full regression pass; exact final counts are in the audit. Scoped lint has zero errors and one existing workspace-hook warning.

The final build passes. Compared with the baseline, CSS grows 130,709 raw / 23,319 gzip bytes; the final manifest records all emitted JS including Notes product work, so that JS delta is not attributed entirely to Astryx. The main entry is 22,741 bytes against its 1 MB budget. Actual Windows renders the shell/Notes/images/Focus, performs five-note restart/quit and connected interruption recovery, and passes the final concurrent-open/Restore/first-quit test. See [the completed audit](../reports/kora-astryx-integration-audit.md), `docs/design-system.md` and evidence under `scratch/astryx-recovery-261027-2144/`.

## Outcome and boundaries

Establish a version-compatible, project-local official Astryx CLI, generated agent instructions and a concise Kora guide. Verify the actual theme, CSS layers and token bridge, then migrate only shared primitives where the documented component improves behavior or accessibility. Preserve the dark rail, muted context, light canvas, blue actions and restrained motion. Identity profile, Notes persistence/editor, Tauri windows, Focus/audio, DnD and frozen P3 contracts stay protected. No production deployment or repository-wide visual migration.

## Execution and acceptance

1. Capture installed versions, actual rendered usage, CSS/build baseline, existing instructions and owning documentation. Compare official CLI/Core/theme peer contracts before changing dependencies.
2. Install a matching project-local CLI; run doctor, component list, migration/styling/tokens docs, theme list and template list. Review official initialization output while preserving Kora instructions. Evaluate user-level setup without making an unnecessary machine-wide change.
3. Repair CSS/reset/layer/token integration based on the installed API. Select one shared primitive at a time; read its exact documentation and preserve public behavior.
4. Capture representative before/after browser and Windows evidence. Run focused React tests, TypeScript, lint, production build and bundle comparison; verify portals, keyboard focus, responsive layout, reduced motion and supported theme modes. Recheck Home/Today, tasks, Notes, Focus, identity, collaboration and Beat Grid.
5. Review changes, update the smallest owning guide and publish `plans/reports/kora-astryx-integration-audit.md` with independent tooling, agent documentation, theme, adoption, visual and Windows gates.

Evidence belongs in `scratch/astryx-recovery-261027-2144/`. Unresolved decisions and physical qualification gaps remain explicit. The opening audit found installed Core/theme `0.1.9`, despite manifest ranges beginning at `0.1.2`; only the theme provider currently imports an Astryx React component. This is not broad component adoption.
