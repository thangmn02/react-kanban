# Private Melody visual diagnostics ready

Refresh [the existing 25-excerpt comparison](http://127.0.0.1:5173/src-tauri/target/generalized-melody/listen.html). The embedded grid reuses `SemanticBeatPattern`, the existing forty cells, strict semantic row mapping and 150 ms animation. It does not implement another visual grid. Row 5 is explicitly enabled here; the live four-row baseline mode remains unchanged.

Use **Row 5 stream → Preserved v3 / Rejected candidate** with original audio. Existing click/pitch comparison buttons automatically select their matching grid stream; raw source auditions retain the selected stream. There is exactly one audio element. Its actual `currentTime`, pause/seeking/buffering flags and rate feed the unchanged `createBeatScheduler`. No extension subscription or unrelated live music source is used.

Rows 1–4 have no events supplied by these Melody fixtures and remain dark. Their counters are zero, explicitly labeled as absent fixture streams. No ADTOF or Bass inference is run. This is not a four-row quality reevaluation.

The counters show total selected proposals, events played in the current run, latest target onset and current source owner. Pause, seek, buffering, replay, media replacement and A/B change flush queued events and start fresh generation identities. Already passed notes are not replayed on resume; a backward seek permits a new run. The scheduler retains its bounded queue, late-event telemetry and recovery policy. The adapter replenishes two seconds of look-ahead in bounded batches without modifying those policies.

**Record 30 seconds** uses the existing row recorder and a bounded media range. When paused, it starts the same player before arming the recording. Pause, seek, stream/source change or range completion stops that run so traces do not silently combine different timelines. **Export row trace** retains existing row lists, commit/animation observations and coincidence diagnostics, enriching Melody events with fixture/hash/version, selected source, MIDI pitch, note offset and sampled actual media time. The recording identity is retained even if the selected stream changes before export.

Quick markers record **Missed note, Extra note, Incorrect timing, Incorrect pitch** at the player's current position, with A/B identity, owner and nearest proposal pitch/onset. They persist locally and export with the matching fixture trace. Nearest proposal data is context, not a claim that the proposal is correct; markers are listening observations rather than complete timestamp ground truth. Marker and event-detail storage are bounded.

## Validation

| Check | Result |
| --- | --- |
| Focused fixture/renderer tests | 8 passed: target deadlines, metadata, pause/resume, seek/replay, A/B flush, buffering/rate changes, row-5-only routing, paused recording, disposal/bounds |
| Full existing Vitest suite | 107 files, 770 tests passed |
| Typecheck and scoped ESLint | Passed |
| Isolated Edge, real saved fixtures | Exactly 40 cells and one audio element; all 25 excerpts' first selected events rendered, including approximately 11.6 ms targets near zero |
| H.S.K.T. 16-second trace | Two v3 vocal commits; source and pitch present; only semantic Row 5 flashes; animation starts approximately +24.2 and +25.4 ms against target media times |
| Playback interaction checks | Pause/resume, backward seek/replay, forward seek, A/B switching, paused recording, raw auditions and marker/export controls passed; observed audition switch position difference approximately 26 ms |
| Preserved baseline | All seven accepted detector/delivery/renderer hashes match; v3 source byte-identical to its saved checkpoint |

The two animation measurements are a small diagnostic sample, not a latency distribution, physical audio-output measurement or musical-accuracy score. Private evidence lives in ignored `src-tauri/target/generalized-melody/melody-grid-browser-check.json`, `melody-grid-browser-trace.json`, `melody-grid-replay-trace.json` and `melody-grid-preservation.json`. No private audio, annotations or model files are staged/published.

Inline review verified queue lifecycle, fixture provenance, recorded identity after switching, event detail bounds, and exclusion from product entry points. No production renderer, scheduler, merger, detector, Bass, EventTrack, model, Modal or database changes were made. The new React entry is imported only by the private listening HTML and guarded by the development environment.

The upstream extraction audit is paused by the subsequent UI-only request. Its preliminary unexecuted F0 prototype is not integrated or evaluated; neither Basic Pitch nor tracker algorithms were changed during this UI pass. H.S.K.T.'s raw extraction accuracy and the broader Melody listening gate remain **FAILED**. Visual synchronization does not clear those gates.

All owned isolated browser/test processes exited. The preexisting Vite preview, PID 3132 on port 5173, remains available for listening. No new dev server or deployment was started. Stop for user listening review; no Phase 5 or further automatic tuning.

The journal CLI returned `Command failed`; a native local journal preserves the outcome. AgentWiki publishing was skipped.
