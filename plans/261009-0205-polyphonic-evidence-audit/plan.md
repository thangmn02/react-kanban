# Gymnopédie polyphonic-evidence audit

Status: complete; stopped for human review. [Diagnosis](../reports/diagnostic-261009-0205-polyphonic-evidence-audit.md).

Outcome: distinguish overlapping note evidence from harmonic/octave ambiguity at 0.360, 1.138, 5.074 and 7.634 seconds. Neither audible pitch is assigned a melodic role from the user's feedback. Keep the product goal of one primary line.

- [x] Read the saved internal contours and verify protected baseline hashes.
- [x] Compare aligned mixture/piano spectra and component attack envelopes, explicitly reporting temporal resolution and ambiguity.
- [x] Inspect 4-second context and compare each available contour with the acoustic harmonic families.
- [x] Export evidence and aligned context listening without adding semantic events or changing the Grid.
- [x] Verify preservation, write the concise diagnosis and stop.

No new MELODIA inference, separation, threshold change, training, segmentation, semantic events, production changes or automatic next experiment. Preserve the seven accepted stem events and prior diagnostics. Reuse the existing port 5173 server (PID 3132); start no new server.
