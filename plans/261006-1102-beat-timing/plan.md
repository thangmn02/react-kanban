---
status: in-progress
---

# Restore automatic capture timing

Outcome: keep automatic browser-source switching while repairing percussion
timing and making the fifth row's instrument setup discoverable. Preserve the
accepted browser-process privacy boundary and isolated AI note detector.

Evidence: user recording is 8.19 seconds, includes audio, shows four percussion
rows flashing and a dark fifth row. User confirms native AI instrument notes is
initially off, then ready/delayed after enabling. The real model reproduces zero
notes: all 256 measured frames are vetoed by the whole-phrase bass dominance rule,
although isolated instrumental bins reach amplitude 21.48 and assignment .84.
Native PCM currently passes through scheduled WebAudio buffers before FFT;
onset styles additionally delay flashes. Previous verification counted attacks
without measuring native attack-to-event latency.

Measured native delivery fixture: scheduled analyser latency 78–95 ms; direct
sample analysis 25–36 ms with AI model work running concurrently. Focused tests
confirm ten attacks, fixed sample cadence across variable packet sizes, correct
WebAudio Blackman/scaling/downmix, expiry and cancellation. Native live rows now
use measured attacks rather than predicted synthetic drum ticks.

1. Measure native PCM attack latency and recording flash/audio relationship.
2. Remove proven avoidable buffering while preserving existing band detector and
   tempo contracts; measure again with identical signals and jittered packets.
3. Expose honest AI off/loading/ready/failure status and setup from Beat grid.
4. Focused latency, lifecycle and UI tests; shared checks, review and release.

Acceptance: percussion reacts to fresh captured attacks without growing queue or
clock-driven substitutes. Four original percussion bands remain independent.
Pause/handoff cancels pending notes. Fifth row uses only isolated instrumental
attacks, with visible opt-in/model state and the previously accepted AI delay.
No fabricated notes, tab-muting, remote PCM, or change to automatic handoff.
