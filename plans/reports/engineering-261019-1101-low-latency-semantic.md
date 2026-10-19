# Live semantic latency: D1 baseline and architecture checkpoint

Date: 2026-10-19, Asia/Saigon. Branch: `codex/beat-grid-quality-recovery`.
Measured production baseline: `ddc4d2be015a6e18412a7cc9befcdb43a2862654`.
Scope: D1 complete; D2–D4 await the required architecture review.

## Decision

**NO-GO for claiming the frozen live detector meets physical ±50 ms.**
The current isolated-peak decision needs 173.22–213.22 ms of input after its
predicted onset before inference, transport or presentation. Clock mapping
means this input age is not itself a measured speaker-to-pixel error. No
candidate improvement or new accuracy qualification is claimed.

The brief explicitly requires: “Stop for architecture review if the required
improvement demands changing model semantics.” Earlier grouping/finalization
changes which peaks win and is a new L1 postprocessing variant. Reducing model
context or shifting output positions changes activations and requires separate
L2 recognition evidence. Neither variant has been run or integrated here.

Recommendation: approve one bounded L1 saved-activation comparison first,
without changing weights, frontend or thresholds. Treat it as a possible small
improvement, not a route already shown capable of the physical target. Reject
it if natural recognition, rapid-hit preservation or semantic integrity regress.

## Reproducible evidence and frozen identity

Private, local evidence is in `scratch/low-latency-semantic/`:

- `baseline-freeze.json`: source, config, package, code and previous receipt hashes.
- `baseline-summary.json` and each trial directory: raw trace, source clocks,
  timing records, lifecycle samples and software delivery summary.
- `model-graph.json`, `structural-floor.json`: actual graph audit, constructed
  activation dependency checks, saved-stream replay and per-ID clock joins.
- `synthetic-inputs.json`, `rapid-runtime.json`, `rapid-summary.json`: exact
  constructed sample references, complete runtime activations/events and scores.
- `h0-cache-attestation/applied.json`: accepted compatibility, original status
  backups and unchanged model-result/raw hashes.
- `h0-web-check.log`, `parity-tests.log`: fresh preservation checks.

Frozen ADTOF weights:
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
Frozen CNN weights:
`785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`.
Offline routing: `H0-frozen-routing-diagnostic-v1`.
Private Companion 0.3.24 package SHA-256:
`8c3b5c85859197a293f3cfbb3e9746e1caa69f8ac63c9b156c826349363938d9`.
The package runtime, worker, frontend, classifier, model, capture and timing
bytes were compared with source; the private enablement flag is intentional.

Source ID:
`0bcf5f5fece49bf67804c8dbdd17099dc971a0f4295070041b31122155c941ff`.
Canonical WAV SHA-256:
`0f512f74f20bec0a3a00e1d91f781852fbb3e132a68a1326e681b1f41343c517`.
This is the existing authorized deterministic 180-second CC0 recording.

Environment: Windows 10.0.26300 x64; AMD Ryzen 7 8845H / Radeon 780M;
16 logical CPUs; 29,860,155,392 bytes total RAM; 13,763,194,880 bytes free at
freeze; Node 26.8.1; Chrome 155.0.8059.80. The actual Companion harness ran
headless, foreground visibility, background throttling disabled and zero
intentional audio delay. Stress added two busy Node worker threads. Existing
user apps were retained; ordinary background workload was not fully controlled.
The isolated contexts do not represent the user's Brave profile or hardware
display. Desktop bridge 47635 was absent for the single-owner measurements.

## Repeated software latency

Values are milliseconds from the existing mapped event target to the animation
callback. They are not acoustic onset error or physical display measurements.
The combined column includes independent Bass; separate semantic rows follow.

