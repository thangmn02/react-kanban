# Gymnopédie missing attacks: upstream F0 gaps are confirmed

The seven accepted piano-stem events are preserved. The strongest identified omissions occur **before note segmentation**: the saved stem retains waveform attacks, but MELODIA returns zero pitch and confidence in those regions. Every voiced island becomes a raw segment, and all seven segments survive normalization and EventTrack output. There is no observed downstream deletion.

Your corrected listening feedback is recorded as qualitative evidence: the manual stem's flashes are mostly correctly timed but incomplete, approximately twelve attacks are audible, and the original-mix flashes are incorrect. Twelve is not a forced output count or timestamped reference set. No mix events were adopted.

## Waveform, F0 and segmentation evidence

| Stem waveform novelty peak | Stem/original RMS amplitude ratio | Voiced frames in following 150 ms | Saved stem segment |
| --- | ---: | ---: | --- |
| 0.360 s | 0.872 | 0 / 51 | None |
| 1.138 s | 0.753 | 0 / 52 | None |
| 5.074 s | 0.946 | 0 / 52 | None |
| 7.634 s | 0.898 | 0 / 51 | None |

Pitch and confidence are both exactly zero throughout these post-peak windows. These waveform observations support missing F0 as a concrete mechanism; their precise identity as the listener's missing primary notes still needs timestamp confirmation. Waveform novelty is not proof of a pitched lead attack.

The preserved seven onsets are **1.875, 2.638, 3.431, 4.246, 5.907, 6.748 and 9.239 s**. The saved contour contains seven voiced islands, raw segmentation contains seven notes, the normalizer omits zero notes, and the private EventTrack contains the same seven onset timestamps. Raw NPZ pitch/confidence frames equal their JSON counterparts. No voiced island is missing from segmentation.

Other novelty peaks occur inside sustained voiced segments, including 3.680, 6.179 and 7.033 s. Those might be repeated attacks, decay fluctuations or accompaniment; they are not independently verified missing notes. Segmentation of repeated same-pitch notes remains a possible separate issue, but the present data does not establish it. Increasing note density or lowering the minimum duration would not reconstruct F0 that is absent.

The read-only audit exports **34 exploratory novelty peaks**, including decay and accompaniment. This is an inspection aid, not another semantic detector or an accuracy denominator. It uses a fixed 2048-sample STFT, hop 128, positive magnitude differences, 220 ms display spacing and prominence 3.5% of the maximum. No parameter search was run and no peak becomes a MusicEvent.

## Possible separation damage

The attacks have not vanished from the saved piano audio: the table's RMS ratios retain substantial amplitude, and 500–2500 Hz energy ratios are approximately **0.91–1.00**. However, 80–500 Hz energy ratios are **0.67, 0.40, 0.55 and 0.78**, respectively. The stem changes the harmonic balance even where the attack remains. These are signal-energy ratios, not precision/recall scores or proof that the correct fundamental survives.

This supports two unresolved upstream possibilities: MELODIA rejects a still-present pitched contour, or separation alters low harmonics enough to make that contour unavailable. It does **not** prove the stem is undamaged. Original/stem differences can also reflect intended accompaniment removal; piano separation does not isolate the primary line from other piano notes.

The [MELODIA API](https://essentia.upf.edu/reference/std_PredominantPitchMelodia.html) describes contour salience/voicing decisions and zero confidence for unvoiced output. The recorded baseline has `guessUnvoiced=false`, 100 ms minimum contour duration and default salience/voicing settings. The [segmenter](https://essentia.upf.edu/reference/std_PitchContourSegmentation.html) operates on the resulting pitch sequence and signal RMS. Internal pre-selection contours were not saved, so the exact salience/contour rule responsible for each rejection is not established. No such rule was changed.

## Artifacts and preservation

Inspect the [waveform/F0/segments figure](../../src-tauri/target/gymnopedie-missing-attacks/waveform-f0-segments.png), [all observations](../../src-tauri/target/gymnopedie-missing-attacks/waveform-candidates.csv) and [machine-readable audit](../../src-tauri/target/gymnopedie-missing-attacks/audit.json). The standalone figure overlays original/stem envelopes, novelty and saved F0; it does not add or replace a Grid. The [existing listening page](http://127.0.0.1:5173/src-tauri/target/generalized-melody/listen.html) remains unchanged.

Fresh checks passed for exact seven-segment preservation, raw NPZ/JSON equality, EventTrack onset preservation, seven represented voiced islands and valid SVG rendering. **183 source/input/output/UI hashes match before and after**. The first standalone figure had a Windows text-encoding error; UTF-8 output and XML validation corrected it without changing any baseline. No model inference, separation rerun, production code, thresholds, renderer or listening-page changes occurred. No additional server was started; the isolated figure browser closed.

Reproduce from the repository with the existing Python environment:

```powershell
& 'src-tauri/target/analysis-venv310/Scripts/python.exe' scripts/audit-gymnopedie-missing-attacks.py
```

## Unresolved questions

Which exact times correspond to the approximately five missing audible attacks, and are they primary-line notes or other piano attacks? Does the saved stem preserve their recognizable pitches? For attacks with zero F0, which internal MELODIA contour/salience decision rejects them? Those questions remain open; this audit does not justify a threshold change or an automatic next experiment.
