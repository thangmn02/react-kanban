# Four-row baseline verification

The renderer repair is accepted. Do not tune Melody, DSP/model thresholds,
scheduling or merging. Verify actual Kick, Snare/Clap, Hat/Cymbal and Bass
events with Melody and all decoration disabled. Preserve a neutral fifth row.

- [x] Commit only the renderer/fallback repair separately: `f7a2445`.
- [x] Add a temporary four-row semantic-only mode and regression protection.
- [x] Export representative real-audio row timestamps and render provenance.
- [x] Provide a usable listening comparison and recover real capture for the user.
- [ ] Obtain perceptual acceptance before marking Rows 1–4 frozen.
- [x] Report commit, traces, listening status and freeze status; stop.

Counts and timestamps prove routing, not perceptual quality. The supplied live
screenshot is degraded with zero typed events and cannot pass the listening gate.
Keep existing preview PID 3132/session 95540 on 5173 for the user's check.

Capture now works after removing unsupported storage calls from the extension's
offscreen document. The user confirmed increasing counters after reload, then
rejected the four-row listening behavior: off-beat flashes and Kick activity in
drum-free sections. The new live trace contains typed local events with correct
row mapping; it does not pass perceptual acceptance. Rows 1–4 are **not frozen**.
No detector thresholds were changed. Melody work and Phase 5 remain stopped.
See [verification report](../reports/verification-261008-1041-four-row-baseline.md).
