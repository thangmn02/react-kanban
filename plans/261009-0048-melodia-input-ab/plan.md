# Bounded MELODIA input comparison

Status: implemented and verified; stopped for human listening review of two passages. [Report](../reports/validation-261009-0048-melodia-input-ab.md).

Test original-mixture interference using H.S.K.T. fixture 16–26 s (manually chosen saved vocals) and Gymnopédie fixture 0–10 s (manually chosen saved piano). These are diagnostic choices, not automatic source-selection rules. Reuse existing HTDemucs stems, the unchanged analyzer/defaults/segmentation, existing listening page, grid and one authoritative original fixture clock.

- [x] Record baseline hashes and verify saved stem provenance, sample alignment and offsets against exact original fixtures.
- [x] Analyze exactly four bounded inputs (two mixtures/two stems), retaining raw F0, rests, note boundaries and source hashes separately from the baseline.
- [x] Add original/stem F0 auditions and synchronized trajectory/rest/octave-jump views to the existing private comparison. Preserve existing controls and datasets.
- [x] Validate identical parameters, pause/seek/replay/stream switching, Row 5 trace provenance and preserved source/output hashes.
- [x] Deliver concise evidence/report and stop; human listening determines whether interference, extraction or segmentation remains the bottleneck.

No model search, threshold tuning, separation rerun, production behavior, cache/Modal/database changes, new grid or Phase 5. Preserve all existing Melody baselines and Rows 1–4. Use bounded local outputs under ignored `src-tauri/target`; no external media transfer.
