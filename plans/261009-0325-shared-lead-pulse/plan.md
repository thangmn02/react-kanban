# Shared precomputed Lead Pulse development integration

Status: development candidate delivered; stopped for human listening review. Public deployment is not authorized.

Outcome: one versioned server-side Lead policy, an additional experimental mode on the existing `/beat-grid?musicDebug=1` demo, and the same validated EventTrack representation in Web/Tauri behind an off-by-default feature flag. Row 5 may represent meaningful non-pitched vocal articulations or conservative instrumental/melodic note attacks. Preserve Rows 1–4, playback recovery/scheduling, prior diagnostics and baseline outputs.

Policy: use existing separated vocals/piano/guitar/other automatically, with passage-level measured activity, pitched continuity, ambiguity abstention and ownership hysteresis. Vocal articulations require persistent vocal-body evidence, not stable F0; reject short/noisy transients and probable drum bleed. Instrumental attacks require pitched evidence; no energy-only fallback or automatic union of models. One selected source at a time, bounded/deduplicated events and explicit optional MIDI/provenance. Freeze one configuration before evaluating additional holdouts; no post-holdout tuning.

- [x] Implement/version/test the server Lead policy and extraction adapter, independently of rejected trackers.
- [x] Lock representative regression and unused-range holdouts; prepare bounded local analysis with automatic source selection and measured runtime.
- [x] Add Lead mode to existing demo/clock/trace/counters; retain private baseline comparisons.
- [x] Extend validated shared event provenance and feature-gated client/versioned cache routing for Web and Desktop; preserve legacy behavior with flag off.
- [x] Verify real audio playback, pause/seek/rate/source/empty/missing cache, timestamp parity, measured debug performance and existing regression suites.
- [x] Review implementation, document setup/policy/licensing/rights/release blockers, provide a small listening set and stop.
- [ ] Human listening/generalization acceptance. No precision/recall or production readiness asserted.
- [ ] Public release gates: authorized input/Modal/Supabase end-to-end, optional cloud image, rights, weak-hardware and long-session validation.

Evidence: [validation and listening report](../reports/validation-261009-shared-lead-pulse.md).

Process handoff: the interruption ended the original port-5173 server. It was
restored with `npx vite --host 127.0.0.1 --port 5173 --strictPort`, exec session
52560, Node PID 1924 in this checkout, retained for the requested listening review.
The owned port-1420 desktop frontend and native test application were stopped.
The test-only DOM mount could outlive a CDP disconnect; cleanup now reloads the
page in `finally`. A fresh route shows the normal app shell; reload any stale tab.

No song/artist/genre/language rules, manual source mappings, new model training, normal-product model selectors, database migration, production deployment or automatic subsequent experiments. Mechanical success is not musical acceptance; retain the candidate and report limitations if human generalization remains unproven.
