---
title: Generalized Primary Melody recovery
status: blocked
created: 2026-10-08
branch: main
---

Human update: H.S.K.T. raw Basic Pitch vocal reconstruction fails recognizable pitch, note timing and phrase-rest listening. Its candidate-availability/accuracy gate is **FAILED**, not pending or established by proposal counts. Both tracker click paths also fail. Further ownership scoring is stopped; the upstream audit is recorded in [the extraction plan](../261008-2330-melody-extraction/plan.md). Retain every existing checkpoint unchanged.

Build one private generalized Melody candidate, evaluated on 20–30 diverse authorized local excerpts. Preserve the accepted H.S.K.T. measured phrase continuation and all frozen percussion/Bass/delivery contracts. No individual-song/source priority, model survey, public deployment or Phase 5.

- [x] Recover the failed broader listening gate and preserve existing candidate/diagnostics.
- [x] Lock excerpt identities and track-family-disjoint calibration/holdout split before evaluating the new candidate; correct one mislabeled duplicate using decoded-audio hashes.
- [x] Export separate candidate availability, melodic-role ownership and note-retention evidence; distinguish machine dispositions from human correctness judgments.
- [x] Implement one bounded generalized voice-path candidate; reject it on known ownership regressions and leave production defaults unchanged.
- [x] Generate one original/pitches/attacks/ownership comparison with raw candidate audition and a human rubric for all 25 excerpts.
- [x] Run regression, full-suite, type/build and local browser checks; verify frozen source hashes.
- [ ] Obtain broad user listening: at least 80% acceptable, no systematic vocal omission/accompaniment displacement, recognizable sparse/instrumental leads and no substantial unseen-holdout regression.
- [ ] Only after that listening gate passes, execute the existing authorized real-input/EventTrack/Modal integration gate.

The old 11-case report is a regression record, not final holdout evidence. Split by media family so excerpts/stems of the same song never cross calibration and holdout. Previously used percussion fixtures can be Melody holdouts only when no Melody selection was evaluated on that family. Mark prior exposure explicitly. Never calculate precision/recall from model predictions or interpret counts as musical success.

Use saved candidates/separation when their exact audio provenance is known. New analysis is Melody-only, bounded to the local excerpt, and uses existing Basic Pitch/HTDemucs assets; no provider download, ADTOF inference, upload or cache mutation. Artifact generation remains under ignored `src-tauri/target/generalized-melody`. Preserve v3 source/results and the original failed tracker. No rollback of unrelated worktree changes.

Known evidence: H.S.K.T. has measured short vocal notes recovered by the accepted continuation; early ownership still selects accompaniment. Gymnopédie has 134 raw piano candidates (118 pass existing standalone filters) but only three selected guitar attacks. This distinguishes raw candidate presence from whole-source ownership and monophonic-path selection; it does not prove all ground-truth notes are represented.

If the one candidate fails broad listening, retain its artifacts and stop. If candidate availability cannot be established, report that limitation rather than silently calling ownership improvements a transcription fix.

The private `primary-melody-voice-path-v1` experiment fails an existing mandatory regression: it retains the nine H.S.K.T. vocal continuation proposals and their original anchor confidence, but does not award vocal ownership, selecting guitar instead. It also abstains over the NHỨC TIỀM THỨC regression despite having a measured internal vocal path. Gymnopédie's changed piano ownership is not listening acceptance. Preserve this rejected experiment, the exact v3 source/outputs and all diagnostics; do not start another automatic scoring or model experiment.

The final corpus has 25 unique decoded inputs across 24 track families: six calibration, five previously exposed regressions and fourteen holdout excerpts from thirteen otherwise unused Melody families. The old `vietnamese` label proved to be NHỨC TIỀM THỨC, so its duplicate holdout was replaced with the unused Chinese pop fixture. Original and corrected manifest records are retained privately. All correct-main-line availability judgments and the 80% user listening gate remain unverified; known regressions already prevent adoption or integration. See [the report](../reports/validation-261008-2308-generalized-primary-melody.md).
