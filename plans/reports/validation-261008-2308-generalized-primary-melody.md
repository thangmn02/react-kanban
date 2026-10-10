# Generalized Melody candidate: comparison ready, quality gate failed

**Later human evidence:** H.S.K.T. raw Basic Pitch vocal pitches fail recognizable melody, note-attack timing and phrase-rest listening. Both v3 and candidate click paths sound wrongly timed. The candidate-availability/accuracy gate is now **FAILED**, independently of the ownership regression described below. The earlier recovered proposal count is not proof of correct sung notes. Tracker scoring is stopped. The [private visual diagnostics plan](../261008-2345-melody-visual-diagnostics/plan.md) adds the existing semantic grid to the same comparison clock without changing either note stream.

One private generalized voice-path candidate was implemented and evaluated mechanically across 25 excerpts. It is **rejected for adoption**: it displaces the accepted H.S.K.T. vocal continuation with guitar ownership. The existing `primary-melody-phrases-v3` source and its nine accepted 16–21-second vocal attacks remain unchanged. No further automatic tuning, deployment or Phase 5 follows.

Open [the single local comparison](http://127.0.0.1:5173/src-tauri/target/generalized-melody/listen.html). It offers original audio, candidate clicks/pitches, preserved v3 clicks/pitches, all four raw Basic Pitch source-pitch auditions, two ownership timelines, a pitch contour, timestamp lists and separate A/B/C judgments. Synthesized pitches are labeled; they are not isolated recorded voices. Mode switches preserve the real media position. Reviews persist locally and export with audio, candidate and tracker identities so stale judgments cannot silently apply to changed analysis.

## Representative set and generalization boundary

There are 25 unique decoded audio excerpts, 24 track families, six calibration excerpts, five previously used regressions and fourteen holdout excerpts across thirteen families. Splits are by track family, not individual stem or window. No parameters were selected from holdout results. The two Praise The Lord windows share one holdout family and are not independent-song evidence.

An exact decoded-audio comparison corrected an old ambiguous label: `vietnamese` is the NHỨC TIỀM THỨC benchmark audio, not the Chinese-pop track. Its apparent new holdout was therefore a duplicate and was replaced with the unused Chinese-pop fixture before final validation. The original manifest is retained alongside the corrected one; duplicate waveforms now cause the preparation tool to fail. This is provenance correction, not song-specific production logic.

The set covers vocal pop with competing accompaniment, guitar/rock, jazz ensembles, piano/classical, rap, instrumental/synth, dense remixes and ambient/sustained material. Whether a given rap/ambient passage has a confident pitched main line is a listening judgment, explicitly represented in the rubric. This set does not establish universal coverage, and the new holdouts have no complete human note ground truth.

## A — Candidate availability

Every source's unfiltered saved Basic Pitch notes can be auditioned separately. The report exports timestamps, pitch, model activation and postprocessing disposition for each proposal. Model activation is not calibrated primary-melody confidence or human accuracy.

H.S.K.T.'s reported middle phrase has measured vocal candidates and user-confirmed recovery in v3. Gymnopédie has 134 piano candidates, 118 passing the existing standalone amplitude/duration filters, despite v3 selecting three guitar notes. These are concrete reasons to investigate selection before replacing extraction. They do **not** prove that Basic Pitch represents every correct primary note across the broader set. Correct-line availability for the remaining excerpts remains pending raw-candidate listening; no invented numerical extraction recall is reported.

The new audio was processed with the already installed HTDemucs 6-source separation and Basic Pitch ONNX assets. Only vocals/piano/guitar/other entered Melody selection; drums and bass were excluded. Existing model inference settings were reused, with no new models, source priorities, provider downloads, server jobs or public audio upload. Fourteen new final-set excerpts had local Melody-only inference; their measured preparation median was 48.149 seconds, including separation, transcription and artifact writes. This is local CPU evidence, not Modal latency, first-playback delay or a hosting cost estimate.

## B — Melodic role / ownership

The current tracker scores a complete source phrase, penalizes its polyphonic onset clusters and inherits ownership with hysteresis. A polyphonic source can contain both the primary line and accompaniment; coherent, confident accompaniment can also outrank a main voice. That is a role-inference limitation, independent of whether the notes exist.

The one experiment, `primary-melody-voice-path-v1`, proposes nonoverlapping note trajectories scored by measured pitched duration and continuity instead of forcing one note at every source onset cluster. It scores the selected voice without penalizing the entire stem merely for containing chords. It uses no fixed high-register preference, vocals-first rule, source-energy rank, artist or song mapping. Existing amplitude/duration admission and ownership margins are retained. The search rejects more than 4,096 proposals per phrase rather than running unbounded quadratic work. Short-note continuations retain the accepted measured notes and original anchor confidence.

This does not solve predominant melodic role. In H.S.K.T., the altered guitar phrase scores still prevent the vocal challenger from crossing the unchanged ownership margin. At 16–21 seconds the rejected output selects six guitar attacks; preserved v3 selects the same nine vocal attacks accepted by the user. The failure is **ownership**, even though the correct continuation remains among the internal proposals. It must not be called successful preservation of rendered vocal output.

The NHỨC TIỀM THỨC regression also illustrates ownership abstention: 124 raw vocal proposals produce a 37-note internal vocal path, but its approximately 0.707 voice score competes with other near-score phrases. The candidate emits zero notes while v3 emits 59. This is not a lack of Basic Pitch vocal candidates or an empty internal path. The new role comparison does not retain v3's duplicate-voice ambiguity treatment, and near-score ownership remains unresolved. No global margin relaxation is applied to hide the failure.

## C — Note retention

Raw proposals are classified separately as selected, amplitude/duration filtered, absent from an admitted phrase, excluded by source ownership, or excluded from the voice path. The continuation interval uses the preserved 100 ms admission; standalone notes retain the 160 ms rule. Voice-path exclusions include merged retriggers and competing chord voices, so their count is **not** a missed-note count. Only listening or independent labels can establish whether an excluded note was meaningful.

The new path selects 18 piano notes for Gymnopédie versus v3's three guitar notes. Source ownership and event count changed, but whether the selected contour follows the recognizable melody remains unverified. The tracker can still choose a coherent accompaniment voice, and strict note-overlap assumptions can remove usable transcription tails. No extraction success or perceptual improvement is inferred from counts.

## Per-excerpt mechanical evidence

The table below records raw availability and selected-output quantities, not accuracy. Raw order is piano / guitar / other / vocals. Exact ownership timelines and every raw-note disposition are in the private `report.json` and `stage-audit.json`. A correct primary line and B/C musical correctness remain human judgments for each row; the H.S.K.T. ownership regression is already established against the accepted passage.

| Excerpt | Split | Raw P / G / O / V | v3 notes | Experiment notes |
| --- | --- | ---: | ---: | ---: |
| nujabes | calibration | 24 / 15 / 81 / 41 | 31 | 34 |
| hysteria | regression | 57 / 217 / 47 / 106 | 47 | 41 |
| yellow | calibration | 71 / 351 / 47 / 52 | 46 | 23 |
| redbone | calibration | 6 / 6 / 12 / 45 | 18 | 18 |
| take_five | regression | 51 / 108 / 40 / 54 | 52 | 53 |
| levels | calibration | 161 / 138 / 104 / 70 | 25 | 29 |
| gymnopedie | calibration | 134 / 38 / 99 / 24 | 3 | 18 |
| lee_hi_hskt | calibration | 75 / 129 / 116 / 96 | 57 | 34 |
| Hà An Huy - NHỨC TIỀM THỨC (prior regression) | regression | 162 / 71 / 95 / 124 | 59 | 0 |
| ambient | regression | 195 / 124 / 265 / 69 | 65 | 21 |
| 50_cuoc_goi_nho | holdout | 132 / 225 / 296 / 134 | 75 | 25 |
| be_oi_remix | holdout | 138 / 81 / 166 / 201 | 31 | 47 |
| chan_ai_remix | holdout | 87 / 58 / 335 / 81 | 89 | 31 |
| co_don_anh_cung_vui | holdout | 94 / 75 / 130 / 93 | 40 | 39 |
| khong_buong | holdout | 98 / 70 / 145 / 82 | 51 | 35 |
| 告五人 - 爱人错过 | holdout | 116 / 287 / 149 / 95 | 59 | 32 |
| one_more_time | holdout | 43 / 32 / 124 / 59 | 37 | 43 |
| voodoo_people | holdout | 53 / 241 / 31 / 22 | 65 | 47 |
| xo_tour_llif3 | holdout | 61 / 46 / 53 / 104 | 51 | 51 |
| MONO - Em Là (intro) | regression | 151 / 90 / 136 / 64 | 57 | 34 |
| bich_intro | holdout | 122 / 48 / 108 / 58 | 37 | 12 |
| caravan | holdout | 109 / 104 / 158 / 76 | 55 | 42 |
| praise_the_lord | holdout | 51 / 38 / 119 / 65 | 48 | 34 |
| no_more_goodbye | holdout | 77 / 32 / 116 / 77 | 23 | 21 |
| praise_the_lord_intro | holdout | 58 / 42 / 78 / 21 | 32 | 28 |

## Verification and gates

- Full Vitest suite: **106 files, 762 tests passed**. Existing Python analyzer suite: **24 passed**. Type checking, scoped ESLint and the web build pass; the existing build chunk-size warning remains.
- Isolated Edge: all 25 excerpts and nine audio modes per excerpt load with matching durations; play/pause, same-position comparison, review persistence and export work, with zero page errors. Observed mode-switch position difference was 18.265 ms. This measures the comparison UI, not detector-to-DOM latency or audible note correctness.
- All seven frozen detector/delivery/render source hashes match. Bass, scheduler, merger, cache and EventTrack code were not edited. The accepted v3 tracker source matches its preserved snapshot byte for byte. All final note outputs are bounded and monophonic.
- A scoped simplifier/reviewer corrected diagnostic duration bins; no production scoring or unrelated worktree edits were made. A later characterization assertion explicitly protects continuation anchor confidence.
- Candidate musical gate: **FAIL for adoption**, because the accepted vocal-ownership passage regresses. Broad 80% user-rated acceptance: **NOT RUN**, not a made-up accuracy score. At least 20 of 25 acceptable judgments, no systematic phrase/ownership failures and no substantial holdout regression would be necessary; percentage alone cannot override a mandatory failure.
- Real playback → Modal → atomic EventTrack/cache publication: **withheld behind the failed listening gate**. No ordinary capture-to-cache integration success is claimed for this experiment.

The preserved v3 candidate is the best available checkpoint, not a generalized Melody release. Remaining limitations are melodic-role inference and voice/note selection; broader correct-candidate availability remains unresolved until raw auditions are judged. No alternate extraction model is introduced without that evidence. Do not begin another automatic heuristic or training cycle.

## Reproduction, preservation and operational state

Use the local analysis environment for `scripts/prepare-generalized-melody.py --cases <private-cases.json> --output <ignored-target-directory>`, then `scripts/render-generalized-melody.py --output <same-directory>`. The CLI requires 20–30 cases, family-consistent splits, exact cached-audio provenance, valid excerpt identities and unique decoded audio. `scripts/select-melodic-role.mjs` is a separate private opt-in; production selection/export defaults are unchanged.

All audio, raw candidates, manifests, rejected outputs, runtime records and browser evidence remain in ignored `src-tauri/target/generalized-melody`. Earlier failed trackers and v3 artifacts remain under their original private directories. No audio/model/personal annotation data is staged or published. No new commit, migration, hosted cache mutation or release is claimed.

Owned analysis, rendering, test and isolated browser processes have exited. The existing Vite preview at `127.0.0.1:5173`, PID 3132, is retained for the user's listening page. No duplicate dev server was started. The original Phase 4 integration, rights and privacy gates remain in force; this local experiment does not clear them.

The journal CLI returned `Command failed`; a [native local journal](../journals/2026-10-08-generalized-melody-candidate.md) preserves the session record.
