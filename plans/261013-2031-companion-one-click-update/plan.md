# One-click Desktop Companion update

Status: implemented, reviewed, published and verified; user's installed-browser test pending.
User authorized implementation after the stale-folder diagnosis.

## Outcome and boundaries

Install or update Companion must prepare the version included in the signed Kora
release in the stable app-data folder, preserving the existing unpacked extension
path. Verify the complete payload before replacement, retain the previous folder
for rollback, and report installation/reload instructions instead of false success.
Ask connected Companions to reload only after their own on-disk manifest matches
the expected version, then confirm the newly loaded version through the bridge.
Old Companions require one manual reload to gain this capability.

Use the signed Desktop bundle as the update source. No arbitrary ZIP download,
store submission, browser profile editing, browser consent bypass, new percussion
model, or change to music detection. Independent Web ZIP installs remain manual.
An installed version newer than this Kora payload must not be downgraded.

## Execution

1. Add an explicit generated package inventory and stage/verify/replace files at
   the existing app-data installation path with rollback on replacement failure.
2. Add bounded native-only status/reload bridge actions, acknowledge before reload,
   reject a different on-disk version, and confirm reconnection/version.
3. Show progress, errors and actionable install/manual-reload/success states in
   both native entry points. Correct the stale offline guide.
4. Run file-operation, bridge and UI regressions; type/lint/native/build checks;
   review the cross-module contract, then publish a matching release for testing.

## Acceptance and rollback

Cover the observed 0.3.16 override, first install, same-version repeat, newer
private version, malformed/missing payload, symlinks, concurrent clicks, failed
replacement, disconnected/old browser, wrong on-disk version, delayed response
and successful reload/reconnection. Preserve browser ID by keeping the loaded
folder path. Never claim automatic reload from an acknowledgement alone.

Reviewable rollback uses the retained previous folder or reverts only these
changes. Do not modify the user's installed files while developing/testing.
Evidence goes in `plans/reports/`; owned test processes must exit before delivery.
See [delivery validation](../reports/validation-261013-2031-companion-one-click-update.md).
