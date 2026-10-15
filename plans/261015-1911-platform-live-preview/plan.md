# Private captured-tab live preview

Status: complete private implementation and validation; user retry pending. Extends the user's accepted private experiment to YouTube and other supported captured media tabs. Production remains NO-GO. See the [evidence report](../reports/engineering-261015-1911-platform-live-preview.md).

## Outcome and boundaries

Allow explicitly consented, visibly unverified instrument predictions from an active browser tab capture without intentional audio delay. Video remains ineligible for the calibrated audio buffer. Preserve source timestamps, the existing stale-event budget, detector thresholds, provider restrictions, and all accuracy/physical acceptance gates. No deployment or new platform integration.

## Implementation

- Extend the private mode/configuration contracts with an explicit live preview variant, separate eligibility/reason, and consent to late or incorrect predictions. Existing configurations retain their meaning.
- Reuse the current capture owner, epoch, detector and event engine. Live configuration uses zero delay and does not replace an already undelayed output graph. Revoke on pause, seek, source/generation, ownership, or eligibility changes; reject stale asynchronous results.
- Add an independent live preview control to the private experimental UI, available while playing without calibration. Preserve the existing buffered audio workflow.
- Package the updated private Companion and rebuild the currently served grid. Update the owning private guide and evidence report.

## Acceptance and verification

- Active eligible video capture can emit genuine model predictions only after explicit authorization/output/timing consent. Status reads experimental-live, buffer 0, unverified and potentially late.
- Video cannot enable the audio buffer. Spotify, protected sources, unknown identity, missing ownership/clock/capture, and non-private builds cannot enable live preview.
- Stop/pause/seek/source changes revoke preview; prior capture/epoch inference cannot publish into a new session. Existing late-event rejection remains intact.
- Focused mode, capture, synchronization, UI and event-engine tests; typecheck/lint/build/package checks; actual isolated Edge capture through UI for generated audio and video plus a real YouTube capture where available. Do not interpret rendering results as accuracy or physical synchronization.
- Read-only review before delivery. Retain the existing user server; clean up owned test browsers/profiles.

Rollback: remove the new private live configuration/UI and reload the private extension; existing buffered mode and production defaults remain available. No production release is authorized.
