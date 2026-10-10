# Learned percussion timing and delivery repair

Preserved the original ADTOF candidate. Shorter right context increased vocal
false events, so retained 100 ms context and unchanged thresholds with 50 ms batching.

Reproduced and fixed two delivery failures: arrival-time debounce dropped
distinct timestamped drums; another row's batch removed semantic drum cells
before their animation. Bass, mapping, merger, scheduler, normal decoration and
server models remain unchanged.

102 files / 743 tests pass. Matched animation median improved 271→248 ms,
but p95 remains ~322 ms. Negative events 66→63. Human-verified positive metrics,
perceptual timing and weak-device acceptance remain open. Stop for user listening;
no publication, audio delay, timestamp shift, Melody work or Phase 5.

Measured evidence and the private bundle are linked from
[the repair report](../reports/validation-261008-1640-percussion-latency.md).
The local journal CLI returned a generic command failure; this file preserves
the work record directly. AgentWiki publish skipped.
