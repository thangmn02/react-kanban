# Gymnopédie missing-attack audit

Status: read-only audit complete. [Report](../reports/diagnostic-261009-0128-gymnopedie-missing-attacks.md). Upstream F0 gaps are confirmed; exact internal rejection and possible harmonic damage remain unresolved.

Preserve the seven accepted manual piano-stem events, unchanged MELODIA and segmentation parameters, existing listening page/Grid, and all production behavior. Human feedback describes approximately twelve audible piano attacks and better precision from the stem; it is qualitative, not timestamped ground truth.

- [x] Freeze current A/B inputs, contours, segmentation, page and source hashes.
- [x] Compare saved waveform attacks, voicing/F0 availability, raw segments and normalized events at the same original position.
- [x] Inspect original/stem waveform and frequency evidence for possible separation damage without treating mixture events as ground truth.
- [x] Export diagnostic evidence and a concise mechanism report, clearly separating measured facts from unresolved human attack identity.

No model run, threshold changes, output-count target, new semantic events or renderer changes. Diagnostic waveform candidates are observations only, not another detector repair.
