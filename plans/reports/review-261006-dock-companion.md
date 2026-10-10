# Dock and automatic capture pre-release checkpoint

Status: published and verified at 0a8bd80041133be73c88339e6323b95ea35c7fcd.
The user requested publication for self-testing. The stated assumption is all
five rows automatic, accepting delayed native AI flashes. Publication is authorized.

Implemented paths were checked against the base and web-app review checklists.
The Windows capture kernel uses the accepted Companion socket's browser process
tree; frontend commands cannot choose arbitrary process IDs. PCM uses only a
bounded local binary Channel. No production session muting, replay, microphone,
endpoint-wide capture, filesystem audio recording or network PCM was added.

Resolved implementation hazards:

- Outer PROPVARIANT is ManuallyDrop, preserving the callback-owned activation
  parameters without freeing its stack/Arc memory. The real Windows probe passed.
- Replacements stop the old capture atomically; cleanup and callbacks are scoped
  to their capture ID. Fresh Companion clocks, process lifetime, bounded packets,
  acknowledgements and leases stop disconnected/backlogged capture.
- A running WebAudio context must advance its rendering clock before native PCM
  starts. The queue rejects oversize bursts rather than silently accumulating
  stale audio. Real Windows PCM produced 15 kick/bass attacks with no rejected
  or invalid packets in the eight-second private test.
- Native shape owns clearing/enabling frost. Frontend remounts no longer clear
  cached acrylic. Unsupported materials retain rounded CSS/region fallback.
- Music access/error actions fit at both supported minimum and standard sizes,
  with measured equal client/scroll dimensions and every control inside.
- Integration tests use separate music and audio-ended listeners and exercise
  native detector routing; Companion fallback cannot overwrite native capture.

Verification: shared quality run passed 561 tests / 78 files, zero lint errors
(23 existing warnings), typecheck, build and bundle budget. Subsequent frost
ownership change passed eight focused NativeSurface tests plus typecheck/lint.
Eleven Rust tests passed after its fallback change. No final signed installer
or production browser handoff acceptance has been performed for this update.

Final continuation evidence:

- Native PCM now feeds the real four-stem worker, with opt-in model download,
  progress/status, persistent preference, failure isolation and delayed note spacing.
  Pause/source changes cancel worker callbacks and queued flashes. Web AI retains
  its original buffered route. No browser volume/output changes were introduced.
- Actual native-engine/model check produced four attacks for four piano notes;
  flash intervals were 371, 416 and 416 ms for notes spaced 400 ms apart. AI
  processing delay is explicitly disclosed; this is not the previous 32 ms result.
- Final quality passed 564 tests / 79 files, typecheck, zero lint errors with
  23 existing warnings, production build and bundle budget. Eleven Rust tests passed.
- Signed Kora 0.1.14 includes the 32-file Companion 0.3.13 and offline guide,
  verified against NSIS resource directives. Local installer signature verifies;
  byte tampering is rejected. No configured private values leaked to web assets.
- Generated worker builds now disable Vite public-directory copying, preventing
  accidental local copies of the website/installer inside the worker output.

Remaining publication follow-through:

- Commit/push the verified release, then verify the live installer, feed and
  matching Companion downloads. Full-song listening, manual dragging and actual
  browser-platform handoff remain installed-user acceptance checks.
- Ignore private plans, scratch data, local credentials and unrelated generated
  icons when staging. The private native example has already been removed.

Live release verification passed on both production domains: exact signed installer/feed, Companion 0.3.13 inventory and both ZIP aliases, equivalent generated worker and Contact version 0.1.14. No task-owned background processes remain.