| Trial | Sample window | Animation n | p50 | p95 | Worst | Accepted / committed | Software-late |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Foreground 1 retry | 20 s | 80 | 194.50 | 285.10 | 299.65 | 81 / 81 | 74 |
| Foreground 2 | 20 s | 85 | 197.96 | 219.02 | 226.66 | 85 / 85 | 65 |
| Foreground 3 | 20 s | 83 | 183.04 | 229.64 | 249.30 | 85 / 85 | 69 |
| Full session | Source to 180 s EOF; ~177.2 s admitted preview | 665 | 201.17 | 221.40 | 312.07 | 677 / 677 | 547 |
| CPU stress | 60 s | 217 | 206.27 | 226.12 | 291.66 | 222 / 222 | 174 |

| Trial | Snare animation n / p95 / worst | Hat animation n / p95 / worst | Bass animation n / p95 / worst |
| --- | --- | --- | --- |
| Foreground 1 retry | 23 / 295.10 / 299.65 | 36 / 285.10 / 298.85 | 21 / 35.20 / 67.24 |
| Foreground 2 | 25 / 214.28 / 214.80 | 38 / 220.06 / 226.66 | 22 / 33.09 / 33.62 |
| Foreground 3 | 25 / 229.64 / 249.30 | 38 / 237.98 / 239.24 | 20 / 36.08 / 36.08 |
| Full session | 203 / 222.20 / 312.07 | 295 / 228.32 / 311.17 | 167 / 37.64 / 114.67 |
| CPU stress | 65 / 229.39 / 244.36 | 96 / 231.39 / 291.66 | 56 / 43.13 / 75.11 |

No Kick IDs were present in these Companion trace windows. That is a coverage
limit, not evidence of successful live Kick recognition. The separate known
Kick controls below exercise that class through the isolated runtime.

The old foreground 206–220 ms p95 range reproduces approximately in one trial;
the other foreground tails and the new full-session p95 are worse. No improvement
is claimed. One initial trial failed because a text selector matched a hidden
status hint instead of the private controls; `foreground-1/` is preserved as
FAIL. The harness now selects the actual named details summary. This is not a
detector failure. The successful D1 trials use `--capture-only`; unlike prior
trials, they omit an unrelated offline H0 warmup. They use the same live source,
runtime and measurement mechanism but do not assume identical event sequences.

All five joined windows have zero **explicit** semantic delivery-drop records.
The full session sent/received 683, scheduled/accepted/committed 677 and had 665
animation samples. Missing startup/tail/log stages remain unavailable: zero
explicit drops is not proof of zero end-to-end event loss. Capability counters
also include withheld/reset events outside the admitted preview window; they
are not interchangeable with the joined explicit-drop count.

The source played to its 180-second EOF. Preview activation follows capture
startup: `liveStartedAt=1792382909601`, `eofAt=1792383086818`, giving about
177.22 seconds of admitted live-preview time. The first five-second health
sample is already at source time 8.958087 seconds. The delivery distribution
therefore excludes initial source playback and is not a full 180-second preview
window. Full-session continuity passed: 31 playing health samples, zero unhealthy
samples, zero unexpected collected lifecycle records and recorded natural EOF.
Expected EOF released the offscreen owner. Five-second sampling plus lifecycle
logs is not continuous PCM, multi-hour stability or memory-leak qualification.

## Attribution and per-event availability

The actual ONNX graph has a `[1,100,84,1]` input, four same-padded 3×3
convolutions, three **bidirectional** GRUs of hidden size 60, and sigmoid output.
It is noncausal. The live contract uses 100 frames, a five-frame step and ten
right-context frames. Ten frames are the frozen implementation contract, not
a theorem that this checkpoint can never execute with less context. A different
window/output position is a different evaluated pipeline.

Audio is 44.1 kHz, stereo-mean features, Hann-window FFT size 2048, hop 441
(10 ms) and 84 log-filterbank features. A centered FFT needs 23.21995 ms after
its timestamp. Worklet dispatch/quantum, actual inference and downstream stages
are additional to the sample dependency below.

For score frame `c`, the newest input frame required by the current batch is:

```text
r(c) = 5 × ceil((c + 10 + 1) / 5) − 1
```

This separates 100 ms of configured future context from 0–40 ms of batch phase.
The worker releases five scores, frames `r−14` through `r−10`, per inference.

