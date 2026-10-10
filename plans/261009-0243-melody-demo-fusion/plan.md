# Private Melody detector comparison in the existing Beat Grid

Status: delivered privately; musical acceptance pending human listening. [Validation report](../reports/validation-261009-0243-melody-demo-fusion.md).

Outcome: `/beat-grid?musicDebug=1` offers an opt-in saved-audio demo with four Row 5 modes: unchanged MELODIA baseline, experimental Basic Pitch only, one experimental fusion and synchronized baseline/fusion A/B. Reuse SemanticBeatPattern, the fixture media-clock adapter, scheduler, counters and row trace recorder. Keep the existing private listening pages available.

Inputs: Gymnopédie piano 0–10 s first, H.S.K.T. vocals 16–26 s, then Nujabes original mix 0–30 s. Also offer the existing original-mix MELODIA outputs for the first two. Validate hashes/alignment and use matching Basic Pitch inputs; reuse saved stem candidates and save one matching full-mix Basic Pitch run where absent. No new source separation or model changes.

One fixed fusion policy: collapse near-identical candidates; abstain on competing-pitch onset clusters without a confidence margin; enforce a monophonic Basic Pitch line; preserve baseline notes exactly; add only distinct, strong, stable Basic Pitch attacks inside baseline gaps, with compatible available F0 evidence and bounded spacing/durations. Export all selection/rejection reasons. Confidence values remain uncalibrated activations, not measured probabilities. No parameter sweep or acceptance by event count.

- [x] Prepare private input/model-output sidecars and preservation hashes.
- [x] Implement/test one pure experimental fusion and metadata propagation.
- [x] Add opt-in controls to the existing development-only MusicGrid; one audio clock and reused renderer in each A/B lane.
- [x] Verify mode switches, pause, seek, replay, trace/marker export, event metadata and unchanged Rows 1–4/production behavior.
- [x] Run relevant regression/type checks, browser-check the three recordings and write a short report.

No production Row 5 integration, Modal/database/deployment, broad tuning, new renderer or claim of perceptual success. Preserve accepted MELODIA files and seven Gymnopédie stem events independently. Reuse port 5173 PID 3132.
