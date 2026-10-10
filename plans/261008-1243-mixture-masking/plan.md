# Bounded transient-residual percussion repair

The user's implementation request supersedes the analysis-only investigation.
Implement causal per-bin background whitening for Rows 1–3, preserving existing
onset candidates and Bass exactly. Preserve the rejected prototype and previous
diagnostics. No renderer, merger, scheduler, cache, routing, Melody or models.

Residual evidence must allow percussion to coexist with sustained tonal/vocal
background. Presence cannot generate an event. No song-specific rules, global
onset threshold change, heavy inference or server dependency.

- [x] Preserve current detector, rejected gate and previous diagnostics.
- [x] Implement bounded causal transient-residual class evidence.
- [x] Immediately replay the same 48-input controls/corpus and reference matches.
- [x] Verify candidate timing, Bass, audibility/envelope and delivery invariants.
- [ ] Expose local semantic-only listening build only after both objective gates pass. **Not eligible:** all three variants fail acceptance.
- [x] Report before/after, limitations and listening status; stop automatic tuning.

Status: evaluated failure; repair remains unresolved. The active detector equals
the pre-pass snapshot. Candidate suite: 55 passed, 4 failed. Existing suite:
726 passed. No default change, publication, Melody work or Phase 5.

[Implementation/evaluation report](../reports/validation-261008-1521-transient-residual.md)

Acceptance: target ≥90% false-percussion reduction on negative controls; retain
the large majority of real percussion, recover Hysteria/Voodoo/Nujabes reference
matches and strong drum-stem behavior. Bass remains frame-exact. An inadequate
candidate stays private; no misleading listening release. Reuse existing preview
PID 3132 at port 5173; no additional background server. At most three bounded
feature variants, preserving each evaluation, before stopping for feedback.
