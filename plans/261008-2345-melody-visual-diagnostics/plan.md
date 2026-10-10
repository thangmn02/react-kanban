# Melody visual listening diagnostics

Status: delivered for human listening review. Private UI only; musical quality remains failed. See [validation report](../reports/validation-261008-2345-melody-visual-diagnostics.md).

Reuse `SemanticBeatPattern`, its existing 150 ms animation, the playback scheduler and `beatRowDiagnostics` in the existing 25-excerpt comparison. Exactly one audio element is authoritative. Precomputed v3/candidate notes must never enter an unrelated live browser session.

- [x] Add a private fixture adapter to the existing scheduler; flush/rebuild on seek, pause, replay, buffering, media replacement and A/B change.
- [x] Embed the existing five-row/eight-cell semantic component with Melody explicitly enabled. No decoration, live capture or new percussion/Bass processing.
- [x] Add selected-stream total/played/latest/owner counters, existing row trace recording/export, source/pitch enrichment and quick human markers.
- [x] Preserve original/comparison/raw auditions and synchronize all mode switches to their single media element.
- [x] Test scheduler lifecycle and reused renderer routing; browser-check pause/seek/replay/A/B/record/export on real saved fixture notes.
- [x] Verify frozen sources and tracker bytes; write report and stop for listening review.

Rows 1–4 are not supplied with fixture events in this Melody-only page. They remain dark and their zero counters are labeled unavailable fixture streams, rather than borrowing unrelated live audio. All production and model sources remain unchanged. The upstream extraction audit and its unexecuted F0 prototype are paused by the latest UI-only request; do not run or retune them here.
