# Final acoustic and visual diagnostic sprint

Decision: **D — INCONCLUSIVE for the user's XO experience; ready for human
listening review.** The private diagnostic workflow is delivered. No detector,
renderer or accuracy gate is promoted. The prior replacement NO-GO remains.

For the user's XO Tour Llif3 experience, the fractions due to missed instrument
recognition, incorrect processing/timing and perceptually merged flashes are
**unknown**. There are zero independently frozen XO reference events in this
sprint and no human-confirmed XO failure denominator. Reporting percentages
would manufacture evidence. Separate observed subsets establish that both
renderer fusion and live lateness are possible; they do not apportion XO errors.

## Delivery identity and evidence reuse

Branch: `codex/beat-grid-quality-recovery`. Frozen starting revision:
`36e723b8d2c4181fcc173c7dc2fe1d4b9408b77c`. The final delivery revision, exact
changed-file inventory, source hashes, verification log hashes and local process
receipt are bound in ignored
[final-revision.json](../../scratch/acoustic-visual-lab/final-revision.json).
This report is part of that commit; the receipt is written after committing to
avoid a self-referential revision hash.

The existing `scripts/reproduce-beat-v2-round.ps1 -VerifyOnly` passed before
reuse: 357 result records, 606 eligible scored views, 54 unscored listening
records, 208 provisional cases, 21 matched runtime fullmixes and 15 Python
contract tests. No expensive neural benchmark was repeated. Original checkpoint,
identity registry, corpus freeze, comparison, receipts, listening ledger and
runtime artifacts remain bound to the old final receipt. Preparation additionally
checks its 18 artifact hashes, 35 historical source-file identities, all 357
result hashes, canonical WAV/decoded PCM and exact unpadded source PCM hashes.
The owning documentation gained a link: its immutable Git blob is checked
against the old Windows checkout receipt, explicitly accounting for CRLF, while
the current documentation hash is recorded separately. Evaluation source remains
unchanged.

[Reuse receipt](../../scratch/acoustic-visual-lab/reuse-verification.json),
[original verify-only log](../../scratch/beat-grid-v2/diagnostic-reuse-verification.log),
[derived lab data](../../scratch/acoustic-visual-lab/lab-data.json).
Preparation executes zero neural models and applies zero manual time shifts.
There are exactly three comparison tracks:

| Track | Saved identity | Model SHA-256 |
| --- | --- | --- |
| A | Frozen BASE ADTOF, original accepted baseline | `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a` |
| B | C1 Frame-Level Drum CNN | `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db` |
| C | Corrected C2-separated OAF + HTDemucs | `4c58ebfc53e7ec92a47a570d3cf7c0838142e7e03b0a64da42d642387ae3fffa` |

The saved preprocessing/weight/pipeline identities, including separator contract,
remain in the old manifests and per-record evidence identities. B is not the
rejected ADTOF Candidate B. C's HH/Tambourine/Maracas output is grouped percussion;
it has no verified true-Hat score. Controls lacking saved C-separated inputs
remain N/A. These are reused offline predictions, not qualified live candidates.

## Listening lab and source clock