The frozen onset-guided classifier's novelty for peak `p` depends on scores
through `p+1`; comparing the next novelty requires `p+2`. The peak is evaluated
at `p+2`. Group closure requires `frame − lastPeak > 2`, so an isolated peak is
finalized at **score `p+5`**. The complete input dependency is `r(p+5)`:

```text
isolated-peak input age = 23.21995 + 100 + 50 + batchPhase(0…40) ms
                       = 173.21995…213.21995 ms
```

Fifteen constructed activation impulses (three classes × five batch phases)
exercise the actual classifier and confirm this bound. A separate constructed
extended peak group retains its best peak at frame 32 but closes at 123: 910 ms
of score wait. This is a dependency counterexample to a universal “50 ms
finalization” claim, not an observed natural-music error or acoustic score.

Replaying old saved activations preserves all original events: spaced 24,
rapid 11, mixed 48, silence 0. Fresh rapid controls also have exact saved-event
parity: 54 / 18 / 39 / 23 / 0 / 0 events. The old streams lack a batch origin,
so exact per-event release timestamps remain null and only min/max dependency
ages are reported. Fresh outer runtime availability is retained as observed
availability, without inventing an exact phase origin.

| Trial | Worker batches | Batch wall p50 / p95 / worst | Max queue depth | Accepted peak inference p95 | Finalization wall p95 |
| --- | ---: | --- | ---: | ---: | ---: |
| Foreground 1 retry | 472 | 25.5 / 28.0 / 48.8 | 0 | 27 | 54 |
| Foreground 2 | 475 | 25.8 / 29.6 / 61.5 | 0 | 29 | 53 |
| Foreground 3 | 472 | 25.4 / 27.7 / 46.8 | 0 | 27 | 52 |
| Full session | 3513 | 25.8 / 29.3 / 51.0 | 0 | 29 | 53 |
| CPU stress | 1279 | 27.3 / 32.1 / 54.4 | 0 | 32 | 56 |

Feature computation p95 is 1–3 ms at the coarse timing resolution. Worklet to
worker, worker wait and result to capture are generally 0–1 ms p95. Queue depth
never accumulates in the observed batch records. Full-session offscreen →
background p95 is 1 ms, background → app 7 ms, scheduler → controller 53 ms,
controller → DOM 22 ms and DOM → animation 14 ms. Foreground 1 has a real
offscreen → background p95 of 63 ms, and the full session has presentation/
transport outliers. They matter to tails, but do not explain away the structural
input dependency. These are separate stage distributions; **do not add their
percentiles**. Scheduler delay includes independent future-scheduled Bass.

The actual capture path adds an existing base/output-latency estimate to the
AudioContext target, then uses the output timestamp mapping to form epoch
deadlines. No new timestamp offset was added. Joins by the same drum IDs give:

| Trial | Joined drums | Required input age p95 | Actual input age at enqueue p95 | Existing output addition | Mapped target age at enqueue p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Foreground 1 retry | 63 | 203.22 | 231.63 | 50.00 | 185.45 |
| Foreground 2 | 67 | 213.22 | 240.52 | 50.00 | 196.06 |
| Foreground 3 | 67 | 213.22 | 240.09 | 50.00 | 194.24 |
| Full session | 487 | 203.22 | 231.56 | 50.00 | 187.50 |
| CPU stress | 165 | 213.22 | 240.63 | 50.00 | 194.44 |

These columns deliberately preserve different clocks and meanings. The output
addition is an estimate, not a calibrated physical measurement. If onset bias
were zero and the observed 50 ms estimate equalled audible output skew, even
the minimum unchanged input dependency would leave 123.22 ms before compute
and display. That conditional calculation supports rejecting a transport-only
±50 ms claim; it is not a universal hardware bound.

**PHYSICAL SPEAKER-TO-PIXEL SYNC — UNVERIFIED.** No calibrated microphone/display
capture was available. DOM, animation callbacks and headless clocks cannot
qualify that target.

