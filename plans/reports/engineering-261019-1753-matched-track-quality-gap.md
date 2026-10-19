# Matched-track offline/live quality gap: Private Landing

Date: 2026-10-19, Asia/Saigon. Branch: `codex/beat-grid-quality-recovery`.
Starting implementation: `774982a6541c120c0945e1c10f4bd029d8e81bd1`.
Private L1 implementation: `44381b228b1506602b239134f9ebaa3402adf1d6`.

## Decision and user finding

**NO-GO for L1 default promotion, an accuracy-gate pass, or physical ±50 ms
qualification.** The strongest supported explanation is a large difference in
Hat proposals before transport, together with roughly 200 ms live detection and
presentation delay. Runtime stalls can additionally discard predictions. Their
contribution to the user's historical YouTube session cannot be quantified.

The user confirmed the Downloads recording and requested a start at **20 s**:
“the hihat, missing and delay. Sometime it not flash. Unlike the offline one.”
This is `provisional-human-reference`, with unknown onset uncertainty and
incomplete coverage. The engineering window is **[20,50)**; the user did not
supply an end. No song Precision, Recall, F1, verified false-positive count, or
percentage attribution to causes is reported. Dense CNN proposals alone do not
prove acoustic correctness.

**GO only for considering a bounded low-lookahead true-Hat design and a separate
runtime-deadline investigation. Both are proposals awaiting architecture
approval.** This delivery changes diagnostic scripts and records only. Frozen
H0, models, features, thresholds, Bass/Lead, normal detector, controller,
scheduler, renderer, pulse duration and provider contracts remain unchanged.
No training, new detector, deployment or provider audio download ran.

## P1: exact identity and reuse

The user-confirmed original in Downloads is
`Don Toliver - Private Landing (feat. Justin Bieber & Future) [Official Audio].mp3`.
Its exact local path is retained in the private identity manifest.
The retained source and independently decoded Downloads copy match:

| Binding | Exact value |
| --- | --- |
| Original file SHA / Lab source ID | `df2173a39346b36c188e086d4d5c301c5356832267c048e3e2d39917042da108` |
| Canonical WAV SHA | `58fd879b4beb4312916607e72a61c4340d488c0ad8d6610a939ad4fd42b384a8` |
| Decoded stereo float32 PCM SHA | `1067017ef20f09e0f938b4360114d63225b03a01f41440ec6d72e117704e6010` |
| Format / duration | 44,100 Hz, stereo, 10,516,480 frames; 238.4689342403628 s |
| H0 routing | `H0-frozen-routing-diagnostic-v1` |
| H0 bound EventTrack cache key | `9055ea8f017f55d8b8260e1d10f8aeea50fe0874158b74b2c23e1eac49e0b38b` |
| H0 routing algorithm SHA | `f9e051c2d6dbfbacd76beb7cc17ff88dac9aaf4fb9588d334b0f1e28196a20b0` |
| ADTOF model | `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a` |
| Frame CNN model | `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db` |
| Frozen frontend / classifier | `0abd2a532ab585509fab0e93cf174ec763bee6b0b317550175bcf9a3c8355317` / `c84142ba2a4c202211a6182d00cc3eadf192ff5ecbf10f5675b0a64c0ac733b0` |
| A / B saved cache keys | `61c86f1fae38af97fffdad6350f5122bf73fc93f5bd6637170f1bb113db23f26` / `9f55c76e52e225b9440866054e2164cf30249f14110c7fb92c8625566a886a67` |

No Lab resampling, trimming, padding or guessed codec-delay correction occurred.
Source zero is the first sample returned by libsndfile; its own decoder handles
codec padding. Complete dependency/code/result/raw hashes are in
[source-identity.json](../../scratch/matched-track-quality-gap/source-identity.json).
Cache validity, record copies, raw hashes and event digests were checked before
reuse. H0's fields match the existing canonical router. Original A/B/raw/WAV
hashes and an independent Downloads PCM decode were checked again afterward:
[source-postcheck.json](../../scratch/matched-track-quality-gap/source-postcheck.json).
Slot names are not identity: the current `hskt` slot contains this upload.