Open [the private lab](http://127.0.0.1:5173/lab/). Startup, stop, annotation and
live instructions are in the owning
[lab documentation](../../docs/private-acoustic-visual-lab.md). Its existing
Private Grid link remains available. The owned server uses fixed ports 5173/5174
and records PID/command/worktree in its process receipt. It stays available for
the requested later listening session; no extra listening server is needed.

The initial XO passage is 45.000–57.000 source seconds. One decoded float32
44.1 kHz audio buffer and AudioContext clock drive every candidate; candidate
switches change only prediction display. The browser verifies WAV and decoded
PCM hashes before playback. The real browser check kept audio generation 15
unchanged while A→B→C advanced source time from 45.000 to 46.012 seconds.
Out-of-order WAV responses, source changes during native resume and repeated
Play calls are tested. Obsolete async operations cannot start old audio.

| Passage | Source interval | Canonical source offset |
| --- | --- | --- |
| XO (`trap`) | 45–57 s | +44 s |
| Whiplash W1 | 8–20 s | +7 s |
| Whiplash W2 | 60–72 s | +59 s |
| Whiplash W3 | 95–107 s | +94 s |
| MONO | 0–13 s | −1 s |

Mapping is `sourceTime = canonicalSample / 44100 + sourceOffset`. Natural clips
retain one second of leading padding; their exact unpadded PCM identity is
verified. Separator output sample length matches canonical input. No model
timestamps were shifted to improve agreement. XO original-file SHA-256 is
`98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05`;
canonical WAV SHA-256 is
`f0eaaf4435ea767a2be5a47f209ee64e4f7223ba81a6d221c5594d9ccf3f18dc`.
All eleven source/PCM identities and mapping details are in the reuse receipt
and displayed in the lab. There is no evidence of a software mapping error in
these checks; physical speaker/display offset remains unmeasured.

Play/pause, source-relative seek, replay, bounded loops, waveform zoom, review
cursor, individual timestamp markers, distinct class lanes and the original
semantic grid are available. The grid shares upper-percussion rendering; the
separate lanes preserve Hat, Cymbal and grouped identities. Offline delivery
bypasses the production controller/transport and has its own explicitly labeled
late-callback records. Slow or suspended visual sampling warns the user instead
of converting missing frames into model misses.

## Human reference and per-hit report

The default human namespace is `listener`; it starts blind with no annotations.
Automated UI/API checks use separate namespaces. Reviews and timestamped history
are local, ignored files under `scratch/acoustic-visual-lab/annotations/` with
save/import/export controls and conflict-safe revision checks. The
[JSON schema](../../scripts/acoustic-annotation.schema.json) and
[runtime validator/matcher](../../scripts/acoustic-visual-lab-core.ts) retain
source identities, source onset, reviewer/version, instrument, confidence,
overlap, ambiguity, onset uncertainty and model-exposure provenance.

Preliminary reviews remain `provisional-human-reference`. Official metrics need
explicit freeze of a separately checked, complete subset, confident identity,
accurate blind timing and explicit ambiguous exclusions. Natural tolerance is
at most 50 ms, constructed controls 40 ms, tightened to gap/4 for neighboring
same-class attacks. Ambiguous intervals exclude references and predictions with
a 50 ms boundary guard. Matching is strict and one-to-one. Reveal/hide/reload
cannot erase exposure; post-disclosure deletion, coverage/window/exclusion or
acoustic edits keep selection provisional. Unchanged blind evidence retains
its provenance. Unmatched provisional predictions are not definite false
positives, and no thresholds were tuned to manual marks.

The per-hit table and JSON export are navigable by reference onset and include
A/B/C proposals, saved raw frames/classes, strict match/error where eligible,
renderer observations, trace/evidence citations and one primary cause per
model/case. Secondary causes are supported in the annotation contract. A
confirmed non-UNKNOWN cause requires cited evidence. ±150 ms nearby proposals
are navigation only; they never become relaxed official matches. Unsupported
stages or ambiguous attacks remain unavailable/UNKNOWN.

There is no invented per-hit XO acoustic table: the initial
[XO review status](../../scratch/acoustic-visual-lab/xo-review-status.json)
contains zero reviewed events and no official metrics. Once the user marks
events, the UI produces their per-hit comparison. Existing provisional Whiplash
annotations were neither used for official scores nor promoted into this lab.

Consequently, which model recognizes the most verified XO Snares or Hats,
creates the most false Hats, or would improve the user's listening result is
unresolved. Raw event count cannot select a winner. Correct acoustic events
suppressed downstream and accepted XO events without distinct perceived attacks
also remain uncounted until the reference and live source are joined.

## Rapid-Hat visual diagnosis

The unchanged prior renderer evidence already established envelope overlap.
The new isolated browser check repeated six constructed Hat references at each
spacing using the actual semantic grid. Every non-reduced-motion case delivered
six stable event IDs and observed six corresponding frame IDs. Their illumination
did not necessarily reset below the attack threshold before the next event.

| Spacing ms | Known hits | Saved A Hat events in segment | Lab delivered | Production controller accepted | Original brightness attacks | Private short attacks |
| --- | --- | --- | --- | --- | --- | --- |
| 20 | 6 | 1 | 6 | unavailable | 1 | 1 |
| 30 | 6 | 1 | 6 | unavailable | 1 | 1 |
| 50 | 6 | 3 | 6 | unavailable | 2 | 6 |
| 80 | 6 | 6 | 6 | unavailable | 1 | 6 |
| 125 | 6 | 6 | 6 | unavailable | 4 | 6 |
| 200 | 6 | 6 | 6 | unavailable | 6 | 6 |

These are the final observed run's frame proxies, not human-perceived counts.
Frame maximum gaps were 9–11.1 ms for these cases (roughly 120 Hz sampling), not
a 60 Hz qualification. Counts near envelope boundaries vary with phase/cell
overlap; earlier runs are not substituted to obtain a preferred result. The
fixture bypasses detection and the production controller; it never labels six
injected events as six accepted production events. Saved detector output is a
separate stage count, not new inference or a runtime recognition score.

The existing approximately 150 ms illumination can continue across multiple
retriggers. Observing six DOM IDs therefore does not establish six distinct
attacks. One isolated private alternative uses the existing 40 ms sharp Hat
marker plus an independent 130 ms low-opacity trail, with the trail excluded
from the cell-brightness proxy. It improves the measured separation at 50–125 ms
in this fixture, without recovering absent detector events. At 20–30 ms, both
remain merged. Timeline markers preserve event identity at densities a display
cannot resolve. This prototype is selectable beside the original and never
changes labels/timestamps or normal runtime.

Reduced-motion checks are separate: original brightness counts were
1/1/2/1/3/3 and the short prototype produced zero bright attacks/IDs because its
static opacity stays below the attack threshold. This is expected suppression,
not a detector or frame failure. Physical visibility and human perceptibility
remain unverified. No renderer change is promoted before independent audible
alignment review. [All 24 cases and browser checks](../../scratch/acoustic-visual-lab/ui-verification.json),
[live grid screenshot](../../scratch/acoustic-visual-lab/live-baseline-trace.png).

## Actual live baseline trace and supported causal counts

The separate generated-audio check used actual Chrome 155 tab capture, private
Companion 0.3.24, the existing AudioWorklet/ADTOF path, engine, scheduler,
controller and renderer. It verified the allowlisted CC0 Hat-only canonical
WAV, enabled the existing zero-intentional-delay experimental-live route, and
joined app/offscreen records by stable IDs. It did not use copyrighted music or
claim that an automated consent flag meant a human heard output. Source clock
advanced from 3.789 to 8.848 seconds during the recorded run.

| Observed stage | Unique onset IDs |
| --- | --- |
| Worker/offscreen detected (wider bounded window) | 20 |
| Transmitted, received, scheduled | 10 at each stage |
| Controller accepted/state committed, DOM committed/rendered | 10 at each stage |
| First ≥0.5-opacity in-viewport semantic frame | 10 |
| Explicit late records | 10 |
| Explicit drops | 0 |

The ten complete observed chains have primary explicit finding SCHEDULER_LATE.
The other ten detected IDs have UNKNOWN classification because realm logs cover
different windows. They are not ten transport losses. No explicit controller
suppression/drop is observed in this interval; this does not prove a global
absence of suppression. First frames are computed-opacity observations, not
ten distinguishable perceived attacks or physical alignment. The source title
binds the expected canonical file, not a byte hash of captured live PCM.

The app export exposes available stages and limitations. The automated check
also preserves offscreen stages; user app exports may lack those realms. Missing
bounded records never justify loss claims. This test establishes an actionable
live timing signal on generated audio, not the fraction of XO errors due to
timing. [Live evidence and per-ID stages](../../scratch/acoustic-visual-lab/live-verification.json).

## Regression, review and handoff

Final validation results and exact logs are bound in the final receipt. Focused
annotation tests (11/11), private typecheck/lint, browser playback/race and 24 renderer
cases, API provenance/concurrency/range checks and the real generated-source
Companion route passed. App regression passed 912/912 tests in 116 files;
research Node tests passed 33/33. Both typechecks, production build and bundle
budget passed (718.8 KiB main entry against 976.6 KiB). Lint had zero errors and
27 existing app/vendor warnings; focused private lint had zero warnings. Existing
large-chunk/plugin-timing build warnings remain. Normal packaging checks pass
for both 46-file Companion archives with private mode off and no lab/candidate
checkpoint additions. Independent read-only review found and verified fixes
for denominator exposure, stale audio continuation, strict-match display and
annotation save races. No remaining material blocker was reported.

Production baseline weights/parameters, detector selection, qualification,
provider/permission policy, scheduler/controller/filter behavior and synchronization
guards are unchanged. Normal Companion packages retain the private flag off and
exclude this lab/candidate checkpoints. No deployment, training, model search or
full benchmark rerun occurred. Local audio, checkpoints, annotations and receipts
remain excluded from Git. Sandbox access failures and an initial automation
click inside a collapsed panel were retained as check failures and corrected;
they are not evidence of a product detection error.

The next task is concrete: listen to XO 45–57 with predictions hidden; use
zoom/replay to mark audible Snares and Hats, retaining uncertainty and overlap;
save/export before revealing models. Freeze only if separately checked timing
and coverage warrant it. Then inspect A/B/C against those events and capture a
matching actual-baseline trace. Extend selected findings to Whiplash/MONO after
XO. Incomplete marks remain useful investigation evidence without accuracy
metrics. Physical synchronization, a complete XO reference and subjective
flash distinction remain open measurements. The sprint's implementation and
automated work are complete when the final receipt passes; causal attribution
remains D pending this human review.
