Create a new local project handoff document at:

plans/261006-beat-grid-model-handoff.md

This document records the conclusions from the external Colab audio-model benchmark. Do NOT implement these models yet. This is a design/benchmark handoff for later roadmap phases.

Record the following as LOCKED prototype semantics:

# Kora Beat Grid — Audio Model Benchmark Handoff

## Goal

The Beat Grid has five semantic rows. The research phase is complete enough to stop tuning and move back to application implementation.

The system is a music-reactive visualizer, not a MIDI transcription product. Precision only needs to be high enough that visual flashes perceptually correspond to the intended musical source.

## Locked five-row semantics

Row 1 — Kick
- Primary prototype detector: ADTOF drum transcription.
- Benchmark result: broadly acceptable across tested genres.
- Known limitation: occasional misses are acceptable for now.

Row 2 — Snare / Clap
- Primary prototype detector: ADTOF.
- Snare detection is broadly acceptable.
- Clap coverage is imperfect because clap and snare are not always represented identically.
- Keep the semantic row as Snare / Clap.
- Do not spend more research time on this now.

Row 3 — Hi-hat / Cymbal
- Primary prototype detector: ADTOF.
- Broadly acceptable.
- Some false negatives/missed hats were observed.
- Accepted for the prototype.

Row 4 — Bass / Low Pulse
- Prototype detector: lightweight DSP directly on the full mix.
- Low-frequency energy/onset analysis.
- Broadly acceptable for the visualizer.
- This row represents bass/low-frequency rhythmic activity, not strict bass-note transcription.

Row 5 — Melody / Main Lead
- Semantic definition is LOCKED: one main melodic lead line controls this row.
- Do not allow arbitrary harmonic changes, chords, background instruments, or multiple simultaneous melodic sources to independently trigger the row.
- Research prototype:
    selected melodic stem
        -> Basic Pitch ONNX
        -> merge sustain/retrigger artifacts
        -> monophonic lead selector
        -> Melody event timestamps

- Research used the HTDemucs "Other" stem as the selected source for H.S.K.T.
- Basic Pitch full-mix transcription alone was too polyphonic/noisy.
- Chroma/spectral-difference melody detection was rejected because it over-triggered badly.
- Vocal-only H.S.K.T. was tested but was not selected as the desired visual lead.
- For the prototype semantics, the Melody row should visually follow ONE dominant melodic line.

## Melody research evidence

Gymnopédie No.1 was used as the clean calibration case.

Human listening:
- approximately 14 audible piano melody attacks in a 12-second test segment.

Previous detectors:
- old chroma/spectral approach: ~45 events
- alternate harmonic-onset attempt: ~92 events
- initial Basic Pitch lead selector: ~29 events

Lead selector v2:
- ~17 events for the same ~12-second region
- substantially closer to perceptual ground truth
- accepted; stop tuning to avoid overfitting one track.

H.S.K.T.:
- full mix contains many simultaneous melodic sources.
- "Other" stem was judged to contain the desired visual lead.
- The project intentionally stopped further Melody tuning after establishing the intended behavior.

## Important distinction

Do NOT hard-code song names or genre-specific song mappings.

The benchmark tracks are test cases, not production rules.

Future production logic should eventually infer/select an appropriate source automatically, but it must preserve the locked semantic behavior:

"One dominant melodic source/line controls Melody for a track."

Genre may be used as a prior, never as a hard rule.

## Research-only vs production

HTDemucs 6-stem separation was useful as a benchmark/oracle.

Do NOT assume HTDemucs 6-stem belongs in the final runtime.

The final application targets weak CPUs including Celeron/i3-class machines. Heavy separation/transcription models must be treated as reference implementations until performance is evaluated.

ADTOF, Basic Pitch and HTDemucs must not be added to production merely because they worked in Colab.

Their behavior is the reference target.

## Current status

Five-row semantic design: LOCKED
Kick approach: ACCEPTED
Snare/Clap approach: ACCEPTED WITH KNOWN LIMITATION
Hi-hat approach: ACCEPTED WITH KNOWN LIMITATION
Bass behavior: ACCEPTED
Melody behavior: LOCKED
Further Colab model tuning: STOPPED

The next application-development work must continue the existing Codex roadmap without skipping the timing/reliability architecture.

Commit this handoff separately if plans/ is tracked. If plans/ is intentionally local-only, leave it local and report that clearly.

Do not modify runtime detection code as part of this handoff.