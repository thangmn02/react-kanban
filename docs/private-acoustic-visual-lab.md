# Private acoustic and visual listening lab

This research interface replays saved predictions against exact local audio. It
does not qualify a detector or establish physical audio/display synchronization.
The prior [V2 replacement NO-GO](../plans/reports/engineering-261016-1459-beat-grid-v2-sprint.md)
remains in force. Implementation and measured results are recorded in the
[diagnostic report](../plans/reports/engineering-261018-0809-acoustic-visual-diagnostic.md).

## Start and stop

Use the acquired workspace and its existing isolated Python environment. Check
port owners before starting; stop the old owned listening server instead of
starting another port. From the repository root:

```powershell
# Required before first reuse of the frozen sprint evidence:
powershell -NoProfile -File scripts/reproduce-beat-v2-round.ps1 -VerifyOnly
scratch/beat-grid-v2/.venv/Scripts/python.exe scripts/prepare-acoustic-visual-lab.py
node scripts/serve-acoustic-visual-lab.mjs
```

Open [the listening lab](http://127.0.0.1:5173/lab/). The existing
[Private Grid](http://127.0.0.1:5173/) links to it. The server builds the private
entrypoints at startup; restart it after edits. Its PID, ports, command and
workspace are recorded in `scratch/acoustic-visual-lab/server-process.json`.
Stop the foreground command with Ctrl+C. It binds only to loopback, serves
allowlisted audio, and writes reviews locally. It requires the previously
acquired private evidence; a clean clone contains no music or model weights.

The preparation script fails on changed historical artifacts, source code or
result records. The owning documentation may link this lab; its old Git blob is
verified against the frozen receipt and the current documentation hash is
recorded separately. No predictions are recomputed by preparation.

## Listen and mark XO first

1. Leave predictions hidden. XO starts at source time 45.000 seconds and loops
   through 57.000. Play, pause, seek or replay the passage. Set a reviewer ID.
2. Click the waveform to position the cursor, zoom and replay around it. Mark
   only audible attacks. Choose instrument, confidence, overlap, ambiguity and
   onset uncertainty. A waveform peak is not automatically a drum identity.
   Keep uncertain sounds unknown or exclude ambiguous intervals.
3. Save locally and export the annotation JSON. Preliminary marks stay
   `provisional-human-reference`. You may then reveal A/B/C, switch predictions
   during the same playback, inspect individual markers and the semantic grid,
   and export per-hit evidence. Switching candidates does not restart audio.

For an official excerpt subset, first independently check every included onset
and complete Kick, Snare and true-Hat coverage outside excluded intervals.
Use the coverage panel to attest completeness and explicitly freeze **before
using model output to select or correct the reference**. Exclusions have a
50 ms boundary guard. Natural matching is at most 50 ms, constructed controls
40 ms, and same-class neighboring onsets tighten either tolerance to gap/4.
No prediction can match two references. Timing uncertainty must also fit the
natural 50 ms/gap/4 bound. A frozen subset is a reviewer attestation, not
automatic verified ground truth or general music-domain qualification.

Exposure persists through hide, reload and import. New or acoustically edited
marks after disclosure retain exposure. Changing events, coverage, ambiguous
intervals or reviewed bounds after disclosure makes the selection provisional;
an independent blind subset is then needed for official metrics. Existing
unchanged blind references retain provenance. No unmatched provisional
prediction is called a definite false positive. Do not tune thresholds to
manual timestamps. The prior Whiplash onset references are not silently imported
or promoted.

The structural [annotation schema](../scripts/acoustic-annotation.schema.json)
is supplemented by [runtime validation](../scripts/acoustic-visual-lab-core.ts).
Reviews and revision history live in ignored
`scratch/acoustic-visual-lab/annotations/`; export before moving machines. The
default namespace is `listener`; `?review=another-reviewer` selects an explicit
separate local review. A stale save receives a conflict instead of overwriting
the latest revision. Automated checks use their own namespaces.

## Source and candidate identity

The source panel shows the original file, canonical WAV and browser-decoded
float PCM SHA-256 values. The browser verifies both canonical WAV and decoded
44.1 kHz PCM before enabling playback. The owned AudioContext is the one clock
for A, B and C. Source time is `canonicalSample / 44100 + sourceOffset`.
Leading silence, exact unpadded PCM identity and separator sample-length parity
are checked in `scratch/acoustic-visual-lab/reuse-verification.json`. There are
no manual candidate offsets. Failed decoding/hash checks disable playback.

| Track | Saved pipeline | Interpretation |
| --- | --- | --- |
| A | BASE, frozen accepted ADTOF | Original baseline; not rejected ADTOF Candidate B |
| B | C1, Frame-Level Drum CNN | Saved outputs only; no live-streaming claim |
| C | C2-separated, corrected OAF + HTDemucs | HH/Tambourine/Maracas remains grouped percussion, never verified true Hat |

Individual Kick, Snare, Hat, grouped-percussion, Cymbal and Tom markers retain
their identity and source timestamp. The existing grid has a shared upper
percussion row; use the separate lanes for semantic distinctions. Saved raw
scores are uncalibrated model output. Missing raw stages remain unavailable.
Controls with no saved separated OAF input show N/A, rather than inferred output.

## Visual and live diagnosis

The original renderer is the default. One private short-attack prototype uses a
40 ms marker and a separate 130 ms soft trail. Neither changes event labels,
timestamps or production behavior. Rapid-repeat tests inject six constructed
Hat references, bypassing the detector and production controller. Their report
separates known references, saved detector output, lab delivery, first-frame
IDs and brightness rises; controller acceptance is unavailable in this fixture.
Exports retain the sampled evidence independently of later playback. Insufficient
frame sampling produces an unavailable result, not a missed-hit count. Reduced
motion suppresses the sharp prototype flash. Brightness rises are a DOM/frame
proxy, not a human-perception or physical speaker-to-pixel measurement.

For the actual live baseline, stop lab playback, use Chrome or Edge with the
existing private Companion, and open [the exact source](http://127.0.0.1:5174/).
Select the matching passage, play it and click Companion's toolbar icon on that
source tab. Use the existing Private Grid consent and live-preview/calibrated
delay controls. The in-app browser can run offline listening but cannot load the
Companion extension. No provider permissions or synchronization guards change.

Open **Private live pipeline trace**, start a fresh app trace, keep the grid
visible, then export it. Import into the lab with the same passage selected.
Stable IDs join available stages; a source declaration binds timestamps but
does not prove captured PCM or physical alignment. App-only exports may lack
worker/Companion stages. Missing bounded log records never prove transport loss.
The generated-source verification script additionally collects offscreen logs;
it does not substitute for natural XO listening.

Per-hit exports include raw/proposed and strict matched predictions, errors,
frame observations and exactly one primary causal label per model/case, plus
optional secondary causes in the annotation contract. Confirmed non-UNKNOWN
causes require evidence citations. Uncertain cases stay UNKNOWN. Use explicit
late/drop records to investigate processing; do not infer a model miss merely
from an absent flash.

Focused verification commands are `node --test scripts/acoustic-visual-lab-core.test.mjs`,
`pnpm exec tsc --project scripts/tsconfig.acoustic-lab.json --noEmit`,
`node scripts/verify-acoustic-visual-lab.mjs`,
`node scripts/verify-acoustic-lab-api.mjs`, and
`node scripts/verify-acoustic-lab-live.mjs`. The last three require the server;
the live check also requires the existing private extension package. They use
isolated temporary browser profiles and generated controls, not a user session.
