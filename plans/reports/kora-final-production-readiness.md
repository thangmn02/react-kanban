# Kora final production readiness — October 29, 2026

**NO-GO — BLOCKED.** The full product source is prepared, with a signed 0.1.32 candidate retained locally. Production web assets, installer, updater feed, Companion and database have not been replaced. This report does not authorize deployment. The earlier commit/push request remains separate from production promotion.

## Release matrix

| Workstream | Result |
|---|---|
| Astryx Design System | PASS within the agreed bounded integration |
| P0 Data Durability | PASS within tested transactional/local-acknowledgment boundaries |
| P0 Security & Recovery | PARTIAL; database recovery verified, private Storage bytes unverified |
| P1 Workflow & Collaboration | PASS in tested local/staging scope |
| P2 Windows Native | PARTIAL; actual external-window tests pass, hardware and final-release matrix remain open |
| P3 Beat Grid Preservation | PASS for frozen source/models and scoped software regression |
| P4 Engineering | BLOCKED for full advertised production scope |
| Companion Compatibility | PARTIAL |
| Companion Version Decision | KEEP — 0.3.24 |
| Release Artifact Security | FAIL as a complete release gate; credential/signature checks pass, distribution rights remain unresolved |
| Staging Qualification | PASS for 14 committed migrations, 22 service groups and 13 browser scenarios |
| Production Release | NO-GO |

## Baseline and workstream inventory

Admission HEAD is `513d7e5a0158443c221eb8e1dd5a3da4fc1df178` on `codex/product-ux-upgrade`; GitHub main is an older baseline. The checkout contains substantial unrelated acoustic research, which is excluded from this product commit. The release receipt records the eventual candidate commit separately from admission. An earlier binary or receipt is not relabeled as the final connected candidate.

| Workstream | Inventory and production relevance |
|---|---|
| Centered identity, Settings, adaptive shell | Implemented and preserved; required. Browser tests cover focus, mobile, reduced motion, image validation/cancel/default and workflow continuity. Actual earlier connected Windows evidence covers sign-in, profile picker/crop/save/cancel. |
| Task correctness, Today/Board/Focus, collaboration | Implemented; local/staging permission and transition tests pass. Production history/schema reconciliation and reviewed historical decisions remain required. |
| Notes, Quick Notes, task comments, Saved Context | Implemented and qualified in the tested local/staging scope; required. Same originals, current-access references and durable recovery remain authoritative. |
| External Windows notes | Implemented; actual topmost, click-through, image/offline recovery and guarded lifecycle evidence exists. Display/sleep, complete Companion integration and final-release soak remain unqualified. |
| Astryx | Bounded shared Button/theme/tooling integration complete. Specialized editor/native/audio systems intentionally retain their owners. |
| Frozen Beat Grid | Preserved. Existing model, input, compensation, event and presentation decisions are not reopened. Physical timing, supported-platform soak and rights are release blockers. |
| Private Companion/acoustic experiments | Research-only; 0.3.25 diagnostic capture and 0.3.26 hybrid candidates are not selected for publication. |
| Deferred product expansion | General highlights, notebooks/databases, CRDT, AI categorization, publishing and a separate Notes application remain explicitly outside scope. |

## Astryx

Core/theme/CLI are pinned to 0.1.9. Official initialization, repository guidance, token ownership and exact CLI discovery are documented in [the design-system guide](../../docs/design-system.md). Doctor reports six passes, zero warnings/failures and two informational checks. Seven browser route/dialog surfaces plus identity/mobile, keyboard containment, portal tokens and reduced motion pass. The main entry remains 22,741 bytes; the final compared build adds 85,522 raw / 25,384 gzip JS bytes and 130,709 raw / 23,319 gzip CSS bytes over the earlier baseline. JS growth includes product work and is not attributed entirely to Astryx. See [the audit](kora-astryx-integration-audit.md).

## Data correctness, authorization and recovery

Browser Notes use IndexedDB transactions for canonical content, outbox and history; Windows uses actor-scoped DPAPI journals and flushed atomic replacement. Cross-note status never acknowledges an unfinished local transaction. CAS/idempotency, retained conflicts, selected private import, soft deletion, revision history and account fences are tested. Close preparation covers first-read/startup delivery, cancellation and replaced writers. See [Notes completion](kora-p0-p1-p2-notes-completion.md).

Staging is `enzzyuhchizfmruxhfhg`; production is independently verified as `lthlvntvjgnornrdxnms`. Actual staging identities exercise owner/admin/member/viewer, collaborator/revocation, unrelated and cross-workspace boundaries. Image writes use caller Auth/RLS reservation before privileged Storage upload. Saved previews re-resolve current access. Generated staging fixtures were cleaned.

Production inspection used TLS verification and read-only transactions. Database recovery now uses one exported read-only repeatable snapshot for metadata, row fingerprints and `pg_dump`, allowing live Auth refreshes without an inconsistent dump. An isolated, networkless restore verifies all owning row values/counts, schemas, policies/grants/triggers, provider metadata and publication membership. Source double formatting and regclass schema qualification are explicitly normalized on both sides; strict hashes remain enforced. The complete database archive is DPAPI-encrypted with a user-only ACL outside OneDrive.

