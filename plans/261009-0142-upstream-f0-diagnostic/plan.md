# Final upstream F0 diagnostic

Status: diagnostic complete; stopped for review. [Report](../reports/diagnostic-261009-0142-upstream-f0-diagnostic.md).

Preserve both baseline configurations, all seven accepted stem events, the listening Grid and production paths. These four peaks are diagnostic locations, not confirmed melody-note references.

- [x] Verify baseline hashes, input identity and alignment.
- [x] Inspect the installed Essentia spectral/salience/contour stages with unchanged parameters and verify they reproduce baseline F0.
- [x] Run one diagnostic comparison with only `guessUnvoiced=true`; retain signed confidence and never segment/import speculative pitches.
- [x] Export aligned short audio comparisons and a four-location table that distinguishes voicing rejection, unavailable evidence, possible harmonic loss and uncertainty.
- [x] Verify preservation and stop after reporting.

No threshold search, onset-aware segmentation, separation rerun, new model, semantic-event generation, integration or deployment.