P2 reused saved activations and events; **no neural baseline inference reran**.
L1 is an earlier-finalization variant of the same ADTOF, not a new model or an
inference-format novelty. The existing MDB development/locked-holdout results,
synthetic controls and model/license restrictions remain as documented in
[the private L1 report](engineering-261019-1717-early-percussion-decisions.md)
and [D1](engineering-261019-1101-low-latency-semantic.md). Published-label
omissions and unknown checkpoint/training overlap remain limitations. Those
historical results were not rerun or repurposed as this song's accuracy.

ADTOF raw coverage ends at 238.35 s; [238.35,238.468934...) is explicitly
unavailable, without padded inference. CNN covers the full source. The selected
passage is fully covered by both.

## P2: proposal differences before transport

L0 and L1 produce **identical classes and predicted onset timestamps** for this
entire saved ADTOF stream. Earlier finalization does not recover its Hat sequences.
H0 retains ADTOF Kick/Snare and routes true Hat from CNN, excluding A Cymbal.
Live displays A Hat and A Cymbal on the same visual row, so both views matter.

| Interval / mode | Kick | Snare | True Hat | Cymbal | Hat-row total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full saved L0 or L1 | 232 | 124 | 81 | 13 | 94 |
| Full H0 | 232 | 124 | 829 | 0 | 829 |
| 20–50 s L0 or L1 | 30 | 17 | 6 | 9 | 15 |
| 20–50 s H0 | 30 | 17 | 105 | 0 | 105 |

All Tom counts are zero. Full-song counts describe available predictions, with
the explicit ADTOF EOF gap above. Stable IDs, every timestamp, provenance,
per-class spacing, overlaps and pair associations are retained in
[offline-events.json](../../scratch/matched-track-quality-gap/offline-events.json).
L1 IDs retain their original prediction IDs. H0 preserves original A/B IDs.

| True-Hat sequence | Mean spacing | Median spacing | Events with a ≤125 ms same-class neighbor |
| --- | ---: | ---: | ---: |
| Full ADTOF | 2770.00 ms | 660.00 ms | 0 |
| Full CNN/H0 | 270.55 ms | 220.60 ms | 91 |
| 20–50 s ADTOF | 4948.00 ms | 4170.00 ms | 0 |
| 20–50 s CNN/H0 | 277.75 ms | 220.60 ms | 17 |

Matching is directed, maximum-cardinality/minimum-error, one-to-one, with a
50 ms cap and quarter-nearest-left-event spacing. It is an event association,
not an acoustic score. Onsets are never shifted to obtain these matches.

| L1 → H0 association | Shared | L1-only | H0-only | Matched absolute timing difference p95 |
| --- | ---: | ---: | ---: | ---: |
| Full true instrument Hat | 75 | 6 | 754 | 18.65 ms |
| Full visual Hat row, including A Cymbal | 85 | 9 | 744 | 18.90 ms |
| 20–50 s true instrument Hat | 6 | 0 | 99 | 11.13 ms |
| 20–50 s visual Hat row, including A Cymbal | 13 | 2 | 92 | 14.62 ms |

The **94-entry visual review queue** contains the two L1-only and 92 H0-only
proposals in the passage. Each retains original instrument/ID, a ±350 ms bounded
review interval, `ambiguous: true`, confidence `unverified`, and null onset
uncertainty. Instrument-only associations remain separately available. The
initial instrument-only queue is preserved as
`offline-events-instrument-only.json`; review corrected the visual-row omission
without changing any track, threshold or neural result.

Five of the nine A Cymbal proposals are within 50 ms of A Snare; five of six A
true Hats overlap another predicted class within 20 ms. H0 has 39 such Hat
overlaps in this passage. These identify review priorities, not proof that
Snare/vocals caused false Hats. Snare, cymbal and Hat may genuinely coincide.
No independently complete labels distinguish these cases yet.

**A substantial output difference is proven before IPC or rendering.** The
user's preference is consistent with CNN's denser sequence, including rapid
proposals. Which unmatched proposals are audible true Hats remains an acoustic
review question. Fewer L1 flashes cannot all be explained by latency or losses
of already-produced events.

## P3: real Companion, conditional numerical parity