Database recovery is not Storage byte recovery. Production has 31 private Storage objects. Those bytes have **not** been backed up/restored: the image-backend secret is not reused for this purpose. Full recovery remains blocked until separate authorized object-backup access and isolated byte/reference verification exist. DPAPI CurrentUser also requires this Windows identity or an independently secured recovery route; the local archive is not an off-device disaster-recovery claim.

Private recovery manifest: `%LOCALAPPDATA%/Kora/backups/production/evidence/1793207547437/backup-manifest.json`. Detailed records remain private; no backup credentials or user records belong in Git.

An updated production historical preview inspected 24 tasks without writes: 14 findings across nine tasks, comprising nine completion/timestamp mismatches and five completed tasks in active lists. The detailed before-images/proposals are encrypted in private AppData. Historical completion times remain unknown; no repair time is invented and no reconciliation is performed. The product owner must review this preview separately before authorizing repairs.

## Workflow and native qualification

The complete built-product browser matrix passes 33 cases. It covers the centered profile, Settings, task CRUD/transitions and drag, Today/Board/history/context, responsive shell, retained state, Focus continuity, note conflicts and draft export. Notes-specific staging adds 13 real authenticated cases, including comments, grants/revocation, private images, conversion, import and outage/reload. Five local Quick Notes workflow groups cover task/comment references, history, Open original and Focus capture. These are complementary scenarios; they are not presented as one uninterrupted end-to-end native music session.

Actual Windows evidence covers external editing/images, Always on Top, click-through into an owned Notepad surface, independent recovery with main minimized, 64×64 bubble restore, five-ID restart, five-note Focus smoke and connected encrypted-outbox interruption/recovery. A final embedded build passes eight concurrent opens returning one frame, duplicate-free Restore and first guarded quit. The connected interruption binary and final embedded binary have different recorded hashes; neither is silently substituted for the 0.1.32 connected release executable.

Debug text-window measurements show approximately 257 MiB additional private memory at five windows, on a 16-logical-CPU / 27.8 GiB host. Short samples do not establish a production budget or long-session performance. Multiple-monitor hot-plug, DPI changes, sleep/resume, physical tray/shortcut conflict, renderer-only failure and combined Notes/Focus/Beat Grid/capture soak remain open. Desktop input was released; no personal browser profile was automated. See [Windows evidence](kora-p2-external-floating-notes.md).

## P3 and P4

Fresh preservation checks pass for 88 protected source boundaries and three frozen model hashes, allowing only scoped native dependencies/capabilities and a matching monotonic release-version increment. The verifier uses the recorded admission commit, not a moving HEAD. Unit/browser tests retain event identity, deduplication, exclusive ownership, reduced motion and Focus routing. Previous 50-case 60/120 software matrices and full-song evidence retain their original source/build provenance.

The new connected 0.1.32 artifact has not completed the final full-song/difficult-region, physical timing or long-session/platform matrix. Existing P4 evidence cannot be relabeled as that artifact's soak. [The owning P3/P4 report](p3-p4-implementation-and-qualification.md) records unresolved calibrated A/V timing, target-platform/Spotify policy coverage, weaker-device budgets and model/distribution rights. ADTOF's shipped notice explicitly retains unresolved CC-BY-NC-SA rights; CNN/checkpoint/data and SoXR obligations also require clearance. No model selection or compensation change is proposed to bypass these gates.

## Companion decision and research isolation

**KEEP STABLE COMPANION — 0.3.24.** No Notes/task/native contract requires promoting the research candidate. The tracked stable manifest matches the existing branch/main version. The selected generated package has 52 entries and SHA-256 `1cf9a2f9c747434123523573071fbd4377ed6c3bb71765f6d0a313e8675fddcb`.

The inspected research artifact is `scratch/cross-track-hat-capture/candidate/extension`, manifest version 0.3.25 with `continuous score capture PRIVATE RESEARCH`. Fifteen matching package files differ from the selected stable package; manifest permissions and host permissions do not expand. The candidate enables private mode and early decision availability; this changes behavior despite protocol `kanban-music-v1` remaining named the same. It is not a qualified production upgrade.

The recorder collects bounded score/frame, batch, emission/issue, timing/coverage and source/capture/generation metadata. It does not store raw PCM in its recorder buffers, and the recorder class has no network/file persistence. Private harness exports can contain media/source identifiers and remain private. Stable packaging retains an inert diagnostic helper, but both its package flag and offscreen/capture entry guards reject private recording; private flags are false, early-finalization code is excluded, and no research audio/trace fixture is in the selected ZIP. Presence of that inert helper is documented rather than described as its absence.

Full compatibility is still PARTIAL: current-source protocol/native/Companion regressions pass, but the complete new-desktop/installed-extension/web, service-worker restart, suspend/resume, one-click update and long-playback matrix has not run against this release candidate. Installed version cannot be inferred from packaged version. No Companion update is forced or published.

## Candidate artifacts, security and reproduction

