# Identity, settings and card motion qualification

USER/SETTINGS: **PARTIAL**. CARD MOTION: **PARTIAL** across Web and Windows. Local browser behavior passes; connected storage/auth flows and a fresh native executable remain unqualified. P3 remains PASS in its tested presentation scope, P4 Engineering PARTIAL, Production Release BLOCKED.

## Delivered behavior

The existing avatar trigger opens a desktop identity card (180 ms fade and 10 px travel) or a narrow-screen bottom sheet. It displays identity, workspace, Settings, persisted language and available account actions. Keyboard focus is contained; Escape, outside click, close and navigation dismiss the card. Reduced motion removes travel. Desktop height is bounded below its anchor; mobile height/scroll respects the viewport and safe area.

Settings reuses AuthProvider, canonical profiles and the existing language provider. Name and avatar can be edited; provider-managed email is read-only. Only the implemented Light appearance is exposed. Timer/music preferences link to their existing Focus owner. Kora artwork replaces the default stock self avatar.

PNG/JPEG/WebP inputs are type/header/dimension/size checked, decoded before use and cropped proportionally with zoom/reposition controls. Save produces a bounded 512px JPEG. Cancel leaves the saved identity intact; default restore is explicit. Object URLs and stale decoding work are retired on replacement/unmount.

Connected save verifies the current account, uploads to a unique owner-prefixed private object and compares the profile version before updating. Dropped responses are reconciled before any cleanup. Duplicate saves are rejected before changing revision state. Old images are removed only after the new profile pointer is confirmed; failed removals are reported and queued. Logout retains only opaque object-name retry metadata, without image bytes, signed URLs or credentials; other account caches are cleared. Retry requires the same owner under Storage RLS.

Local identity is explicitly device-only and version checked, with a recoverable prior record. Current profile changes project into workspace/member, Board, Table, Task Detail, Home and Today displays using stable user/member IDs. Legacy self-name matching remains available without rewriting historical assignments or other profiles. New assignments retain stable IDs.

Card motion remains presentation-only: finite drag lift, neighboring movement, drop settling and confirmed completion reflow. Domain transitions own completion/list rules. P3 accepted-event identity, Heartbeat, Pattern Exclusive and visual lifecycle fixes were not reimplemented. Frozen detectors and compensation were not modified by this integration.

## Evidence and limits

- Real dedicated-browser cases cover landscape, portrait and square crop proportions, processed 512×512 output, name/image save and reload, cancel, invalid file, default restore, language persistence, 320px layout, keyboard dismissal and reduced motion.
- Profile service regressions cover overlapping saves, stale remote/local versions, upload failure, CAS conflict cleanup, dropped committed responses, owned-path retirement, queued retry after logout and local quota failure.
- Actual storage-policy SQL passed six isolated PostgreSQL groups: owner reads, current shared-workspace identity reads, cross-owner upload/delete denial, unrelated-account denial, owner upload/retirement and anonymous denial. This fixture does not qualify hosted Supabase policies.
- Fresh combined unit/browser/build results are in [integrated results](kora-integrated-build-results.md); no old P3/P4 receipt is treated as acceptance of a newly modified build.
- The private storage migration remains source-only. Authenticated upload, cross-user/workspace refresh, storage outage/reconnect and deployed WebView behavior require non-production connected qualification.
- Twenty Windows native unit tests passed. Building the new executable was blocked by Windows Application Control (os error 4551) on Tauri's build helper. No installed Kora app was replaced and no installer/update was published.

The existing P4 engineering limitations (physical display/A-V verification, weaker-device/resource budgets, actual native-window lifecycle and broader connected capture/playback coverage) remain open. No production-release approval is implied.
