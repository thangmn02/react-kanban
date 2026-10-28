# Kora Notes qualification — October 28, 2026

Notes now supports capture, linking, action and resumption through one original document. The available local, hosted staging and Windows tests pass. Production release remains blocked by the physical and combined performance checks identified below; this report does not authorize deployment.

## Qualification decisions

| Area | Result | Verified scope |
|---|---|---|
| P0 Data Durability | PASS | Real IndexedDB interruption/CAS/outbox tests, encrypted Windows journals and actual connected-native forced interruption/recovery. |
| P0 Authorization | PASS | Owner/member/viewer/unrelated isolation, current-access references, private images/history and revocation. |
| P0 Hosted Staging | PASS | Fourteen committed migrations, verified recovery prerequisites, 22 service groups and 13 browser scenarios on `enzzyuhchizfmruxhfhg`. |
| P1 Quick Notes Anywhere | PASS | Header, command/app shortcut, task drawer and Focus use shared scoped repositories. Five actual local workflow groups pass. |
| P1 Saved Context | PASS | Actor-private references resolve current originals; deleted/archived/revoked content loses its preview. |
| P1 Task/Note Linking | PASS | Same-ID task notes, minimal task comments, Save/Open original and idempotent whole-note/selection conversion. |
| P1 Notes Manager | PASS | Search, selected private import/export, duplicate-safe retry, retained originals, Trash/Restore and same-note history. |
| P2 External Floating Notes | PARTIAL | Real native editing, images, topmost, click-through, bubble and independent recovery pass; physical/capture workloads remain open. |
| P2 Native Lifecycle | PARTIAL | Clean quit, five-ID restart, connected offline interruption and sign-out isolation pass. Physical sleep/display and isolated renderer-crash exercises remain open. |
| Windows Native E2E | PARTIAL | Actual Windows/WebView2 evidence is available; a physical tray-menu click, global-shortcut conflict exercise and hardware transitions remain unproven. |
| Focus & P3 Preservation | PASS | 88 protected source checks, three frozen models, regressions and a native Focus start/pause smoke with five notes pass. Physical audio timing is outside this PASS. |
| Production Release | BLOCKED | Complete the outstanding physical/performance matrix and qualify the deployed image endpoint before promotion. |

## Product scope

The implementation follows the urgent workflow correction. Quick Notes captures an original without manager navigation. Notes Manager organizes and recovers originals. Saved Context stores an actor, source type and original ID for tasks, task comments, notes and note comments; it does not copy content into new notes. Task comments are the minimal feature explicitly selected by the user.

Existing TipTap documents, private images, CAS/idempotency, deliberate imports, identity profile and Focus/audio ownership were retained. Further formatting, decoration and animation expansion stopped. General highlights, notebook/database hierarchies, CRDT and AI categorization remain outside the accepted scope. Saved-reference, in-app floating and native Always on Top remain separate states.

## Persistence and failure handling

Browser canonical notes, before-image history and drafts use real IndexedDB transactions. A transaction must complete before a local save acknowledgement. localStorage serves as a compatibility/adoption mirror. Windows canonical content and outboxes use actor-scoped DPAPI records, flushed atomic replacement and conditional retirement. Shared device/connected sessions serialize edits from manager, Quick Notes and native frames.

Connected writes use authoritative revisions and stable operation tokens. Confirmed content commits advance the pending base/token before later layout or retirement work can fail. Retry lineage is specific to the native frame, preventing an old frame from overwriting a later manager edit. Failed local transactions retain an exportable draft and block leaving. Close handshakes freeze frames until a transition commits or is canceled; sign-out, workspace selection, invite reload, onboarding and retry use the serialized transition path.

An actual TipTap regression was reproduced: changing editability emitted a content update and could conflict with an import. `setEditable` now suppresses that event. Import completion preserves device presentation and retries missing layout without rewriting later remote content. Destroyed native windows release their registry/request entries; independent Restore revalidates the saved catalog. Scope status waits for every pending local transaction, including when another note finishes or fails remote synchronization. Startup close requests travel through both the event listener and the initial context nonce; canceled context responses cannot revive a freeze.

## Authorization boundaries

