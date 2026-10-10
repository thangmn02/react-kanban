# Upstream Melody extraction audit

Status: paused by the subsequent UI-only request. Private experiment only; production quality gate failed. Decoder source inspection is complete; the F0 segmentation prototype was written but has not been executed or adopted. Continue only the [visual diagnostics task](../261008-2345-melody-visual-diagnostics/plan.md) for the current listening handoff.

H.S.K.T. raw Basic Pitch pitches and both tracker click comparisons failed human listening: recognizable notes, timing and phrase rests are inaccurate. Presence of proposals does not establish availability of the correct main melody. Preserve v3 and the rejected generalized candidate; stop melodic-role scoring changes.

- [ ] Audit exact saved separated vocals against original audio and Basic Pitch input provenance; make source audition available for human separation judgment.
- [ ] Export Basic Pitch frame/onset/contour evidence and decoder-origin/boundary diagnostics, independently from tracker filtering and ownership.
- [ ] Run exactly one private alternative: installed librosa pYIN continuous F0, explicit unvoiced rests, stable pitch transitions and envelope-supported rearticulation. No training, model search or parameter sweep.
- [ ] Use the same fixed configuration on H.S.K.T. vocals and a small Gymnopédie piano control. Monophonic F0 is not presumed valid for polyphonic piano.
- [ ] Produce original/stem/raw Basic Pitch/continuous F0/segmented-note auditions with pitch and rest timelines.
- [ ] Run segmentation and artifact/browser checks; verify preserved source hashes; report extraction versus later selection errors separately.
- [ ] Obtain human listening on phrase preservation, recognizable pitches, attacks and gaps. If it fails, retain the candidate and stop; no second experiment, production integration or Phase 5.

All inputs are previously supplied local bounded 30-second excerpts. All audio/model arrays and outputs stay in ignored `src-tauri/target/melody-extraction`. No provider fetch, separation rerun, cache mutation, EventTrack export or deployment. Rows 1–3, Bass, scheduler, merger, existing trackers and production analyzer are out of scope.

Fixed experimental configuration before evaluation: 22050 Hz mono, centered 2048-sample pYIN frames, 220-sample hop, C2–C7, default pYIN probabilistic decoding; voiced flag plus minimum probability 0.1 and absolute RMS floor 0.0001; 5-frame median pitch smoothing within voiced runs only; stable 0.7-semitone changes lasting 60 ms; same-pitch rearticulation requires an envelope valley below half its local reference followed by recovery, 120 ms spacing; notes shorter than 80 ms discarded. No gap filling, vocal preference or song-specific settings. These settings define one candidate, not validated global production rules.
