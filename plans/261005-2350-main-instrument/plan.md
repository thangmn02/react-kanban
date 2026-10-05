---
status: complete
---

# Main instrumental note row

Outcome: the fifth row flashes on note attacks of one dominant instrumental
part (piano/guitar/trumpet/etc.), is quiet without instrumental notes, and
does not follow vocals, percussion, a metronome or broad tonal brightness.
The first four rows retain their own detectors and rhythmic roles.

User selected stronger source isolation, allowing processing delay and an AI
model download, rather than immediate best-effort mixed-audio tracking.
Processing remains local; no captured audio is uploaded or retained on disk.
Preserve capture permissions, selected-tab identity, pause/stop/seek behavior,
bounded queues, current timer/dock UI and reduced motion. Audio/visual timing
must use the same buffered timeline; displaying already-played notes late is
not acceptable synchronization. Model failures leave the fifth row dark.

Non-goals: sheet music, instrument naming UI, pitch display, cloud inference,
rewriting drum detectors, or a claim of perfect transcription of arbitrary mixes.

Acceptance: real model inference separates vocal/drum/bass from instrumental
audio; a dominant part remains stable instead of following every source;
repeated same-pitch attacks and short/fast notes produce events; sustained
notes do not repeatedly flash; percussion-only/vocal-only/silent passages
stay dark. Real note timing is measured against buffered audible playback.
Pause, seek, source switch, stalled model and stop cancel stale note events
and buffered audio. Test the actual model and runtime with labeled audio,
alongside focused/full app and transport checks. No fake AI/model fallback.

Diagnosis: existing detector uses 250–4000Hz flatness/centroid with a 120ms
gate and 180ms note interval; no instrument identification or separation.
The UI explicitly ORs raw hi-hats into Melody and can illuminate the fifth row
from decorative percussion shapes. Capture throttles note state to 100ms.

Trade-offs: FFT-only tracking is cheap and immediate but cannot reject vocals
or isolate a part. AI separation can reject competing stems but requires a
download, buffering and verified device throughput. Fixed 7.8s Demucs ONNX
exports incur substantial lookahead; the available package also restricts
its bundled weights to personal/research use. Investigate a distributable,
shorter-window source separator before choosing runtime/model assets.
Better approaches: none — source isolation follows the user's chosen direction.

1. Verify model/runtime/licensing and local throughput, then settle buffering.
2. Implement source isolation, dominant note tracking and synchronized events.
3. Remove cross-row triggers and sustain-only decoration from row five.
4. Verify actual audio/model, transport, UI, failures and full quality gates.
5. Document and package a concrete release for publication approval.

## Current evidence (2026-10-06)

Implemented local Spleeter ONNX (four verified stems, 128-frame windows), a
dominant harmonic-profile note tracker and synchronized 3.5-second audio/event
buffers. Four rows retain their own detectors; legacy tonal/hat/decorative
fifth-row triggers are removed. Model setup, integrity, throughput, discontinuity
and deadline failures keep the fifth row dark. Options expose opt-in download
and disable; the dock opens those options through web and native bridges.

Actual browser WASM tests on three labeled MUSDB sample excerpts produce
instrument/mix note events and zero vocal-only, drum-only or bass-only attacks.
Actual AudioWorklet/DelayNode playback produces four note events for four
repeated/changing piano attacks. The final run under the extension's script
policy measured a worst local audio/event offset of 31.93 ms. The actual
Netlify-built worker passed the same check with a worst offset of 60.96 ms;
both runs produced exactly four attacks and no runtime errors.
Publication verification exposed a leading-tail/subharmonic double flash.
Companion 0.3.12 confirms pitch and refines the growing attack without a
second sequence. Four piano attacks produce four events at all eight tested
AudioWorklet alignments, including both previously failing cases.
This measures the browser graph, not end-to-end speakers/native rendering.
Multiple instruments remain in Spleeter's other stem, so perfect instrument
isolation and every-note accuracy remain outside the claim.

The complete pnpm run quality gate passed; the final full suite passed 543
tests across 75 files. Coverage,
TypeScript, lint, production build and bundle budget. Lint has zero errors and
23 existing warnings. Coverage is 71.96% statements, 66.55% branches, 66.19%
functions and 74.22% lines. The main entry is 617.6 KiB within its 976.6 KiB
budget. Signed Kora 0.1.12 and companion 0.3.12 are packaged;
the updater signature verifies and altered installer bytes are rejected.
The final installer SHA-256 is
3357301f3f68930413d0c9a00e865716928c291cdf56df54b4e43d428209e26d.
The final web build includes the signed installer and matching update feed.
Both extension ZIP aliases match; the 32-entry package contains bundled
runtime, worklet and licenses, without model weights or private configuration.
The production artifact scan found no private configuration matches.
Implementation, review and local release verification are complete. Real
instrumental/mixed counts on the three excerpts are 23/23, 19/14 and 21/23;
all vocal-only, drum-only and bass-only checks still produce zero attacks.
The user approved publishing Kora 0.1.12 and Companion 0.3.11 to main.
The first release was verified on both production domains; its Windows CI
needed an asynchronous Contact-test cleanup wait. That test correction passed
CI and the Windows build. Companion 0.3.12 corrects the double flash found
during live verification; the signed app installer was refreshed to include
the corrected companion package. The app's native behavior/version is unchanged.
First-time options-page downloading
and live installed-browser/full-song listening remain unverified; the model
runtime and buffered playback were exercised in the browser verification tools.
User requested finishing this work before Tabs/confirmation changes; those
are queued separately and are not included. Correction commit a605a6b is live
on koraspace.online and kanthangboard.netlify.app. Both domains serve the
matching feed and signed installer, Companion 0.3.12 and the AI setup UI.
The actual deployed worker passes all eight onset alignments and playback.
Final CI passed quality, database isolation and end-to-end checks;
the Windows workflow passed native tests and the signed installer build.
Release implementation and publication are complete. No installation was
performed on the user's device.
All local audio-test browsers/servers closed.

The automatic approval reviewer failed a bundle-budget command because of an
account usage limit (reported reset 02:51). The rejected command was not run.
After the user requested continuing, a fresh packaging/signature-check approval
succeeded. A subsequent approved quality run passed all gates, including the
previously blocked bundle-budget check. There is no remaining approval-review
blocker; release publication has been authorized.
