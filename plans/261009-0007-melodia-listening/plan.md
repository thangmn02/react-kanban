# Private MELODIA implementation

Status: private comparison ready; stopped for human listening. [Technical report](../reports/validation-261009-0007-melodia-listening.md).

Replace the private Melody extraction approach with actual Essentia `EqloudLoader` → `PredominantPitchMelodia` → `PitchContourSegmentation`. Begin with original mixed audio, 44100 Hz, frame size 2048, hop size 128, `guessUnvoiced=false`, other documented defaults. No Basic Pitch ownership, forced vocal priority, BPM quantization, threshold sweep or second model. Keep framewise Hz/confidence and explicit unvoiced intervals; publish only semantic Melody onsets from measured segmented notes.

- [x] Establish a reproducible isolated WSL Python environment and record package/license requirements.
- [x] Implement a bounded private analyzer with audio provenance, raw contour/segmentation, confidence aggregation and compatible EventTrack artifacts. Never infer notes in genuinely unvoiced frames.
- [x] Analyze H.S.K.T., Gymnopédie, Nujabes, Levels and one previously unused MELODIA holdout with identical defaults.
- [x] Add a MELODIA stream, contour/rest/note views and auditions to the existing generalized comparison, existing grid/scheduler and single fixture clock. Preserve v3 and rejected v1.
- [x] Verify raw timestamps/rest boundaries, note normalization, contract compatibility, seek/pause/replay/A/B and actual DOM/animation trace provenance; run tests and preserve accepted source hashes.
- [x] Write commands, runtime and known limits in a short report; stop for listening. Prepare the remaining corpus only if the first five receive a clear improvement judgment, not from counts or tests.

All real music inputs are the supplied saved local excerpts; no download/upload, database change, EventTrack cache mutation or Modal deployment. Outputs and WSL runtime stay in ignored `src-tauri/target`. Rows 1–3, Bass, production renderer/scheduler/merger, percussion caches and previous Melody algorithms remain untouched. Preserve the unexecuted pYIN prototype as a superseded private experiment, not a substitute named MELODIA.

Essentia Python bindings are unsupported natively on Windows; installed Ubuntu WSL has Python 3.14.4. Its `ensurepip` is missing, so use `venv --without-pip` and the official PyPA pip bootstrap inside that venv, not system package mutation. Pin the actual Essentia wheel and dependency versions after installation. Public/commercial distribution and network-service obligations remain a separate gate; the user explicitly authorizes private local implementation now.
