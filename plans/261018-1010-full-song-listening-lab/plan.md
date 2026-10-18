# Full-song private listening lab

Status: complete; ready for the user's full-song listening review. Branch `codex/beat-grid-quality-recovery`; base
`fd2714b0b41abfd1dc3ca38efea0649d3beeec06`.

## Outcome and constraints

Play a complete authorized local recording using one clock, switch frozen A/C
predictions while playing (B remains available), and flag qualitative problems
without requiring onset annotation. Preserve the existing detailed excerpt
review, source identities, model weights/preprocessing/thresholds, production
runtime and permissions. No downloads, model search/training or old benchmark
rerun. HSKT is an unexpanded user label; assignment requires exact file selection.

## Work and acceptance

1. Inspect existing inference, separation and identity contracts. Add bounded,
   cancellable local preparation, source/model/config versioned cache, progress,
   explicit failures and complete-coverage receipts. Test with an authorized
   generated complete fixture before requesting either real recording.
2. Add the Full-Song Listening Test to `/lab/`: file selection, readiness,
   full-track player/navigation/detail waveform, seek/loop/jumps, original/short
   renderer, separate bounded class lanes and highlighted A/C (optional B).
3. Persist source-bound qualitative feedback separately from blind annotations;
   export nearby predictions and open adjustable focused review with the existing
   strict controls. Exposed feedback never creates official P/R/F1.
4. Verify real A/C full-length preparation, cache reuse/invalidation, cancellation,
   time mapping/coverage, source races, playback continuity, bounded DOM, feedback
   persistence/export, renderer event parity and production regressions. Obtain
   independent review for the cross-module change.
5. Leave one tracked server on 5173/5174, document readiness of each requested
   song, commit and bind logs/artifacts. Provide a short Vietnamese guide.

Private data/cache/audio remain under ignored `scratch/acoustic-visual-lab/`.
Plan and final report remain state records, not detector qualification.

## Completion

All five work items are implemented and verified. Both user-confirmed recordings
are prepared for A/C/B and passed native playback and uninterrupted A/C switching.
The unchanged ADTOF EOF gaps are explicitly unavailable; they are not scored.
App tests (912), Node contract tests (39), Python tests (6), typechecks, build and
bundle budget pass. Lint has zero errors and 27 existing warnings. Full-song,
cache/cancellation, excerpt, annotation API and live baseline checks pass.
Independent review drove provenance/cache/source/resource fixes; the last
follow-up review was unavailable due to its usage limit. Primary self-review and
focused source/cache/coverage checks cover those final fixes.

Evidence and the final revision are linked in the
[delivery report](../reports/engineering-261018-1010-full-song-listening-lab.md).
One tracked server remains on 5173/5174 for the requested listening session.