## What can change without a new semantic experiment?

| Component | Classification | Consequence |
| --- | --- | --- |
| Bidirectional recurrence | Fundamental noncausality of this graph | A causal detector needs different architecture/training or separately evaluated approximations. |
| Ten future frames, 100-frame window/output positions | Frozen live inference contract | Shorter context can change logits; evaluate separately. |
| Five-frame cadence, 0–40 ms phase | Implementation batching | Faster inference on changed windows can change logits; do not assume prediction parity. Pure dispatch overhead may be reduced without changing decisions. |
| Centered 2048-sample FFT | Frozen frontend dependency | Changing centering/window changes features. |
| Peak grouping/finalization | Postprocessing semantics | An earlier close can alter winner, hit count and duplicates. |
| Worker dispatch, inference execution, transport, DOM | Potentially removable execution overhead | Preserve all numerical/event contracts; present runs do not show a dominant queue backlog. |
| Physical output/display skew and model onset bias | Uncertain | Requires acoustic references and calibrated external measurement. |

For an isolated peak, merely closing immediately when its novelty becomes
decidable (`p+2` instead of `p+5`) saves at most 30 ms of score horizon and may
save zero in a particular input batch. Its ideal input range would still be
143.22–183.22 ms. That is an analytical candidate bound, **not an implemented
or recognition-qualified L1**. Extended groups have a different tradeoff.

## Known-onset rapid controls

Six exact existing constructed CC0 controls were reused without resynthesis or
normalization. Their float32 data chunks were copied to `d1-*.f32`, preserving
prior evidence. Each is 14 seconds; attack intervals are 20/30/50/80/125/200 ms,
six attacks per segment and active row. Sample references are complete by
construction. This isolated Chrome test uses the actual runtime, worklet,
model, classifier and BeatPattern renderer; it is **not** the Companion IPC or
complete app path. No natural P/R/F1 is inferred from these controls.

| Control | References K / S / H | Global ±50 ms matched K / S / H | Unmatched predictions | Callback n / p50 / p95 / worst ms |
| --- | --- | --- | --- | --- |
| Simultaneous | 36 / 36 / 36 | 26 / 4 / 24 | 0 | 54 / 211.16 / 252.47 / 252.47 |
| Kick only | 36 / 0 / 0 | 18 / 0 / 0 | 0 | 18 / 220.05 / 258.30 / 258.30 |
| Snare only | 0 / 36 / 0 | 0 / 21 / 0 | **18 false Hats** | 39 / 210.61 / 250.32 / 250.70 |
| Hat only | 0 / 0 / 36 | 0 / 0 / 23 | 0 | 23 / 208.53 / 240.86 / 250.14 |
| Silence | 0 / 0 / 0 | 0 / 0 / 0 | 0 | No events |
| Sustained tones | 0 / 0 / 0 | 0 / 0 / 0 | 0 | No events |

Callback ages use predicted event timestamps, not the independent sample onset.
Acoustic matches above use the sample onsets. A generous ±50 ms match can attach
a prediction to a neighboring rapid hit. Therefore the separate strict score
uses `min(40 ms, interval/4)` and retains unmatched predictions:

| Interval ms | Strict tolerance ms | Simultaneous matches K / S / H, each /6 | Isolated Kick /6 | Snare-only Snare /6 | Hat-only Hat /6 |
| ---: | ---: | --- | ---: | ---: | ---: |
| 20 | 5 | 0 / 0 / 0 | 0 | 1 | 0 |
| 30 | 7.5 | 0 / 0 / 1 | 0 | 1 | 1 |
| 50 | 12.5 | 6 / 1 / 4 | 1 | 3 | 3 |
| 80 | 20 | 6 / 0 / 6 | 5 | 4 | 6 |
| 125 | 31.25 | 6 / 0 / 6 | 6 | 6 | 6 |
| 200 | 40 | 6 / 3 / 6 | 6 | 6 | 6 |

