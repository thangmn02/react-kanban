# Task workflow and interaction rules

Home presents the first unfinished planned task, falling back to the existing Home service ordering. Its task metadata and Today’s due/priority reasons come from existing services; the interface does not invent personalized AI reasoning. Start Focus retains the existing intention step. Today exposes Focus, completion and planning together, with additional task groups collapsed initially.

Completion from Board, Task Detail, Today and Focus uses one [workflow service](../src/services/task-workflow.service.ts). Canonical ordered To-do / Doing / Done and Backlog / In Progress / Nearly Done / Done boards map completion into Done; dragging into/out of Done completes/reopens. Reopen restores the last valid active location, falling back to the first active column. Other/custom/reordered templates explicitly use completion-only mode without guessing a destination. Status, completion time, membership, positions, one activity and one recurring successor commit together. Reopen never deletes an existing successor. Connected work requires the [transactional RPC migration](../supabase/migrations/20261026163000_task_workflow_transition.sql); local mode writes a recoverable backup before one storage snapshot. Duplicate presses are locked while saving; removal happens only after success. Failures leave the task available to retry. Completed planned tasks retain their existing plan slots and appear as compact finished rows with Remove from Today, preserving the three-slot persistence contract.

Task details use the existing editor as a contextual overlay. The `task` and `taskBoard` query parameters identify the saved task while retaining the originating pathname. Requested boards are checked against the workspace’s boards; the editor waits for a fresh successful snapshot. Obsolete route requests are aborted and older snapshots cannot replace newer ones. Closing removes those parameters. Browser Back closes an opened contextual task. An already-open draft is retained during same-task live updates.

Saved HTTP(S) attachments are available in the editor’s context strip and open in another tab. Starting Focus from the editor requires saved changes, including pending checklist, label and attachment input. Save retains the editor’s existing save-and-close behavior.

Board filters remain in the existing workspace controller. Calendar month/day, Table sorting and route/panel scroll positions are retained in memory for the mounted user/workspace. These UI preferences do not add storage keys or schemas and are not promises of persistence after a full reload. Task and Focus persistence remain owned by the existing services/controllers.

The command palette supports arrow selection, Enter, Escape and contained keyboard focus. Its actions include Home, Today, Board, Calendar, Table and Focus. Focus returns to the command trigger even when a lazy route replaces the header. Lazy route fallbacks stay inside the workspace shell so navigation remains available.

## Motion ownership

Use [shared motion tokens](../src/shared/motion.ts) for finite UI feedback: a short opacity fade, damped layout spring, sortable easing and drop settling. Today animates task position/removal after confirmed saves. Board supports a lifted drag overlay, neighboring sortable movement and authoritative reconciliation after failed optimistic moves. The task grip supports Space/arrows/Space, while blank card content retains existing pointer dragging; list headings remain their drag targets.

Reduced motion disables layout travel and sortable/drop animation. Preserve focus visibility and readable status text. Do not add continuous animation to ordinary task operations. Dock tabs retain mounted panels, the moving indicator and the same host/controller; mode changes receive finite opacity/position feedback. Route loading must not key or remount Focus providers or the Dock host.

P3 exclusively owns Beat renderers, Kinetic/Heartbeat/Exclusive semantics, event timing, capture, detectors and compensation. UX may style the surrounding toolbar and tabs but must not change renderer selectors. Dock base CSS is scoped to `.floating-focus`; the prebuilt Astryx theme keeps its CSS in the base layer so application utilities remain authoritative. See [Focus lifecycle](focus-workflow.md) for playback/PiP ownership.


## Profile and settings

The user avatar opens an identity card on desktop and a bottom sheet on narrow screens. Settings edits name and a proportional square crop, keeps provider-managed email read-only, and reuses persisted language preferences. Light is the supported theme; timer/music settings remain in Focus. PNG/JPEG/WebP inputs are bounded to 5 MB and 40 megapixels; the processed 512px image is at most 512 KB. Cancel leaves the saved profile unchanged. The Kora artwork is the default.

Connected profiles use private, account-prefixed image storage and version-checked profile updates. Apply the [image storage migration](../supabase/migrations/20261026170000_private_profile_images.sql) only after database backup and hosted policy qualification. Shared-workspace members can read the current identity image; other accounts cannot write it. Replacement/reset retires previous owned objects after the profile pointer is confirmed. Failed cleanup is reported and queued for the next save. Logout retains only the opaque object-name deletion worklist (no image bytes, signed URLs or credentials); all other user caches are cleared. A retry still requires the same authenticated owner under Storage RLS. Local personalization stays on this device and uses the existing user-scoped storage namespace. Stable assignee IDs remain authoritative; display projection does not rewrite another member or historical task assignments.

## Historical consistency audit

Run `node scripts/audit-task-workflow.mjs snapshot.json` with exported `lists` and `tasks` rows. The tool emits counts and before/proposed metadata only, including expected update versions. It never connects to a database or executes repairs. Keep snapshots/previews private. Missing lists, ambiguous status intent and historical timestamps require an explicit review decision; do not infer past completion times or automatically repair existing user data.

Integration builds do not authorize release. P3 remains qualified only within its tested presentation scope; P4 Engineering is PARTIAL and Production Release is BLOCKED pending combined hosted/native/physical qualification.
