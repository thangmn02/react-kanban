---
status: complete
---

# Dock fitting, native glass and Companion delivery

The published Kora 0.1.13 website, update feed and signed installer were verified
live. The user confirms Contact shows v0.1.13; the remaining glass issue affects
the current native app. Their installed Companion screenshot shows 0.3.9 while
the current download contains 0.3.12.

Outcome: Music fits entirely below the tab pills without scrolling or clipped
controls, including long titles and multiple sessions. Restore actual desktop
frost in the native dock. Include the Companion and usable installation guidance
with Kora, with a discoverable entry inside the app.

Automatic metadata selection and source handoff already exist. New-tab capture
fails at Chrome's tabCapture permission boundary: an extension invocation is
required. The user accepted Windows browser-process audio capture after a
detailed explanation that the picker cannot remove overlapping music/calls in
the same browser. Separate desktop apps remain excluded. Keep the Companion
for metadata, controls, source selection and browser/web compatibility.
Do not silently replace the existing browser-only privacy boundary or invent
beats when capture is denied. Preserve the accepted AI instrument-note behavior.

Non-goals: unrelated application redesign, account/data changes, false updater
states, arbitrary folder flattening, or publication without release approval.

1. Diagnose Music overflow and verify a responsive fixed panel at 520×680 and
   360×540, including playback, track selection and setup/error actions.
2. Inspect native DWM attributes and implementation before changing glass.
3. Bundle Companion files and expose installation guidance from native Music.
4. Implement automatic browser-process capture. Verify process-only isolation
   empirically and preserve the existing detectors. Native capture leaves browser
   output and volume unchanged. Resolve the newly measured AI timing limitation
   with the user before releasing instrument behavior. Native audio must
   remain local; no microphone/system-wide capture or fabricated fallback.
5. Complete the repository audit: remove only proven generated duplication,
   retaining deployment adapters and runtime assets. Verify affected builds.
6. Run focused and shared checks, review, package and publish the concrete next
   release. The user explicitly authorized publication when this work is done.

Acceptance: Music panel client/scroll dimensions agree; no hidden actionable
controls. Native glass is verified beyond a browser CSS fixture. Downloaded Kora
includes the matching Companion, whose setup is reachable inside the app.
Playback pause/source change discards stale beats; browser restart/new-tab
capture behavior matches the chosen permission model. No fake beat fallback.

Release CI: 0.1.13 quality and database jobs passed. Playwright job timed out
after 15 minutes without failed-step logs; inspect runner annotations/steps.
Windows packaging passed. Playwright was cancelled before any runner steps
started; the queued job produced no failed-step logs. Both watchers have exited.

## Current continuation — 2026-10-06

Completed independent work:

- Music normal and permission/error states measured in actual component fixtures
  at 360×540 and 520×680. Panel client/scroll heights agree (171/171 and 213/213),
  and every play/picker/setup/error control remains inside the panel.
- Native frost now uses a translucent accent instead of the inactive opaque DWM
  material. Native shape commands own its clearing/enabling, preserving it across
  webview remounts. Window move exit reapplies it. Native preview verified actual
  desktop blur; programmatic move verification does not substitute for a manual
  mouse-drag acceptance test.
- Matching unpacked Companion resources and offline guide are generated for the
  installer; settings and disconnected Music expose their folder. Canonical
  koraspace.online relay permissions are covered by tests.
- Windows captures only the process tree owning the accepted Companion socket.
  The kernel, bounded binary Channel, existing detector graph and fresh-clock
  lifecycle are implemented. No production mute/replay or PCM network transfer.
- Full task-owned Windows PCM → Channel → analyser test: 798 valid packets,
  zero invalid/rejected packets, 15 kick/bass attacks in eight seconds. Separate
  process audio was empirically excluded. Native WebAudio startup needs no click;
  its rendering clock is checked before requesting PCM.
- Repository cleanup removes tracked generated Companion ZIP duplication while
  keeping both public URLs generated and the real Netlify adapter intact.
- Shared quality gates passed (561 tests in 78 files, 23 existing lint warnings,
  typecheck/build/bundle budget). Subsequent material-ownership change passed
  eight focused NativeSurface tests; final broad checks remain before release.
  Eleven Rust tests also passed after the final graceful material-fallback change.

Latest user explicitly requested publication for self-testing. Proceeding with the stated assumption of automatic capture for all five rows, with delayed native AI flashes. The original timing options were:

1. Automatic native capture for all five rows, accepting AI instrument flashes
   after audible notes; or
2. Automatic percussion, switching to existing extension capture when precise
   buffered AI timing is wanted (browser invocation required).

Evidence: muting a task-owned Windows audio session also zeroed its captured PCM;
restoring it restored capture. Therefore the former browser tabCapture approach
of suppressing original audio and replaying it 3.5 seconds later cannot be retained
with this API. Do not ship late AI while claiming the previous 32 ms alignment.
Native fifth-row production wiring now uses the real worker with delayed visual spacing under this
decision. Existing browser AI separation and buffered timing remain unchanged.

Remaining: implement chosen AI route; update owning music/setup/privacy docs;
bump Kora/Companion versions; regenerate resources; review and run final checks;
build/sign/verify installer, publish and verify live feeds. Publication is already
authorized. Do not request approval again. The private native preview's missing
Common Controls manifest was fixed; its source/binary are test helpers, not Kora.

Continuation cleanup: Vite session 4748 / PID 18960 was stopped; port 1420 is
free. All task-owned native previews and tone children have exited. Temporary
browser tabs were closed and viewport overrides reset. Private Rust example
source was removed. Evidence remains in ignored scratch/native-glass-verified.png,
scratch/native-pcm-proof.png and scratch/dock-quality.log. Final material ownership
changes passed focused tests, typecheck/lint and Rust tests. No version bump,
commit, installer publication or feed change has occurred for this work.

Read [pre-release checkpoint](../reports/review-261006-dock-companion.md) before
continuing the chosen instrument route and final release review.

## Published delivery

Kora 0.1.14 and Companion 0.3.13 published at commit 0a8bd80041133be73c88339e6323b95ea35c7fcd. Both koraspace.online and kanthangboard.netlify.app serve the exact signed installer and no-store feed. All 32 Companion runtime files and both ZIP aliases are verified; generated worker differences are limited to inspected equivalent optimizations from local Vite 8.2.2 versus hosted locked 8.1.4. Contact shows 0.1.14. Verification is saved in scratch/dock-live-release-proof.json. Task-owned previews and browser tabs are stopped. Full-song and installed-browser handoff remain user acceptance checks, not release blockers under the user's request to test it personally.