The prepared connected version is 0.1.32, using the existing application identifier and updater key. The installer and trusted-comment signatures verify; a tampered copy is rejected. Exact configured private credential scans find zero matches in JS, native executable and installer bytes. The first scanner match was the public Turnstile site key and was correctly classified as public configuration; no secret was printed. The private image endpoint is `https://koraspace.online/api/note-images`; Notes is enabled only in the held candidate, not live production.

| Artifact | SHA-256 |
|---|---|
| Windows installer | `716f76685aed6ae3f2f80ed9e51b6318296870929df97885eb6edcb77b084aa7` |
| Connected release executable | `8fa9cf7f4733013bfe4defda7ecae573a16accf2d229bb0fb338651183ea8fab` |
| npm dependency lock | `5d1593b8192f57a881d2fd8970ec3ba534669c1ca42f25644be2590703885f39` |

The detailed web asset, Companion comparison and signing inventory is `scratch/product-completion-261027-0846/release-candidate/artifact-audit.json`. Earlier source/build manifests remain distinct. Current evidence includes 1,244 unit tests, 27 full native tests, 33 built-product browser cases, four snapshot-lifecycle tests, four negative backup guards, TypeScript and scoped lint with zero errors/one existing workspace-hook warning. Clean committed-source/dependency reproduction and final gate closure are separate requirements before GO.

Relevant commands are `pnpm exec vitest run`, `cargo test --manifest-path src-tauri/Cargo.toml`, `pnpm exec tsc -b`, the built-app `playwright-integration.config.ts`, `scripts/verify-p3-p4-preservation.mjs` and the staging verification commands in [connected recovery](../../docs/connected-qualification.md). Production backup mode is read-only; `--database-only` deliberately cannot produce a complete Storage recovery PASS. Private credential files and backup bytes are excluded from Git and staged-content scanning is required before every commit.

## Production migration and rollback plan

Production records `20260713000000`, `20260913120000` and `20261007080000_sparse_beat_cache`. The last version is historical and absent from the current 14-file source set. Twelve current source versions have no matching history entry, but absence from history is not proof that every object is absent: production already contains the contact tables, while the source contact migration uses unconditional `CREATE TABLE`. The history is not an exact prefix, so neither initial staging initialization nor blind incremental replay is appropriate.

1. Complete independent Storage recovery and retain the verified encrypted database snapshot. Define recovery-point limitations and approved provider/off-device recovery.
2. Compare existing recurrence/contact/beat-cache definitions and retain all three historical entries. Rehearse an explicit reconciliation/additive plan on the recovered production clone. Do not reapply the squashed baseline, drop existing tables or rewrite user rows.
3. Review task transition/profile/Realtime and the seven Notes-related migrations, task comments/history/references and image policies. Record exact hashes and expected object/policy/publication changes. Preserve existing contact and cache data.
4. Obtain separate owner authorization for the exact migration/reconciliation set. Historical task repairs need a separate reviewed before-image/CAS decision and are not implicit in migration approval.
5. After all mandatory gates pass, propose the matching function configuration, connected web build and signed Windows installer/feed promotion. Netlify Functions reads `SUPABASE_SERVICE_ROLE_KEY` at runtime; no `VITE_` service secret is permitted. Preserve the existing HTTPS updater origin and atomic installer/feed workflow.
6. Retain the prior Netlify deploy ID `6aceb65d7544427364f295f3`, production 0.1.31 feed and matching downloads. Web rollback restores that complete deploy. Database/Storage recovery is a separately authorized operation; rolling web assets back does not undo committed data/schema changes.

## Remaining issues and owners

| Issue | Severity, impact and measurable acceptance | Owner |
|---|---|---|
| Private Storage recovery | Critical for migration approval: recover all 31 object bytes/references under approved access and verify hashes/permissions in isolation. | Product owner + database operator |
| Non-prefix migration history/existing contact objects | Major: reviewed exact schema/history plan and successful isolated rehearsal, followed by explicit authorization. | Release engineer + database owner |
| Nine historical task records | Major correctness review: approve exact before-image/CAS proposals and historical timestamp policy; no automatic repair. | Product owner |
| Final native/Companion/display/lifecycle matrix | Major for advertised native scope: actual target hardware/version combinations, monitor/DPI/sleep, restart/reconnect and 30-minute representative workload, with measured limits and cleanup. | Desktop QA + product owner |
| Physical timing/weaker-device budget | Major for advertised timing/performance: calibrated source-to-display distribution, late/missing/rapid-hit counts and approved supported-device thresholds. | Product/audio QA |
| Model/runtime rights | Critical publication blocker: documented permission and fulfilled attribution/source/distribution obligations for each shipped asset/runtime. | Product owner/rights holder |
| Coherent final source/build reproduction | Major: committed tree, lock, generated packages and production-equivalent backend/native/web identities verified together. | Release engineer |

No production migration, user-data repair, restore, function-secret update, web deployment, installer/feed or Companion replacement is authorized by this report. The next release decision remains **NO-GO — BLOCKED** until the listed mandatory gates close; changing the supported product scope requires explicit owner review.