All six runs have max queue depth zero, no runtime page failures and no truncated
activation/event streams. Poor rapid-hit recall and Snare-to-Hat confusion are
recognition failures in these controls, not evidence of transport loss. Natural
acoustics, repeated song patterns and per-candidate recognition remain D2 work.

## Recognition evidence reuse and candidate status

| Candidate | This checkpoint | Admission requirement |
| --- | --- | --- |
| L0 | Frozen; timings, rapid controls and replay parity measured | Existing listening acceptance is not a new accuracy pass. |
| L1 | Not run; architecture review pending | Same saved activations/weights/frontend/thresholds; separate early-decision results. |
| L2 | Not run | Reuse prior causal/reduced-context evidence before one justified bounded experiment. |
| L3 | Not run | Explicit generic provisional identity, no semantic relabeling/double flash; separate user-value evidence. |

Historical causal student work already failed its accuracy gate. The saved
`src-tauri/target/percussion-closure/comparison.json` contains prediction
agreement, not human reference P/R. Historical context probes already include
step 2 with right context 4 and 2 under
`src-tauri/target/percussion-latency/context-probe/`; changing inference format
cannot make these new technologies. The current onset-valley decision path is
also previously tested, not a novel model. No broad search or training ran.

Reuse the existing five-track development / 18-track frozen MDB holdout, with
their original split/annotation limits and unknown checkpoint training overlap.
No candidate has been scored on or tuned to holdout here. D2 must report per
class recognition, onset error and confusion separately, then inspect Nujabes,
Rằng Em Mãi Ở Bên `[26,44)`, HSKT, Whiplash and XO Tour Llif3. User song labels
remain `provisional-human-reference`; unmatched predictions are not definite
false positives, and those labels do not produce official P/R/F1. The complete
constructed Snare-only negative control above is a different evidence class.

## H0 preservation, tests and resource scope

The initial warmup revealed prepared A/B statuses marked STALE because the
previous delivery's timing metadata changed two source hashes. That first
warmup displayed only Bass; it is retained as a failed preservation observation.
It was not evidence that H0 suddenly lost all percussion numerically.

The one-time `scripts/attest-full-song-timing-compatibility.py` accepts exactly
the reviewed old/new frontend and classifier source revisions, validates frozen
weights, full remaining preparation contract/dependencies, canonical WAV,
result/raw/event/source hashes, and requires a complete A/B pair. It refuses
unreviewed differences. Default is dry-run; explicit apply backed up original
status bytes, preserved `originalExecutionContract`, and restored 11 compatible
source statuses; 12 were skipped. Model results, raw scores, source audio and
normal cache validators are unchanged. The receipt explicitly says no inference
and no accuracy qualification. This is provenance-preserving reuse, not a new
detector experiment. A final check validated all 11 original backups and all
66 unchanged result/raw files. For rollback restore the backed-up status bytes.

Fresh actual Web H0 verification passed with Kick 11, Snare 17, Hat 34 and Bass
22 observed controller events. Visual-envelope changes preserved the same
native source clock and play/load/seek counters. Pause/seek/resume, recording
replacement and Beta-off passed; zero page errors. It is a functional regression
check, not a new listening or physical accuracy pass. No Desktop binary or
provider implementation was changed.

Fresh focused checks: 54 feature/classifier/player/local-hybrid tests;
four latency-analysis tests; 11 delivery-summary/full-song core/H0 bridge tests;
six cache-integrity tests; two attestation tests. All pass. The initial system
Python and unrelated analysis venvs lacked scientific dependencies; rerunning
in the existing `scratch/beat-grid-v2/.venv` passed without dependency changes.
The sandboxed pnpm launcher could not canonicalize its directory; direct Node
Vitest in the authorized environment passed. Existing jsdom media-method
warnings are retained. Changed JS syntax and focused lint pass as well.

| Trial | Harness user+system CPU seconds | Harness elapsed seconds | Harness RSS MiB |
| --- | ---: | ---: | ---: |
| Foreground 1 retry | 2.063 | 39.456 | 270.60 |
| Foreground 2 | 2.188 | 28.457 | 284.49 |
| Foreground 3 | 2.063 | 28.230 | 258.01 |
| Full session | 17.203 | 186.793 | 324.66 |
| CPU stress | 135.421 | 68.937 | 301.55 |