Four controlled foreground runs used isolated Chrome 155 with the real private
0.3.25 Companion, production worklet/frontend/worker/ORT, bridge, controller and
normal product grid. L0/L1 active runtime capability was asserted independently
of the selector. The exact hash-checked canonical WAV played at 1× through an
HTML audio fixture on the existing Lab origin. **Only source acquisition was
substituted**; no test detector replaced production code. Each live window was
55 seconds after activation. These are bounded trials, not full-song stability
or an automated YouTube reproduction.

Two diagnostic runs used an isolated package copy: enable existing raw
diagnostics, observe input PCM for the first three seconds, and forward that
observation alongside existing feature messages. Exactly three files changed;
44 other packaged files, including weights, numerical frontend and classifier,
were byte-identical. Exact instrumentation delta:
[diagnostic-extension.json](../../scratch/matched-track-quality-gap/diagnostic-extension.json).
Capture-owner fencing rejects replacement streams; neither accepted parity
run contained one. Diagnostic serialization can disturb timing. This copy was
never installed into the user's Brave or used on provider content.

| Controlled diagnostic evidence | L0 | L1 |
| --- | ---: | ---: |
| Captured initial PCM quanta | 1033 | 1033 |
| Exact production-JS feature frames / values | 295 / 24,780 | 295 / 24,780 |
| Feature replay difference on those exact PCM quanta/times | 0 | 0 |
| CPU ONNX vs actual WASM matched output frames | 5965 | 5880 |
| Unobserved final CPU output frames | 5 | 0 |
| Maximum activation difference | 6.2585e-7 | 6.2585e-7 |
| p95 activation difference | 8.9407e-8 | 8.9407e-8 |
| CPU replay vs actual class/time event identities | 136 = 136 | 125 = 125 |

Both finalizers replayed on each single captured activation stream also retain
identical event proposals: 136/136 and 125/125, with no added/removed events.
Numerical replay uses the actual 100-frame feature window, startup zero padding,
five-frame cadence and output positions 85:90. The five L0 final frames were not
observed at the asynchronous collection boundary; full boundary parity is not
claimed. New inference here answers CPU/WASM parity on captured features; it is
not a repeated model-quality benchmark.

Crucially, browser-captured PCM is **not bit-identical** to canonical PCM.
Initial one-second mono source correlation is 0.999365/0.999251; fitted integer
origins are samples 24,689/102,995. Across the bounded three seconds, fitted
gain is about 0.980/0.985 and relative residual RMS about 0.196/0.168. A clipping
ablation did not explain the residual; no particular browser DSP cause is
asserted. Capture phase/source input is the earliest observed difference from
the canonical run. Numerical equivalence is established **conditional on the
same captured input**, not across unequal canonical/captured PCM.

Independent production-feature source association at 20/30/40/49 s used 750 ms
descriptors, ±1 s search and a 10 ms canonical lattice. Best alignment residuals
were +0.159 ms for L0 and +4.512 ms for L1, with correlations 0.9993–0.9997 and
0.9307–0.9586 respectively. This locates the passage within one feature hop;
it is not sample-exact equivalence, physical clock calibration or a correction
to published event times. Mono averaging, FFT centering, feature framing,
100-frame buffers, model cadence and finalizers were reused, rather than tuned.

Evidence lives in `live-L0-bounded/` and `live-L1-bounded/` under private scratch:
`controlled-diagnostics.json`, `frontend-parity.json`, `controlled-parity.json`;
source association is in
[source-feature-alignment.json](../../scratch/matched-track-quality-gap/source-feature-alignment.json).
Each prediction retains audio/source time, stable trace ID, detector timing,
available stage records and null independent acoustic reference.

## P4: event accounting and delays

The following diagnostic counts select source-aligned predictions in [20,50).
Hat row combines Hat/Cymbal; Snare uses the original Snare class, even when its
transport band is named clap. No independent acoustic-onset column can be filled.