| Resource | Boundary |
|---|---|
| Personal/private notes | The owner controls access and management. Explicit workspace grants require current membership. |
| Workspace-visible notes | Current membership controls visibility; viewers remain read-only unless explicitly granted additional access. |
| Sharing, deletion and movement | Note-owner management uses current actor/revision checks. |
| Task comments | Current task/workspace access is required; author/admin mutations use CAS and operation identities. |
| Saved Context | References belong to the actor. Preview/Open original recheck current source access; stale references remain removable. |
| Revision history | History is owner-private; restore changes the same original through CAS. |
| Images | Private Storage reads require live parent access. Upload/finalization validates the actor and editable parent on the server. |
| Invalidation | Private actor topics send a version wakeup, followed by authoritative reads; deleted resource IDs are not broadcast through public row changes. |

Membership removal retires explicit grants, and rejoining does not revive them. Account/workspace changes invalidate old native frames and subscriptions. Native frames receive scoped document/media messages; the main WebView owns authentication and repository operations.

## Evidence

Evidence paths below are relative to the repository. They contain generated/private qualification artifacts and stay outside Git.

- `scratch/notes-completion-261027-1806/browser-durability/results.json` records six actual browser transaction/interruption groups.
- `full-regression-sealed.log` in that directory records 153 files and 1,244 passing tests, including the five frame tests for startup close delivery and cancellation. TypeScript passes. Scoped lint reports zero errors and one existing `useWorkspaceSession` effect warning. JSDOM media load/pause messages are not audio qualification.
- `native-final-rust-tests.log` records seven passing Rust journal/catalog/registry tests, including stale acknowledgment invalidation when a frame writer is replaced. Final review found no remaining concrete concern in the reviewed lifecycle fixes.
- `native-final-smoke.json` records the final embedded build: eight concurrent opens reused one frame, catalog Restore created no duplicate, and the first guarded quit exited the exact owned process with no runtime errors.
- `staging-committed-261028/staging-migration-result.json` records the atomic six-migration addition and postverification. The original eight migrations were not reapplied.
- `staging-before-final-browser-261028-1852/backup-manifest.json` records a fresh encrypted database/Storage-byte backup and actual isolated restore. Admission also compared row values, policies/triggers/grants, provider enforcement and publication membership. Hosted rollback rehearsal verified unchanged state before commit.
- `staging-notes-services-261028`, `staging-workflow-services-261028` and `staging-image-services-261028` record the 22 hosted service groups.
- `staging-browser-sealed-261028/results.json` records the final rerun of 13 real authenticated browser scenarios, including image upload/download/keyboard resize/reload, sharing/comments/revocation, outage recovery, task continuity, conversion, selected import, Peek and personal isolation.
- `quick-workflow-browser/results.json` records five final local workflows: capture/resume, same-note history, task/comment context, Open original and Focus capture.
- `native-connected-final-261028-1852` records a real staging note/image in an external window, an aborted-transport edit, encrypted outbox read-back, exact-PID forced interruption, same-token recovery with one new revision, retained image, sign-out isolation and clean quit. Recovery initially reached a compact manager preview; the harness expanded it and reconciled the already-committed operation without replaying it.
- `final-fixture-audit-1852/cleanup-verification.json` verifies removal of both task-owned native staging identities, workspaces, notes, profiles and private image objects. Other service/browser fixtures were cleaned by their generated IDs. Production was not modified.

## Source, builds and remaining gates

Branch: `codex/product-ux-upgrade`. Admission HEAD: `513d7e5a0158443c221eb8e1dd5a3da4fc1df178`. The existing dirty tree was preserved; no commit or deployment was created.

The [exact source/build manifest](../../scratch/notes-completion-261027-1806/final-source-build-manifest-261028-1852.json) lists changed delivery files, full SHA-256 identities, native binary/config identity and the frontend asset manifest. Core owners are `src/features/notes/`, `src/pages/notes/notes-route.tsx`, the Notes/Saved Context services, six additive migrations, `server/note-images.ts`, the two Rust Notes modules, lifecycle/navigation wiring and qualification scripts. Unrelated research files are excluded from that scoped manifest.

See the [external Windows report](kora-p2-external-floating-notes.md) for measured resources, screenshots and independent native gates, and the [Astryx audit](kora-astryx-integration-audit.md) for adoption, cascade and bundle evidence. Physical display hot-plug/DPI/sleep, renderer-only failure, physical tray/shortcut interaction and image/Focus/Companion/Beat Grid frame-pacing workloads remain release prerequisites. The production image handler is prepared but was not deployed; native connected uploads require its securely configured approved endpoint in a release build.
