# Data and native execution contracts

Status: implementation decisions, subject to evidence-backed review.

## Authorization and images

The existing Notes domain tables must leave Postgres Changes: physical DELETE events bypass row RLS and expose primary keys. Use private `notes:user:<uid>` Broadcast topics with identity-only receive policies, restrictive cross-user/client-send guards and transactionally targeted old/new audiences. Messages contain only an invalidation version. All clients re-query RLS. Never bump content revision just to notify.

Staging backup `scratch/notes-completion-261027-1806/staging-before-notes/backup-manifest.json` now restore-verifies current row counts and row-value fingerprints, platform definitions and owning ACLs, plus encrypted Storage bytes extracted and hash-verified in the isolated container. Provider infrastructure recovery remains separate. Apply only new additive migrations after local compatibility/auth tests and review; keep the original eight migration bytes unchanged.

Private images use reserved opaque attachment IDs and metadata tied to the parent note. No authenticated direct metadata DML or arbitrary object upload. A small server upload handler authenticates the actor, validates actual image structure/dimensions/size, reserves through the actor's RPC, writes only the canonical object path with a server credential, then finalizes under current actor permission. Native and web use the same contract. Server credentials never enter frontend builds. Qualification can run that exact handler locally against staging without deploying production. Use authenticated image downloads and short-lived local blob URLs; invalidate them on account/resource changes. Soft deletion preserves media for restore. Explicit unused-asset cleanup must check the current document and permit retry.

Keep the current versioned HTML/checklist content format. Image nodes serialize attachment identity and dimensions, not large data URLs or signed capabilities. Device media uses account/note-scoped storage. Export uses a bounded versioned portable bundle with validated media; import creates authorized private copies and new asset identities, remains duplicate-safe, and retains originals. Unsupported or inaccessible task/media links require an explicit user choice, never silent dropping.

## Presentation and repository

Add optional, backward-compatible presentation fields: opacity, curated color, font size, in-app floating pin, hidden, bubble/collapse and manual click-through. Collection pin keeps its existing meaning. Peek remains temporary. Native placement, bubble bounds and Always on Top stay per device. Freshly restored native windows start interactive; a stale Ghost preference must not strand a window.

Reuse the Notes session contract across local, connected, in-app and native surfaces. Native windows own editing drafts, not a second canonical database or auth system. Ref-count account invalidation subscriptions and clean them immediately on identity invalidation. Keep failed/conflicting drafts exportable. A newly accepted native local save needs an atomic flushed journal acknowledgement; localStorage alone must not be advertised as process-crash durability.

## Native architecture

Use minimal note-only WebViews, without mounting AppLayout, Focus, Music or a second authentication owner. The main app brokers authenticated repository/media operations; targeted messages are bound to a registered opaque window context. Note windows receive no privileged credential. Native commands validate their caller, operation, registered actor/note scope and payload size. Keep private content/IDs out of OS titles and global IPC broadcasts; obtain resource context through a scoped native command rather than a public URL query.

Rust owns the note-to-window registry, atomically saved per-device bounds, monitor/DPI clamping, window flags, lifecycle and local durability. Reuse an existing window for a note. Native ignore-cursor-events is distinct from CSS opacity. Tray controls provide New Quick Note, Restore Notes and Notes Manager while main is minimized, plus the existing quit policy. Global capture shortcut registration is explicit opt-in, configurable and conflict-aware, with app-scoped fallback. Release registrations on quit. No hidden standalone background Notes app.

Native movement events can feed the same finite deliberate-shake rule; suppress shake while resizing. Ghost and Peek always have independent tray/main recovery. Explicit quit/account change flushes recoverable local state where possible, closes/locks note windows, and cleans subscriptions. Forced termination qualification occurs only after a verified durable local acknowledgement.

Measure baseline and 1/3/5 active windows, bubbles, images, Focus and available capture before setting a budget; do not add an arbitrary cap. Hardware-dependent monitor disconnect/DPI/sleep/capture conclusions require actual evidence or explicit unqualified status.
