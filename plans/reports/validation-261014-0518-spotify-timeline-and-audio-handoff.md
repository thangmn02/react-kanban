# Spotify timeline and audio handoff validation

Date: 2026-10-14, Asia/Saigon. Baseline: fcc6a4c.
Versions: Kora 0.1.31 / Companion 0.3.24. Draft verification in progress.

## Observed defects and repairs

The user confirms audible stutter and a frozen grid in Chrome, Brave and Edge.
Their screenshot shows Spotify 0:17 / 2:45 while Kora shows 0:04 / 0:07.
The submitted underrun/main-thread/GC explanation remains a hypothesis.

Regressions reproduce three source defects: a muted looping Canvas is reported
as a song; SDK playback outside HTML media has no correct clock; and merging an
older discovery into a newer observation can carry 360 seconds from a previous
asset into a 165-second track. The Canvas/SDK/asset regressions failed before fixes.

Spotify's visible song transport now owns SDK song identity, duration and clock.
Muted Canvas videos are excluded even when JavaScript performs their looping.
Unique real audio that matches duration, playback state and position can expose
seek/volume; otherwise SDK playback/navigation controls remain available and
unsupported controls stay disabled. The counter has one-second precision:
interpolation stays within its current second and marks a two-second stall.
Both discovery and watchers share a 750 ms grace for missing transport nodes.
A confirmed asset change rejects the previous cache/watch immediately. A changed
link waits for a changed transport tuple and 200 ms without another counter
mutation; bounded resampling lasts at most two seconds. Tests exercise separately
updated link, position and duration. This is a bounded observation of page UI,
not an atomic Spotify SDK API; longer incoherent site updates remain a live-test
limitation. No previous unchanged clock is assigned to a new asset.

Newer clocks retain mute/buffering/seek/generation state over stale discovery.
Changing asset never inherits the old clock. Delayed clock stops are token-bound;
changing source on the same player restarts its watch. Muted playback cannot win
automatic source selection.

Desktop's stale `learnedSessions` route sent equipped Companions through browser
tab capture. Since the learned runtime is already packaged, Desktop now always
uses its existing Windows process PCM and keeps Companion as clock/control
transport. The original browser output is untouched by this analysis graph.
Late native start responses cannot reactivate a retired source. The native
process tree can include other audio in that browser; this is not tab isolation.
Web/PiP retain [Chrome's tab-capture invocation requirement](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).

FFT stages reuse their original double-precision sine/cosine values rather than
recomputing them for each butterfly. Trained frontend, feature timestamps, model,
thresholds, four rows and Bass behavior are unchanged. No DSP drum fallback,
new model, audio delay or browser permission bypass was added.

## Verification

- Full shared suite: 839 tests in 111 suites passed. Final affected discovery,
  clock, background and merge checks passed; additional final media/merge tests
  passed after the settling change. Twenty Rust tests passed, including process
  ownership, source isolation and Companion file replacement/junction checks.
- TypeScript passed. ESLint: zero errors, 25 existing warnings. Signed native
  build, connected web build and bundle budget passed.
- Paired Node FFT benchmark: p95 per 128-frame input block 0.262 → 0.083 ms;
  p99 0.395 → 0.142 ms. Collected features/timestamps were bit-identical. The
  128-frame deadline at 44.1 kHz is 2.902 ms. This machine did not prove an
  underrun from FFT, GC or main-thread work; measurements do not establish a
  universal speedup on slower devices.
- Real mixed stereo PCM through the native analysis engine, production-emitted
  worker/worklet/ONNX/WASM under Desktop CSP: three 10-second owners per browser.
  Chrome 155.0.8059.41, Edge 155.0.4283.45, Brave 155.0.8059.40 all produced
  learned drum events. All nine owners confirmed audible input, with no rejected
  PCM packets, pending worker backlog, runtime failures or page errors.
  First learned attacks arrived about 0.61–1.25 s after start; measured frame
  rate was 114–120 fps, worst frame gap about 75 ms. Long tasks of 58–81 ms
  still occurred around startup; this is not a claim of zero startup work.
- Two independent read-only reviews found and verified additional lifecycle,
  discovery-grace and transport-transition defects before final packaging.

The visible-browser helper failed with EPERM before browser selection. Initial
sandboxed tests also encountered Vite worker/worklet realpath denials; the same
checks passed outside that sandbox without weakened assertions. Isolated browser
network access required the approved unsandboxed test command. No user profile,
installed Kora/Companion payload or music tab was modified during development.

These real runtime checks exercise the native analysis engine, not a signed-app
Windows-capture → logged-in Spotify listening session. They do not establish
physical audio continuity, independent drum accuracy or the disappearance of the
user's audible stutter. Installed listening acceptance remains pending.

## Release and installed test

Signed installer: 15,516,337 bytes, SHA-256
`95f530db09d826cb8bb3c4765d895baca4f2019059c6d7aae122d0dcf12db33c`.
Companion ZIP: 16,316,129 bytes, SHA-256
`2095ae9976d9145e4e0cf4038d2e118baf4123efcba945f095739ca4fec21506`.
Updater artifact and trusted-comment Ed25519 signatures verify against the
configured public key. All 44 ZIP entries and 45 native-inventory files match
the final source, including the settling fix; native NSIS explicitly bundles
that generated helper. The model SHA-256 remains
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
Main web entry is 705.5 KiB, within the 976.6 KiB budget.

Draft: `6aceb59df3f3b961207dc24c`; final public verification pending.
Update Kora, use Install or update Companion, confirm loaded Companion 0.3.24 in
each browser/profile, then pause/close YouTube and play Spotify without a toolbar
click. Compare Kora's song duration/time, pause/seek/next behavior, flashes and
audible sound through the first seconds and a full song. Repeat in Chrome,
Brave and Edge. Web capture may still require its normal toolbar permission.

Rollback uses the previous signed 0.1.30 release and retained Companion update
backup. All owned browser/test-server processes must be closed before delivery.