| Diagnostic run / class | Predicted | Emitted | App received | Accepted | DOM committed | Animation callback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| L0 Kick | 30 | 30 | 30 | 30 | 30 | 29 |
| L0 Snare | 18 | 18 | 18 | 18 | 18 | 18 |
| L0 Hat row: 6 Hat + 8 Cymbal | 14 | 14 | 14 | 14 | 14 | 14 |
| L1 Kick | 30 | 30 | 30 | 28 | 28 | 27 |
| L1 Snare | 17 | 17 | 17 | 17 | 17 | 17 |
| L1 Hat row: 10 Hat + 6 Cymbal | 16 | 16 | 16 | 15 | 15 | 15 |

L1's three rejected events (two Kick, one true Hat) are explicitly
`schedule-late`. Their transport stalled roughly 427–475 ms after offscreen
emission while inference took about 20–30 ms. Raw observer export may perturb
this path. Missing Kick animation callbacks after a commit do not establish
missing visible pixels. These diagnostic losses are real in those trials but
are not assigned to the user's normal YouTube session.

Unmodified-package controls then removed raw PCM/features/activation export.
Their passage selection is **published playback target [20,50)**, rather than
the analytical PCM-origin selection above. These populations must not be
silently joined. Raw pre-app predictions are not fully exposed in clean mode.

| Clean run / class | App received | Accepted | DOM committed | First animation |
| --- | ---: | ---: | ---: | ---: |
| L1 Kick | 30 | 30 | 30 | 30 |
| L1 Snare | 18 | 18 | 18 | 18 |
| L1 Hat row | 14 | 14 | 14 | 14 |
| L1 independent Bass | 79 | 79 | 79 | 79 |
| L0 Kick | 27 | 27 | 27 | 26 |
| L0 Snare | 13 | 13 | 13 | 13 |
| L0 Hat row | 15 | 15 | 15 | 15 |
| L0 independent Bass | 74 | 74 | 74 | 74 |

Clean L1 had no explicit app delivery loss and one startup background-clock
drop over the entire run. IPC offscreen→background p95 was 1 ms and
background→app 7 ms. Hat-row sparsity and delay persisted despite successful
delivery in the selected passage.

Clean L0 exposed a separate **deadline/backlog failure**: 222 of 1111 inference
batches exceeded the 50 ms cadence, inference p95 77 ms/max 85 ms, and worklet
post→worker receipt p95 4908 ms/max 5589 ms. Fifteen events were explicitly
discarded `capture-engine:late`, before normal app receipt. Worker receipt→
inference start stayed ≤1 ms; the reported JS queue maximum was nevertheless
zero. That queue counter excludes waiting before receipt, including forwarding
and the worker inbox. It cannot certify the whole pipeline is backlog-free.
The precise unmeasured waiting substage is not isolated. System load was not
matched across independent trials, so this is **not evidence that changing L0
to L1 speeds up identical model weights**. Clean L1 had only one of 1187
batches above 50 ms, inference p95 30 ms, post→receipt p95 1 ms/max 2 ms.

### Same saved H0 events through the actual product

The existing Lab bypasses the production controller and uses its own transient
presentation. Therefore the exact H0 EventTrack was replayed through Kora's
existing Beta engine, scheduler, controller and semantic grid, with both
existing Short Attack and Original envelopes. No event or pulse was changed.

| Product H0 envelope, 20–50 s | Kick predicted/accepted/committed/frame-observed | Snare | Hat |
| --- | --- | --- | --- |
| Short Attack | 30 / 30 / 30 / 30 | 17 / 17 / 17 / 17 | 105 / 105 / 105 / 105 |
| Original | 30 / 30 / 30 / 30 | 17 / 17 / 17 / 17 | 105 / 105 / 105 / 105 |

The element-bound observer sampled 3864/3876 frames. “Frame-observed” means
the semantic trace-bearing DOM element was inside the viewport with opacity
≥0.5. This proxy does **not** establish physical display onset or that a human
distinguished every flash. Hat animation callbacks counted 104/103 despite all
105 having frame observations. Callback absence alone is insufficient evidence
of visual loss. Local H0 has no Companion IPC; sent/received transport stages
are **not applicable**, rather than lost. Seek-reset generations are kept in
raw telemetry; accounting selects the latest accepted trace for each original
EventTrack ID, without confusing older reset drops with later playback loss.

