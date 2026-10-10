# Reuse the semantic grid for Melody listening

The latest human feedback establishes that raw Basic Pitch vocal proposals fail recognizable pitch, attack and rest timing in H.S.K.T.; proposal counts were insufficient evidence. Tracker scoring is stopped. An upstream audit began, but the subsequent request limits the current handoff to diagnostic UI, so the unexecuted F0 prototype remains paused.

Embedded the existing semantic forty-cell component in the existing 25-excerpt comparison with one fixture media clock and the unchanged playback scheduler. Added v3/candidate selection, counters, existing row recording/export with source/pitch/media-time enrichment, and bounded locally saved human markers. Kept unrelated live capture out of this page. Corrected a recording identity issue so changing streams before export cannot relabel the preceding trace, and verified recording starts correctly from pause.

Eight focused tests, 770 full-suite tests, types/lint, real-fixture Edge checks and all 25 first-event checks passed. Accepted source hashes and v3 bytes match. Mechanical timing is not musical acceptance; stop for listening review. No models, production paths, deployment or Phase 5 changed.

The journal CLI failed with `Command failed`; this native file is the local history fallback. AgentWiki publish skipped. Existing Vite PID 3132/port 5173 stays available; owned tests and isolated browsers exited.
