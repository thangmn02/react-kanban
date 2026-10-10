# Kora dock and desktop save follow-up

Status: implementation, 449 tests, typecheck and installer build pass; acceptance and
diff approval pending. No push or hosted schema operation is authorized here.

## Outcome and boundaries

- Current web and desktop bundles share the task-save compatibility fix.
- Dock has readable glass; Tasks remains a normal opaque window.
- Arrow-only layout switching preserves the timer/grid and color preferences.
- Held shapes brighten on real accents or confident audio-tempo ticks, without
  a breathing loop; pause, silence and capture loss clear them.
- Keep browser-only music capture, existing authentication and user data intact.

Design brief: Product register; Windows/browser focus sessions; preserve the
existing light glass, dark text, pastel matrix, typography and edge-to-edge
panels. Signature: a stable illuminated shape with discrete audio-driven hits.
Keep the accepted shared-element motion and five layouts; no unrelated redesign.

## Evidence and phases

1. Confirmed the previous web page was stale with no dev-server owner. Started
   current code and saved the requested “Viết kanji” task through the signed-in
   UI, then opened the persisted task. Do not create a duplicate for testing.
2. Running installed Kora predates the last installer build. Rebuild the complete
   workspace as 0.1.4; do not overwrite or stop a running app with an open draft.
3. Focused tests and rendered synthetic CSS checks verify layout, timer controls
   and shape flashes. Run the full suite, typecheck, lint and native build.
   Exclude Cargo target output from Vite's watcher after confirming a Windows
   executable-lock EBUSY crash during the native build.
4. Provide installer and combined diff for review. Native save and Windows glass
   still require verification in the newly installed build.

## Safety and rollback

Recurrence/attachment SQL remains a review-only proposal, not an applied hosted
migration. Never silently drop non-empty user choices. Preserve prior installers
for rollback. Do not commit environment files, credentials or user-data screenshots.

## Acceptance

- User confirms a task saves in newly installed Kora, not only localhost.
- Five layouts remain usable at narrow widths; time remains directly editable.
- Held shapes visibly flash repeatedly to captured music and clear on silence.
- Glass is readable; only Dock stays on top.
- Review is delivered before any commit/push/deployment.
