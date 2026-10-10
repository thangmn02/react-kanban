---
status: in-progress
---

# Beat phase correction and Melody flashes

Outcome: sparse captured music continuously corrects its estimated eighth-note
phase from real kick onsets. The fifth row flashes on Melody activation/new
phrases and real hat accents, with envelope intensity and the existing 700 ms
expiry. Clock fallback and silence never fabricate live lighting.

Constraints: retain dense-drum onset lighting, capture consent/leases, detector
sensitivity options, current transport identity guards and reduced motion.
Use the requested 0.35 eighth-note error gate and 0.4 correction gain. This gate
does not distinguish every syncopation or correct arbitrarily bad initial phase.
No new dependencies, pitch transcription, BPM UI, or row remapping. Preserve
the existing confidence-release policy; do not label prediction during silence
as captured beats. Source and package changes do not imply installed code changed.

Acceptance: regression tests show bounded four-kick convergence from accepted
offsets, rejection beyond the gate, no repeated/backward tick emission, and no
accumulated phase drift during ten-minute jittered simulations. Real FFT capture
engages kick feedback; sparse/dense behavior stays intact. Melody rises/new notes
and raw hats flash the fifth row independently of estimated tempo ticks; steady
envelopes do not fabricate repeated flashes. Pause, loss and expiry clear it.
Five-minute EDM/pop/lo-fi and ten-minute real-playlist visual acceptance require
actual playback evidence and must not be inferred from synthetic simulations.

1. Diagnose source and add reproductions for phase and Melody flash behavior.
2. Add bounded kick feedback, wire capture, and implement independent fifth-row flashes.
3. Run focused and shared tests, types, lint, build/package checks and review.
4. Document verified behavior and any remaining real-playback acceptance.

Owning files: extensions/kanban-music/tempo-tracker.js and capture-engine.js,
src/features/music/BeatPattern.tsx, src/components/focus/floatingFocus.css and
their nearby tests. Shared transport already carries/leases Melody; change only
if an actual failing regression requires it. Runtime extension version/ZIP should
identify the new behavior. Native release publication is separate from code verification.
