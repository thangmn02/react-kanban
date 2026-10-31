# Lead Annotation Editor (assisted review)

The editor replaces tap-only labelling for benchmark references. The old tap labeller is kept unchanged.

- **Code:** `scratch/live-lead-261031/annotate/` (`index.html`, `editor.js`, `proposals.js`).
- **Server:** `scratch/live-lead-261031/serve-annotate.mjs`, loopback only, port 5175. It serves the editor, the candidate modules for comparison lanes, and the owner's Downloads audio and draft labels, read-only.

## Integrity rules

**Proposals are independent of the candidates.** Both layers come from `hpss-superflux-v1`: a median-filter harmonic/percussive split, then SuperFlux on the harmonic part. It shares no code or logic with candidate-5 or candidate-6. There are two layers:

- **Strong proposals** become review markers.
- **Band suggestions** (300–3000 Hz by default, adjustable) appear as faint marks. They are added only when the owner clicks them.

**Candidate outputs are display-only.** Candidate-5 and candidate-6 have their own lanes. They are never markers and never exported as references.

**Draft taps are never verified.** An imported tap marks the nearest proposal or suggestion within 60 ms, or else becomes an unreviewed "draft tap" marker. Imported lead sections stay drafts until the owner sets a label.

**What counts as human-verified.** An export is `humanVerified: true` only when all of these hold:
- every marker has been reviewed;
- at least 98% of the region has been heard in the editor;
- the owner has set a lead region label.

Otherwise `verifiedOnsets` is empty. Accepted onsets are still exported, but only as `acceptedOnsetsDraft`.

**Other rules:**
- Batch accept needs a selected range that has been at least 95% heard, plus a confirmation. Markers accepted that way carry `batch: true`.
- Every marker keeps its origin, its original time, the moved distance and the review time.
- Exports carry the audio SHA-256 and the region bounds. Audio never leaves the browser.

## Demo: "Avicii – Levels", 28–52 s, synth lead

| Item | Result |
|---|---|
| Strong proposals | 64 |
| Owner's draft taps in region | 89 |
| Taps that align with a proposal or suggestion (≤60 ms) | 86 |
| Unmatched taps (kept as unreviewed drafts) | 3 |
| Markers to review | 103 (about 14 expected rejects) |
| Owner tap lag vs proposals (lag-corrected check) | median +17 to +27 ms, p90 +51 to +54 ms |
| Candidate lanes | candidate-5: 55 events; candidate-6: 56 |

The tap lag confirms that raw taps cannot support ±25 ms scoring. References come only from reviewed markers, whose times are the proposal or adjusted times.

**Automated check:** accept, reject, uncertain, nudge, undo/redo and export all ran without page errors. The export stayed `humanVerified: false` while review was incomplete.
