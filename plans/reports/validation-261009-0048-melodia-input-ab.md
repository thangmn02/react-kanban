# Bounded MELODIA input A/B — ready for listening

Refresh [the existing private comparison](http://127.0.0.1:5173/src-tauri/target/generalized-melody/listen.html). Select **lee_hi_hskt** or **gymnopedie**, then use **Passage original**, **A: Mix F0**, **B: Stem F0** and **Selected stem audio**. The stereo auditions put the original on the left and measured F0 on the right. Auditions retain the same original position, stop at the passage end and replay from its start when selected again.

## Experiment and preservation

Exactly four inputs were analyzed: H.S.K.T. **16–26 s**, original versus manually identified saved **vocals**; Gymnopédie **0–10 s**, original versus saved **piano**. Stem selection is diagnostic, not a production rule. No separation was rerun.

Both saved originals are sample-identical to the listening fixtures. Archive rate, shape, source PCM hash and recorded offset match: 44,100 Hz, stereo, 30 seconds, zero offset. Cross-correlation within ±100 ms found **zero sample lag** for both passages (correlations 0.508 and 0.989). No timing correction or input gain normalization was applied; FLOAT WAV crops preserve the exact saved samples.

The unchanged actual Essentia analyzer uses identical equal-loudness preprocessing, MELODIA parameters and `PitchContourSegmentation` parameters for A/B. Both inputs are cropped to the same ten seconds. MELODIA depends on analysis context: the new cropped A must be compared with cropped B, rather than attributing differences from the preserved 30-second baseline to separation. Raw crop-relative outputs remain separate; only diagnostic sidecars shift timestamps onto the original fixture clock.

**154 protected file hashes remain unchanged**, including MELODIA source/outputs, v3 source/checkpoints, prior comparison datasets and accepted detector/delivery/render sources. Percussion, Bass, production EventTrack, scheduler, merger and renderer are untouched. The small adapter addition carries the analyzed crop hash into private traces. No database, Modal, deployment or Phase 5 work occurred.

## Descriptive results — not musical scores

| Passage / input | Inferred voiced seconds / 10 s | Rest intervals | Unchanged segmented notes | Adjacent octave-sized jumps | Analysis seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| H.S.K.T. mix | 5.802 | 17 | 33 | 0 | 0.433 |
| H.S.K.T. vocals | 5.648 | 18 | 34 | 0 | 0.398 |
| Gymnopédie mix | 5.042 | 8 | 11 | 2 | 0.286 |
| Gymnopédie piano | 2.734 | 8 | 7 | 0 | 0.281 |

An octave-sized jump means adjacent voiced frames differ by at least 11 semitones; it is not a proven pitch error. Gymnopédie's mix shows +16.3 semitones at 3.437 s and −24.3 at 6.748 s. Removing these alongside substantial voiced material could mean interference removal **or loss of genuine melody**. H.S.K.T. still has substantial inferred rests in both inputs. Counts, confidence and runtime cannot establish recognizable melody or correct phrase gaps.

The piano stem can contain accompaniment and lead played by the same instrument. This comparison therefore tests separation into piano, not perfect isolation of the primary line. Saved separation can also alter notes. These limitations prevent treating a manually chosen stem as a generalized source selector.

## Listening diagnostics and verification

The existing forty-cell grid, Row 5 semantic routing, flash duration, scheduler and single audio element are reused. Cyan/orange contours and separate voiced/rest bands are overlaid on the same ten-second axis. Red marks show octave-sized changes; white marks show the selected input's unchanged segmented notes. Continuous F0 does not create an extra flash producer. Clicking the chart seeks the same original player.

Existing counters, markers, recording, trace export, raw source auditions and prior comparisons remain available. Row 5 traces include original fixture identity, crop hash, mix/manual-stem source, MIDI, target time and actual DOM/animation media time. Rows 1–4 have no fixture events and remain dark in this private comparison.

- Ten focused clock tests and **772 full-suite tests** passed; typecheck and scoped ESLint passed.
- Isolated Edge verified all four streams: one player/grid/chart, exact targets, Row 5 only, crop/source trace export, paused and playing A/B switches, forward/backward seek, replay and bounded passage endings. Four sampled animation offsets were **+22–28 ms** against media time; these are mechanical samples, not physical audio-output latency or a statistical distribution.
- Existing five-fixture MELODIA and full comparison browser regressions also passed with zero page errors, preserving prior targets, markers, exports and auditions. Their evidence remains in `generalized-melody/melodia-browser-check.json` and `melody-grid-browser-check.json`. Musical acceptance remains pending human listening.
- Existing Vite PID 3132 / port 5173 is reused for review; analysis and isolated test browsers exit. No additional server is started.

Evidence under ignored `src-tauri/target/melodia-input-ab`: `report.json`, `preserved-before.json`, `preserved-after.json`, `browser-check.json`, four browser traces and `vitest-results.json`. Inputs and raw analyses live in `generalized-melody/<excerpt>/input-ab`; the combined sidecar is `generalized-melody/melodia-input-ab-report.json`. Original reports remain unchanged.

Reproduce using the existing private runtimes:

```powershell
& 'src-tauri/target/analysis-venv310/Scripts/python.exe' scripts/prepare-melodia-input-ab.py
node scripts/check-melodia-input-ab.mjs
```

This reuses the [private MELODIA installation and licensing boundary](validation-261009-0007-melodia-listening.md#runtime-reproduction-and-license-boundary); no new model, dependency or production rights claim is introduced.

## Decision — STOP for human review

Human feedback on the preserved full-mixture baseline remains: better than the prior pipeline, but F0 and attacks are musically incorrect. The new A/B changes the measured contour; **source interference is not yet established as the bottleneck**.

If B makes the recognizable contour, phrase continuity, rests and octaves materially better, interference contributes, but automatic source selection, separation artifacts and generalization remain unresolved. If B stays wrong, pitch/voicing estimation remains a limitation; stop rather than tune another heuristic. If F0 becomes acceptable but Row 5 attacks remain wrong, record unchanged segmentation as the next separate problem.

Pending questions for these two passages: does the saved stem preserve the audible main phrase, and does B follow its melody and rests better than A? No automatic integration, tuning or further experiment follows this report.