Natural H0 Hat pairs within ±5 ms of the requested spacing bins:

| Nominal spacing | Pairs | Both committed and frame-observed, each envelope | Both animation callbacks: Short / Original | Perceptually separate |
| --- | ---: | ---: | --- | --- |
| 20 ms | 3 | 3 | 2 / 1 | Unverified |
| 30 ms | 3 | 3 | 2 / 3 | Unverified |
| 50 ms | 0 | Unavailable | Unavailable | Unknown |
| 80 ms | 0 | Unavailable | Unavailable | Unknown |
| 125 ms | 0 | Unavailable | Unavailable | Unknown |
| 200 ms | 4 | 4 | 4 / 4 | Unverified |

Those absent bins cannot establish product visibility or fusion behavior.
Earlier constructed worker/isolated-renderer spacing controls are reused with
their original scope in D1; they do not replace actual-controller measurements.
ADTOF's saved passage has no rapid true-Hat pair ≤125 ms to deliver in the first
place. Renderer fusion remains plausible for dense events, but is not the
dominant demonstrated source of this gap. No renderer experiment is justified
as the first corrective action.

### Timing: predicted mapped target to first semantic animation

| Route / interval | Hat callbacks n | Median | p95 | Worst |
| --- | ---: | ---: | ---: | ---: |
| Product H0 Short Attack, 20–50 s | 104 | 27.94 ms | 40.83 ms | 63.16 ms |
| Product H0 Original, 20–50 s | 103 | 24.28 ms | 35.50 ms | 56.47 ms |
| Clean L1 normal grid, 20–50 s | 14 | 182.28 ms | 224.24 ms | 224.24 ms |
| Clean L0 normal grid, 20–50 s | 15 | 200.93 ms | 309.65 ms | 309.65 ms |
| Clean L1 normal grid, whole bounded run | 26 | 183.59 ms | 211.08 ms | 224.24 ms |

Small passage samples use the existing ceil-index p95 convention; with n=14/15,
p95 equals the maximum. L0 timing is conditional on surviving its backlog
episode. These are different prediction populations, not per-acoustic-hit paired
latencies. Use the earliest renderer callback per stable ID: normal-grid raw
compact summaries can retain a later decorative/cell callback for that ID and
overstate first-flash delay. Raw summaries are preserved, not overwritten as
detector latency. Quantiles from different stages cannot be added.

The reused graph/input dependency is decisive independently of IPC: L1 still
requires **153.22–193.22 ms of future input** after predicted onset before
compute/presentation, versus L0 173.22–213.22 ms. Its isolated finalization
horizon falls from 50 to 30 ms; five-frame cadence gives individual release
savings of 0 or 50 ms, not guaranteed 20 ms. H0 already has future-computed
events and can schedule ahead. The existing output estimate, typically 50 ms,
is separate and is not speaker calibration. No onset offsets or audio delays
were applied. **Physical speaker/pixel synchronization remains unverified**
for every route, including H0 with software p95 below 50 ms.

Derived counts and per-ID records:
[event-accounting.json](../../scratch/matched-track-quality-gap/event-accounting.json).
Original controlled/product traces, stage clocks and unavailable fields are
retained alongside it; missing stage observations never become zero latency.

## P5: actual Brave state and listening handoff

The user's Brave Kora tab was inspected. It showed an unrelated paused YouTube
gaming source and an L0 selector, with no active semantic capture at that time.
This neither verifies nor contradicts the historical L1 session. A later fresh
DOM read timed out. The installed Brave extension version and active historical
L1 capability could not be independently certified. The isolated controlled
0.3.25 runs above did verify their actual active L0/L1 capability.

No provider audio was downloaded, persisted or programmatically analyzed in
this investigation. Exact YouTube edit/codec/loudness/PCM, source alignment,
audible output and physical playback clock remain unknown. Existing Spotify
private-analysis and protected Apple Music blocks remain. User hearing and
rights were not asserted on their behalf; controlled fixture consent automation
was restricted to the already-authorized local recording and its receipts state
`humanOutputHeard: false`.

