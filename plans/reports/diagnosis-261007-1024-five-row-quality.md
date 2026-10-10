# Five-row quality: implementation and remaining gate

Baseline `819a627`. Status: in progress; no release or completed-phase commit.
The five-by-eight grid, one dominant Melody lead, media clock, bounded cache
and scheduler, reliability recovery and opt-in telemetry remain the contracts.

## Verified changes

- The browser Focus Dock remains available with an empty focus list. It starts
  collapsed to avoid covering page controls; starting a focus session expands
  it. Inline and pop-out controls retain the same timer owner.
- Fully retired legacy Spleeter setup, model downloads, inference workers,
  runtime/WASM, delayed-audio path and controls. Cached Melody attacks remain;
  legacy instrument messages cannot light that row. Old profile downloads are
  left inert. No replacement client model was added.
- Reduced the local controller's duplicate window from 120 to 20 ms. Cached
  events bypass wall-clock debounce because their engine already applies the
  40 ms semantic media-time merge tolerance. A regression delivers ten cached
  attacks 50 song-ms apart at 4x rate without suppressing them.
- Real onsets guarantee one immediate selected-cell flash, including within
  held shapes. Held-mask DOM identity and decorative provenance remain stable;
  other intentional random selections, decorative delays and tempo retriggers
  remain. Melody still requires actual notes, not hats or shape triggers.
- Added an offline saved-note selector/importer following the accepted Colab
  register, amplitude, duration, clustering and contour rules. Selected-stem
  input creates validated EventTrack chunks; clipping holds preserves a single
  line. This imports existing analysis, not inference or automatic stem choice.
  Full reference comparison remains pending.

## Corpus and rejected detector trials

The extracted Downloads benchmark contains 22 drum MIDI files, including
duplicates, and 19 paired full-mix WAV/MIDI excerpts. Its lead-test directory
contains separated audio, but no saved Basic Pitch or accepted lead-note array.
The notebook includes selector code and partial printed results, insufficient
to reconstruct complete Gymnopédie and H.S.K.T. inputs and accepted outputs.

The local benchmark decodes in isolated headless Edge, averages stereo,
analyzes at 44.1 kHz with a 2,048-point Blackman FFT at 60 Hz, and compares
baseline/current detections. MIDI conversion respects tempo messages and song
seconds ([Mido timing](https://mido.readthedocs.io/en/stable/files/midi.html)).
Saved ADTOF notes map 35→Kick, 38→Snare, 42/49→Hi-hat/Cymbal; 47 is excluded,
not mislabeled Bass ([model mapping](https://github.com/MZehren/ADTOF/blob/master/adtof/ressources/instrumentsMapping.py)).
Matching is one-to-one within 80 ms, after 400 ms detector warm-up.
These are model-agreement metrics, not human perceptual ground truth. Bass and
Melody have no reference in this export. Offline spectrum simulation is not
equivalent to a live browser capture listening test.

The smaller refractory-only trial produced:

| Row | Baseline detections / matches / reference | Trial detections / matches | Baseline precision / recall | Trial precision / recall |
| --- | --- | --- | --- | --- |
| Kick | 1,105 / 542 / 569 | 1,105 / 542 | .490 / .953 | .490 / .953 |
| Snare | 1,220 / 231 / 330 | 1,358 / 231 | .189 / .700 | .170 / .700 |
| Hi-hat/Cymbal | 1,140 / 638 / 1,074 | 1,478 / 614 | .560 / .594 | .415 / .572 |

A preceding trial loosening dense-input gates also traded more detections for
lower precision. Both trials were rejected and **all detector tuning reverted**.
The detector source matches the baseline; delivery/renderer fixes above remain.
The ignored `src-tauri/target/beat-quality-final-comparison.json` records the
rejected refractory trial, despite its filename. The reproducible harness is
[benchmark-beat-detector.mjs](../../scripts/benchmark-beat-detector.mjs); private
audio and exported arrays are not committed or uploaded.

Important unresolved cases:

- Gymnopédie produced 46 Kick claims in 30 seconds against zero reference drums;
  Kick/Bass separation on tonal attacks needs further quality validation.
- Take Five matched 12 of 112 reference cymbal events, with 13 detected hats.
- Levels has zero saved reference Kick/Snare notes despite baseline claims of
  53/55. The reference can omit audible instruments; tuning to it blindly is
  not justified.
- No Bass reference or completed five-row perceptual listening result exists.

## Verification

- Full existing suite: 87 files, 638 tests passed. Coverage: 74.8% statements,
  70.11% branches, 68.31% functions, 77.08% lines.
- Isolated Edge browser suite: 16 tests passed, including empty browser Dock,
  shared timer and pop-out flows. Native Rust suite: 14 tests passed.
- Typecheck/frontend build passed. Lint: zero errors, 23 existing warnings.
  Scoped simplifier review found no concrete behavior concerns; focused tests
  and syntax checks passed. Diff whitespace check passed.
- Regenerated ZIP has 26 runtime files, no retired workers/models/WASM; every
  entry matches both source and native generated resource bytes. The full
  signed installer has not been built or published for this work.
- Scheduling, stale/late handling, semantic-vs-tempo/decorative provenance and
  controller/DOM/animation telemetry retain regression coverage. This is not
  a new physical speaker/display alignment measurement.

The connected installed browser had no playing music tab available. A local
validation tab failed after its test server had already stopped; it is not a
live Companion proof. Fresh installed-Companion playback, platform switching
and full-song perceptual validation remain open. Task-owned test servers ended;
ports 5173/4173 had no listener at reconciliation.

## Subsequent evidence and remaining gate

The user supplied the complete note export after this initial report. Its
37/22 accepted attacks match; the originally missing arrays are resolved.
The user also authorized a narrow server baseline for uncached songs. See
[the server analysis report](diagnosis-261007-1421-server-beat-analysis.md)
for real inference, asynchronous cache publication and updated verification.

Hosted activation, fresh installed-Companion playback and perceptual five-row
checks remain open. Phase 4 is not feature complete. Keep its completion commit
pending and do not proceed to Phase 5 or publish it as complete.
