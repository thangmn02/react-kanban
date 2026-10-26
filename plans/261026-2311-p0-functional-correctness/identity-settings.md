# Identity, settings and card integration

Status: implemented; local tests pass, connected and native executable qualification remain blocked. Release scope includes UX, P0, P3 and identity/settings for Web and Windows; publication remains gated on integrated qualification, with P2 detectors frozen.

Existing architecture: UserMenu is a simple dropdown; AuthProvider owns authenticated identity; profiles owns member display metadata; workspace services currently upsert auth snapshots into profiles; no avatar storage bucket/policies are defined in the repository baseline. Language already persists through I18nProvider. Only Light is implemented coherently across application tokens. Existing cover utilities belong to tasks/boards, not personal identity.

Implementation decisions:

- Evolve UserMenu into a dialog-style identity card and accessible mobile sheet. Reuse Framer motion, shared easing, current trigger and modal-focus handling.
- One Settings dialog edits display name/avatar using AuthProvider. Email stays read-only. Language uses the existing provider; appearance honestly reports the supported Light theme. Link to existing Focus settings for timer/music preferences rather than duplicating their persistence.
- One square/circular avatar crop with proportional cover math, bounded zoom/reposition, preview/cancel/default restore. No separate identity-cover field is invented where the profile model has none.
- Use existing Kora logo as the identity fallback. Local personalization is explicitly device-only and uses the current user-scoped storage adapter contract with strict failure reporting.
- Authenticated profile rows become authoritative for personal name/avatar; auth/provider fields remain untouched. Upload processed bounded raster images to a private user-prefixed bucket, then compare-and-set profile metadata. Propose the smallest owner-write/current-workspace-read policies; no unrestricted public upload. Apply hosted changes only after backup and qualification.
- Reconcile current profile into workspace/member displays by stable identity; support existing legacy self-name fallback without rewriting historical task data. Do not modify another member’s profile.
- P0 owns completion/membership rules; card motion only reflects persisted transitions. No detector/audio/timer engine changes for identity work.

Acceptance: actual local browser save/reload/cancel/crop/default/language tests; upload validation and stale/failure tests; security/migration validation; responsive, keyboard and reduced-motion checks. Connected upload/sign-in and Web/Windows release gates must be reported separately when unavailable.

Deliverables: plans/reports/kora-user-identity-settings-card-motion.md and plans/reports/kora-p0-functional-correctness.md. Preserve dirty work, research evidence and existing production installations.