The existing Brave Full-Song Lab now has the SHA-bound recording selected,
H + Short Attack, loop 20–30 s, **paused at 20.000 s**. No user playback or
provider selection was changed. Screenshot:
[brave-review-ready.png](../../scratch/matched-track-quality-gap/brave-review-ready.png).
The requested short
[Vietnamese listening guide](../261019-1753-matched-track-quality-gap/listening-guide-vi.md)
contains the actual-browser checklist, same-passage A/H/product comparison,
runtime verification, source/seek reset handling and L0 rollback. Conversation
and this engineering report remain English. The user's feedback is retained in
[user-listening.json](../../scratch/matched-track-quality-gap/user-listening.json).
A new successfully observed YouTube L1 listening trial is still open.

## D3: attribution and next architecture decision

| Hypothesis | Finding and confidence | Remaining limit |
| --- | --- | --- |
| A: CNN vs ADTOF Hat detector | **Strong output-level evidence.** 105 H0 versus 15 L1 visual-row proposals in 20–50 s; exact same-PCM L0/L1 proposals. A major source of fewer flashes exists before delivery. | No complete verified Hat labels; density is not correctness. No percentage of perceived error can be assigned. |
| B: ADTOF structural latency | **Strong.** Future-input dependency persists and clean L1 first-animation median is 182 ms in the passage. | Physical speaker/pixel and independent acoustic-onset error are unmeasured. |
| C: offline/live numerical mismatch | **No evidence of a numerical implementation bug on equal captured inputs.** Exact feature replay and near-float-roundoff CPU/WASM activations preserve event identities. | Capture input/phase is unequal to canonical PCM; final five L0 frames unavailable. Provider input unknown. |
| D: transport/controller loss | **Confirmed secondary failure modes.** Three schedule-late diagnostic rejections; clean L0 stale-input drops and queue-counter blind spot. Clean L1 delivered all 14 passage Hat-row events. | Diagnostic observer cost and uncontrolled load prevent attribution to the historical user session or a specific unmeasured forwarding substage. |
| E: visual fusion | **Not established as dominant.** Actual product commits and frame-observes all 105 H0 Hats with both existing envelopes. Some callbacks absent despite frames. | Perceptual separation and 50/80/125 ms natural product bins unresolved. |
| F: provider PCM/clock | **Unresolved.** Musical identity confirmed by user; canonical identity controlled locally. Even local capture PCM is not bit-exact. | Exact YouTube PCM/runtime/session was not captured or independently aligned. |

The smallest justified next decision is **one bounded causal/low-lookahead
true-Hat research path**, informed by the offline CNN's useful sequence, plus
separate runtime deadline observability. Approval must precede implementation:

1. Keep H0 as the frozen offline quality reference and L0 as live rollback.
   Do not port centered CNN features, whole-track maximum normalization or its
   noncausal context unchanged and call it streaming. Inventory model hashes,
   weights, preprocessing and past pipelines before any new candidate experiment;
   reuse duplicates and valid earlier evidence.
2. Specify a causal or explicitly bounded-lookahead Hat head, continuous-state
   streaming features/normalization, stable source timestamps, and independent
   true-Hat versus cymbal/snare/vocal negatives. An initial **proposal**, not
   an accepted budget, is ≤10 ms future lookahead, ≤10 ms feature hop and ≤10 ms
   model compute p95 on this target machine. Budget the whole audio-to-pixel
   path before claiming ±50 ms. Improving Hat alone leaves ADTOF Kick/Snare's
   structural latency unresolved.
3. Before training, select rights-cleared, instrument-complete data with accurate
   onset labels, documented checkpoint/data licenses and recording-disjoint
   train/development/locked holdout splits. User songs and provisional labels
   are review cases, not threshold targets or training labels. Create a separately
   verified subset with complete coverage and sufficiently accurate onset times
   before official evaluation; keep ambiguous intervals explicit.
4. Freeze recognition and rapid-sequence noninferiority criteria on the verified
   development subset before holdout. Include weak/rapid Hats, overlapping
   Snare/Cymbal and vocals. Report the uncertainty/coverage alongside any official
   scores. Existing MDB results remain a historical comparison, with their
   known omissions/overlap caveats; they cannot substitute for the new gate.
