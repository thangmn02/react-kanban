# Private MELODIA comparison ready

Refresh [the existing listening page](http://127.0.0.1:5173/src-tauri/target/generalized-melody/listen.html). It opens H.S.K.T. with preserved v3 selected. Choose **Row 5 stream → MELODIA**, then play **Original**, or use **MELODIA + attack clicks**. Also compare segmented pitches, continuous F0, Original left / F0 right, and preserved v3. All auditions reuse one audio element and fixture position. Only five excerpts labeled **MELODIA available** enable the new controls.

## Implementation and measured outputs

Actual Essentia `EqloudLoader` → `PredominantPitchMelodia` → `PitchContourSegmentation` analyzes original mixtures at 44100 Hz, frame 2048, hop 128, `guessUnvoiced=false`, remaining API defaults. No separation or Basic Pitch ownership feeds MELODIA. See the [MELODIA API](https://essentia.upf.edu/reference/std_PredominantPitchMelodia.html), [segmentation API](https://essentia.upf.edu/reference/std_PitchContourSegmentation.html) and [tutorial](https://essentia.upf.edu/tutorial_pitch_melody.html).

Raw Hz/confidence frames are retained in JSON/CSV/NPZ, with time = frame index × 128/44100 (approximately 2.90 ms). Raw segmented onset/duration/MIDI accompanies normalized notes and explicit rests. Confidence is mean Essentia pitch confidence, not calibrated accuracy. No BPM quantization, extra vibrato-triggered events or rest interpolation is added. Invalid/padded notes or segments crossing zero-pitch/zero-confidence frames are explicitly omitted; these five needed no omission.

| Original-mixture excerpt | Note attacks | Inferred unvoiced seconds / 30 s | Notes below 100 ms | Analysis seconds |
| --- | ---: | ---: | ---: | ---: |
| H.S.K.T. | 111 | 11.50 | 34 | 1.20 |
| Gymnopédie | 19 | 20.99 | 0 | 0.71 |
| Nujabes | 89 | 17.11 | 24 | 1.16 |
| Levels | 62 | 16.92 | 16 | 1.09 |
| Những Lời Hứa Bỏ Quên (new holdout) | 120 | 6.88 | 36 | 1.18 |

The new supplied holdout is source **0:30–1:00**; its fixture clock starts at zero. Unchanged legacy extraction ran once on that excerpt solely for v3/rejected/raw-source comparisons. The original 25-excerpt report and checkpoint outputs remain intact; `melodia-report.json` is a separate private sidecar.

Counts and inferred rests are not human ground truth. H.S.K.T. has 18 attacks in 16–21 s, which does not establish correct sung notes or phrase timing. Defaults produce approximately 93 ms segments despite the nominal 100 ms segmentation parameter; those raw outputs remain visible. Fragmentation, accompaniment tracking, wrong octaves and omitted phrases still need listening. **Recognizable contour and musical quality are pending, not PASS.** Runtime excludes installation, I/O, sonification and legacy comparison preparation.

## Grid, provenance and verification

Existing `SemanticBeatPattern`, forty cells, 150 ms attack animation and `createBeatScheduler` are reused. Continuous F0 is display/audition data, not another flash producer. The single media clock schedules actual measured note onsets. Current MIDI, note durations, voiced/rest bands, counters, recording, trace export and human markers are available. Pause, seek and stream changes flush pending targets. Traces include original-mixture source, pitch, offset, WAV hash, analyzer version and actual DOM/animation media time. Old judgments remain stored; new ones use the selected version.

File SHA-256 and decoded PCM hash are distinct identities; both decoders produced identical H.S.K.T. samples. Equal-loudness loading preserves sample count. Analyzer source hash and installed parameters are recorded. Melody-only artifacts pass the unchanged EventTrack manifest/chunk parser. Their `private-local` wire-format namespace is not a real SoundCloud/provider identity; no artifact is imported into the operational cache.

- Six Python API/normalization checks passed: rests, repeated notes, short attacks, tail/zero-duration handling and a small-vibrato control. These are mechanical tests, not musical acceptance.
- Nine focused grid tests and **107 files / 771 full-suite tests** passed. Typecheck, scoped ESLint and Vite build passed. Existing import-extension, optional percussion asset and large-chunk build warnings remain.
- Isolated Edge verified all five fixtures, one audio player, forty cells, Row 5 only, exact targets/provenance, markers/export, pause, replay/backward seek, forward seek and three-stream audition switching. Sample animation offsets were approximately **+7–26 ms**, not a latency distribution or physical audio-output measurement.
- The existing 25-excerpt browser regression also passed with zero page errors, preserving v3/candidate first-event rendering, original comparison auditions and trace controls.
- All seven accepted detector/delivery/renderer hashes match; v3 source is byte-identical to its checkpoint. Percussion, Bass, production scheduler/renderer/merger, cache, database and Modal are untouched. No MELODIA/private-grid entry is present in the production bundle.

The connected-browser runtime could not load its module (`EPERM`); isolated Edge checks did not alter the user's session. Owned analysis/test browsers exited. Existing Vite PID 3132 on port 5173 remains available.

## Runtime, reproduction and license boundary

Ubuntu WSL Python **3.14.4**, Essentia **2.1b6.dev1438**, NumPy **2.5.3**, PyYAML **6.0.3**, six **1.17.0**, pip **26.2.1**. [Installation documentation](https://essentia.upf.edu/installing.html) covers Linux Python bindings; no frontend dependency was added.

From the repository PowerShell terminal:

```powershell
$melodiaRoot = '/mnt/c/Users/thang/OneDrive/Documents/react-kanban/react-kanban'
wsl -d Ubuntu --exec python3 -m venv --without-pip "$melodiaRoot/src-tauri/target/melodia-venv"
# This Ubuntu lacks ensurepip; bootstrap only inside the isolated venv.
wsl -d Ubuntu --exec curl -fsSL https://bootstrap.pypa.io/get-pip.py -o "$melodiaRoot/src-tauri/target/get-pip-melodia.py"
wsl -d Ubuntu --exec "$melodiaRoot/src-tauri/target/melodia-venv/bin/python" "$melodiaRoot/src-tauri/target/get-pip-melodia.py" 'pip==26.2.1'
wsl -d Ubuntu --exec "$melodiaRoot/src-tauri/target/melodia-venv/bin/python" -m pip install -r "$melodiaRoot/server/audio-analysis/melodia/requirements.txt"
& 'src-tauri/target/analysis-venv310/Scripts/python.exe' scripts/prepare-melodia-listening.py --holdout 'C:/Users/thang/Downloads/Những Lời Hứa Bỏ Quên.mp4'
wsl -d Ubuntu --exec "$melodiaRoot/src-tauri/target/melodia-venv/bin/python" "$melodiaRoot/server/audio-analysis/melodia/test-melodia.py"
node scripts/check-melodia-event-tracks.mjs
node scripts/check-melodia-listening.mjs
```

For a single input, the Linux analyzer takes `--audio`, `--output`, `--id` and optional `--expected-audio-sha` (WAV file hash). Output must stay in ignored `src-tauri/target`. Preparation reruns changed analyzer source and validates fixture hashes; it never analyzes the remaining corpus automatically. Evidence: `generalized-melody/melodia-contract-check.json`, `melodia-browser-check.json`, per-excerpt `melodia/browser-trace.json`, `melodia-preservation.json` and `src-tauri/target/melodia-vitest-results.json`.

[Essentia licensing](https://essentia.upf.edu/licensing_information.html) documents AGPLv3 and commercial licensing. Applicable notices/source and network-service obligations need review before distribution/hosting; personal/free development does not settle them. This authorized private experiment is not a public release or Modal deployment.

**STOP for user listening.** Prior Basic Pitch quality remains failed; MELODIA is pending. No corpus expansion, heuristic tuning, deployment or Phase 5 until the required listening decision.