These CPU/RSS values belong to the **Node measurement harness**, not all Chrome
processes or detector memory. Stress CPU includes its busy worker threads.
Worker wall duration is not CPU utilization. Total browser CPU/RAM budget and
multi-hour resource stability are **not qualified**. No faster candidate is
admitted on this incomplete resource evidence.

## Providers, rights and remaining work

All seven discovery/control contracts and independent Bass/Lead are unchanged.
The [previous provider report](engineering-261019-0549-provider-live-upgrade.md)
retains its actual Brave YouTube and Apple/Spotify discovery/control evidence,
scoped shared-provider tests and restrictions. No new real-provider semantic
listening or Desktop test is claimed by this D1 checkpoint. New private
integration, lifecycle/visibility/restart checks and provider regressions belong
to D3 after recognition qualification. Original provider audio stays undelayed.

Controlled inputs reuse their existing CC0 provenance. Existing checkpoint and
source licensing records remain applicable; no new weights, datasets, remote
audio downloads or licenses were introduced. Spotify semantic analysis stays
blocked; protected Apple Music stays blocked. Missing separator/MELODIA runtime
dependencies are separate from this latency question. No DRM bypass, cloud
analysis, deployment, release or public rollout occurred.

The single private server remains `node scripts/serve-hybrid-beta.mjs`, PID
38164, port 1420 in this checkout. Isolated measurement browsers, runtime port
1431 and stress workers are closed. A sandbox visibility check briefly failed
to show the existing listener; one attempted restart failed with address-in-use.
An authorized port inspection confirmed PID 38164 and it was reused. No second
server was retained and no user browser was stopped.

See the [Vietnamese L0 listening guide](../261019-1101-low-latency-semantic/listening-guide-vi.md).
The final delivery receipt in private evidence records the exact delivery commit
and hashes; measured production remains the starting commit above.

## Reproduction

With the existing prepared CC0 source and private package, reuse the one server
on 1420. Use a new output directory for each run. The scripts bound source
duration and close their isolated contexts/workers:

```powershell
node scripts/measure-hybrid-browser-latency.mjs --capture-only --live-ms=20000 --output=scratch/low-latency-semantic/new-foreground
node scripts/measure-hybrid-browser-latency.mjs --capture-only --full-session --output=scratch/low-latency-semantic/new-full
node scripts/measure-hybrid-browser-latency.mjs --capture-only --stress --live-ms=60000 --output=scratch/low-latency-semantic/new-stress
node scripts/analyze-percussion-latency-floor.mjs scratch/beat-runtime-proof/synthetic-onset-guided.json scratch/low-latency-semantic/rapid-runtime.json --delivery=scratch/low-latency-semantic/full-session/foreground-latency-live-a.json --output=scratch/low-latency-semantic/recomputed-floor.json
$env:KORA_BEAT_SYNTHETIC='1'
$env:KORA_BEAT_CLASSIFIER='onset-guided'
$env:KORA_TEST_BROWSER='chrome'
$env:KORA_BEAT_PROOF_FULL_INPUT='1'
$env:KORA_BEAT_PROOF_INPUTS='d1-simultaneous-kick-snare-hat.f32,d1-isolated-kick.f32,d1-snare-only.f32,d1-hat-only.f32,d1-silence.f32,d1-sustained-tones.f32'
$env:KORA_BEAT_PROOF_RESULT='new-low-latency-baseline.json'
node scripts/verify-beat-runtime.mjs
```

## Unresolved decisions

1. Approve the bounded L1 offline comparison, accepting a new postprocessing
   variant with separate recognition results? It cannot be presumed to meet
   ±50 ms and will not enter the app before qualification.
2. No calibrated physical measurement or complete browser resource budget is
   available. These remain explicit acceptance requirements for any selected
   candidate; no software result closes them.