5. Proposed resource admission caps for the **additional Hat component** are
   ≤20% of one logical CPU core averaged over active playback, ≤100 MiB
   incremental resident memory, and zero sustained backlog over a 30-minute
   target-device run. These are proposed caps, not measured feasibility or
   permission to train. Test foreground/background, CPU contention, seeks,
   source replacement and finite EOF with the real pipeline. Total app resource
   budgets and physical timing still need separate qualification.
6. Independently scope worklet-post/forward/worker-receipt age, stale-input policy
   and deadline accounting before changing delivery behavior. The JS queue alone
   is insufficient. Fix only a stage demonstrated responsible by such evidence;
   do not change weights/thresholds to mask stale transport.

**Stop at D3 for architecture approval.** No new model, streaming CNN, renderer
experiment, public integration or threshold change is started by this report.
Provider contracts, private model notices and deployment restrictions remain in
force. No license qualification was expanded.

## Verification, failures and reproducibility

Fresh focused checks: three matched-event Python tests plus five existing
scoring tests; 22 Node tests spanning event/deadline accounting, replay, input
floor, delivery, full-song core/H0 routing and resource summaries. Syntax/AST and
diff checks cover all changed diagnostic scripts. The earlier full application
suite/type/lint/build receipts remain historical evidence at the starting HEAD;
they are not represented as newly rerun. No production module changed.
Final independent read-only review found no material defect in the corrected
row matching, stage accounting, timing scope, provenance or listening guide.

Failures were retained rather than relabeled as passes:

- Initial 1420 catalog was stale and rejected the new source; existing Lab 5173
  resolved it. Only this investigation's private 1420 server was later restarted.
- Sandbox denied an initial loopback connection; the same authorized local check
  succeeded with escalation. No automatic approval rejection occurred.
- First cross-origin audio fixture failed to load; a large fulfilled-WAV retry
  stalled. The accepted source fixture uses the Lab's same-origin audio endpoint.
  Exact reason for the large fulfillment hang remains unknown.
- Full PCM observer export caused clock/preview replacement failures; those runs
  are excluded from parity and preserved. Bounded three-second PCM observation
  and capture-owner fencing produced the accepted diagnostic evidence.
- An H0 helper first addressed a Play control on the wrong tab. Early global DOM
  probes collected zero frames and are explicitly partial. An element-bound
  observer then produced positive, validated product observations. Those helper
  failures are not evidence of product missing Hats.
- Initial review matching omitted Cymbal from the visual row. Separate instrument
  and row views plus a focused test corrected the review queue; all tracks match
  the preserved original exactly. A console-summary attempt then hit a Unicode
  key encoding error; the derived comparison itself was already preserved and
  verified, and the compact summary was rerun without the shell-sensitive key.
- The clean L0 overload episode is retained as a runtime finding, not excluded
  to claim universal healthy performance. Fresh user-Brave Kora inspection later
  timed out; no historical provider state was inferred from it.
- Python discovery on hyphenated test filenames ran zero tests, and one guessed
  legacy test path did not exist. Direct execution of the actual test files
  subsequently ran all eight Python tests successfully.

Reproduction scripts are task-scoped diagnostics, with exact commands, source
bindings and artifact/script SHA receipts in
[reproduction.json](../../scratch/matched-track-quality-gap/reproduction.json).
Use a new output directory for source comparison; preserve original artifacts.
Do not replay raw capture diagnostics on provider tabs. Timing runs were kept
separate from builds/tests and watched source edits.

Only the owned private server remains from this investigation: PID 30668,
`node scripts/serve-hybrid-beta.mjs`, port 1420, this worktree; ownership receipt
is `scratch/hybrid-beta/server-process.json`. Existing Lab PID 27544 owns
5173/5174 and was not stopped. Isolated browser contexts were closed. One hung
owned test browser required force termination after normal termination failed;
the user's Brave was not terminated.

Open evidence: independent acoustic correctness of the 94 disagreement review
items; exact historical/new YouTube L1 runtime and PCM; long-session device-load
causality; physical synchronization; human separation of rapid flashes; and
feasibility/qualification of the proposed causal Hat budget. None is a passed
accuracy or architecture gate.
