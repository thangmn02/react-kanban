# Offline-quality live Beat Grid: D1 readiness

Date: 2026-10-19, Asia/Saigon. Branch: `codex/beat-grid-quality-recovery`.
Starting HEAD: `6388dd20f1a15127df2487507a909a562ffbfe8c`; clean on entry.

## Decision

**D1 is complete. NO-GO for training or Private Product Beta at this checkpoint.**
The available local corpus has no training partition, no separately verified
complete natural-reference subset, inadequate development rapid-Hat coverage,
and unresolved checkpoint/data overlap and distribution eligibility. These are
essential prerequisites, not failures of an unbuilt candidate.

One shared causal Kick/Snare/true-Hat design is specified below. It is not a
checkpoint, implementation or qualified improvement. The user's brief requires
stopping before substantial training or when essential dependencies are
unavailable. Accordingly D2–D5 did not run. No model, product module, capture,
provider, scheduler, renderer, frozen result or default changed. No new private
candidate build or new-model listening guide is represented as delivered.

The [plan](../261019-1918-offline-quality-live/plan.md) and
[machine-readable proposed contract](../261019-1918-offline-quality-live/recognition-contract.json)
record the next work and admission requirements. That contract remains
`PROPOSED_NOT_LOCKED`; missing evidence cannot silently become a gate pass.

## Frozen baseline and historical failure

The [matched-track investigation](engineering-261019-1753-matched-track-quality-gap.md)
is reused: Private Landing's exact PCM in [20,50) yields H0 Kick 30, Snare 17,
true Hat 105, versus L0/L1 Kick 30, Snare 17 and 15 Hat/Cymbal-row proposals.
These are model proposals, not 105 verified audible Hats. Its source manifest,
saved tracks and per-ID delivery receipts remain unchanged. Controlled clean L1
first-Hat animation median was 182 ms; physical synchronization remains unknown.

The actual frozen ADTOF SHA is
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`;
CNN SHA is
`785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`.
Both current files were hashed. `H0-frozen-routing-diagnostic-v1` remains the
offline reference; L0 is rollback and L1 an unqualified comparison.

The audit reviewed V2, acoustic/visual, Hybrid Beta, provider, D1 latency,
private L1 and matched-track records. Their validated neural results are reused,
not rerun. Novelty remains architecture/weights/frontend/data/pipeline identity;
ONNX conversion, right-context probes and the earlier-finalization variants
are already tested ideas. No broad model survey occurred.

The old causal student is SHA
`10cdc39b1fc4264a5f457560648e835895b6ad692a829c30f0435245ee2a3a2e`:

| Actual historical evidence | Finding |
| --- | --- |
| Graph | 43,638 parameters; three kernel-5 temporal convolutions with dilations 1/2/4, followed by an output convolution |
| Training | Seed 731, 20 epochs, about 19.54 seconds; 19 calibration inputs: six ADTOF pseudo-label targets and thirteen isolated nonpercussion controls |
| Causality/parity | Model future context zero; reported causality error zero and ONNX max error 1.49e-7. Centered features still require 23.22 ms future audio. |
| Historical browser speed | Model p95 1.1 ms, first-animation summary p95 92.42 ms in its 20-second matched trial; not physical timing |
| Teacher agreement | Kick 11 shared / 34 student-only / 6 teacher-only; Snare 10 / 21 / 9; Hat 28 / 6 / 30 |

Those agreement fields were named precision/recall/F1 in the old file, but the
file explicitly says **not human precision/recall**. They cannot qualify
recognition. The student lost many teacher Hat proposals and added many Kick/
Snare proposals despite successful causality/export checks. Pseudo-label
supervision, narrow calibration diversity and inherited feature/postprocessing
choices are plausible contributors; no ablation proves their individual causes.
The [earlier rejection](validation-261014-beat-grid-quality-recovery.md) remains.

Another provenance problem surfaced: the student manifest inherited 1,815,198
bytes/449,741 parameters, whereas the actual ONNX has 180,498 bytes/43,638
parameters. The graph, training receipt and hash agree; the inherited manifest
fields do not. Original evidence was preserved, not silently repaired. A new
candidate must derive its identity/size from the exported artifact and verify
its complete pipeline before evaluation.

## Data, reference quality and rights

The read-only audit verified **158 frozen source/annotation files**, original
matched-track hashes and both baseline model files. The existing 65 inputs are
23 natural recordings in paired drum/full-mix domains (five development,
eighteen locked holdout), ten generated controls and nine provisional listening
excerpts. There are **zero training inputs**. Existing partitions must not be
reassigned to create training data. Only silence and legacy Snare-only are
development controls; the remaining constructed cases are already held out.

| Asset | Current use and limitation | Readiness |
| --- | --- | --- |
| MDB Drums | Local published manual references; declared CC BY-NC-SA 4.0. Original partitions and hashes retained. Coverage omissions and checkpoint overlap remain unresolved. | Useful historical scoring; insufficient for the requested verified noninferiority qualification. [Publisher](https://github.com/CarlSouthall/MDBDrums). |
| Generated controls | Complete sample references for rapid/isolated/overlap/silence/tones; CC0. Natural timbre and vocals are not established by synthesized signals. | Reuse original tests without training on holdout; add development controls under a separately frozen protocol. |
| Authorized user recordings | Private Landing, Nujabes, Rằng, HSKT, Whiplash and XO source bindings/listening evidence already retained. | Qualitative regressions only; local analysis permission does not establish training/redistribution rights or complete labels. |
| Frozen CNN | Local teacher/reference; repository declares AGPL-3.0 and STAR training. Published training-file overlap and separate checkpoint scope are not fully resolved locally. | Do not copy its implementation, weights or distillation targets into this proposed first candidate. [Author repository](https://github.com/FrancescoZumo/frame_level_drum_classifier). |
| Frozen ADTOF/student | Local notices restrict evaluation; commercial/distribution chain unresolved. Teacher predictions are not independent labels. | Retain reference only; no renewed pseudo-label student training. |
| E-GMD, bounded acquisition option | Publisher declares CC BY 4.0, sequence-based splits and audio/MIDI alignment within 2 ms. Full download is 90 GB, 132 GB unpacked. Not acquired or locally verified. | A possible labeled drum-training source, not a natural full-mix/vocal validation replacement. Preserve sequence groups across all kit renders and inspect unusable recordings. [Publisher](https://magenta.tensorflow.org/datasets/e-gmd). |

A usable data package must add rights-cleared training examples, complete
reviewed true-Hat/Cymbal/overlapping percussion labels, natural vocal/non-drum
negatives, and a separate verified evaluation subset. Bind recording/sample
hashes, covered intervals, annotation revision, uncertainty and reviewer status.
Exclude ambiguous intervals explicitly. Group stems, mixes, excerpts, alternate
kit renders and derivative encodings by original performance before splitting.
Audit checkpoint training lists or label overlap as unresolved; title matching
is insufficient. Teacher outputs cannot fill missing acoustic labels.

Historical H0 development scores can be reconstructed per class without new
inference: use BASE Kick/Snare and C1 Hat from the same saved published references.
Each domain has 90 scored seconds over the same five recordings:

| Domain / H0 class | Published references | P / R / F1, % | Dense references |
| --- | ---: | --- | ---: |
| Drum-only Kick | 73 | 94.74 / 98.63 / 96.64 | 0 |
| Drum-only Snare | 204 | 88.02 / 72.06 / 79.25 | 68 |
| Drum-only Hat | 215 | 63.61 / 96.74 / 76.75 | 2 |
| Full-mix Kick | 73 | 83.75 / 91.78 / 87.58 | 0 |
| Full-mix Snare | 204 | 83.70 / 55.39 / 66.67 | 68 |
| Full-mix Hat | 215 | 62.58 / 94.88 / 75.42 | 2 |

These are historical published-reference scores with known omissions, not a
new verified accuracy gate. Paired domains do not double the independent sample
size. One changed dense-Hat match changes recall by **50 percentage points**.
There is no defensible five-point dense-Hat noninferiority conclusion from that
subset. H0's preferred Private Landing listening quality also does not mean
H0 has uniformly high precision on other recordings.

## One candidate and its information budget

The selected proposal uses **one shared causal multilabel engine** for Kick,
Snare and true Hat, plus an independent auxiliary other-Cymbal onset head.
Simultaneous classes remain possible; Cymbal is never relabeled true Hat.
All heads are supervised from independent labels in the first experiment.

At 44.1 kHz, use a trailing 1024-sample STFT and 220-sample hop, with 80 mel
bins, causal log power and backward frame difference. Normalize with prior
one-second EMA state initialized from training-only statistics, then update it.
There is no whole-song maximum, centered delta, future normalization or provider
resampling assumption. The existing frontend remains frozen for H0/L0.

Two frequency-only learned convolution stages project to 64 channels. Six
residual depthwise temporal blocks use kernel 3 and dilations 1/2/4/8/16/32,
one temporal convolution per block. They use only past frames. Independent
heads and at most one subsequent frame confirm onsets. Development may calibrate
one fixed postprocessing configuration; no holdout/song threshold sweep is allowed.

This remains in the old student's broad causal-convolution family. Its
frequency encoder, 5 ms framing, normalization, independent true-Hat/Cymbal
objectives and complete supervised training plan are materially different
pipeline decisions; narrower ONNX packaging or a new filename would not be.
No successful new learned technology or trained weights are claimed yet.

The frozen CNN cannot be converted unchanged into this design. Its source uses
three future context frames, centered width-nine delta features and a centered
1024-sample FFT at 22.05 kHz: interior finite dependencies alone reach **104.49
ms**. Its whole-file `ref=np.max` normalization additionally has no bounded
streaming horizon. These source/default calculations are retained in
[cnn-input-dependency.json](../../scratch/offline-quality-live/d1/cnn-input-dependency.json);
they are not new inference results.

Derived feasibility, not measured performance:

- Hop: **4.989 ms**; model lookahead: **0 ms**; confirmation: at most **4.989 ms**.
  A trailing window's 23.220 ms is past context, not centered future input.
  Timestamp it at its actual end sample. Acoustic localization still needs
  evaluation; this construction does not justify backdating an onset.
- Temporal receptive history: 126 frames, **628.571 ms**, plus the FFT window:
  **651.791 ms** finite feature/model history. EMA has bounded memory but longer
  decaying history. Training chunks must carry state or mask a documented burn-in.
  Reset all state and invalidate warmup output on source/generation/seek gaps.
- Temporal cache: 32,256 float32 bytes; temporal blocks alone: about 5.16 million
  MAC/s. Neither number measures browser RAM, full compute or accuracy.
  Proposed admission caps are 200,000 parameters and 1 MiB float32 weights.

An illustrative software allocation is 2.902 ms input quantum, 4.989 ms hop
phase, 1 ms features, 10 ms inference, 4.989 ms confirmation, 3 ms transport,
2 ms controller and one 60 Hz frame (16.667 ms): **45.546 ms total**. These are
design allocations, not summed observed p95 values. Only 4.454 ms nominal margin
remains before 50 ms; browser/OS stalls, prediction bias and physical output/
display skew are not qualified. The existing scheduler is not assumed to achieve
the proposed 2 ms allocation. Its actual joined stages must be measured before
changing it. Physical p95 absolute error ≤50 ms is still an open target.

Kick/Snare must pass recognition and relative timing with Hat on the same engine.
Leaving them on delayed ADTOF would yield only a **Hat-only experimental** mode,
which cannot qualify as Hybrid-quality live. Independent Bass and saved Lead
remain unchanged.

## Acceptance and runtime readiness

The proposed contract retains the user's margins: each class F1 ≥H0−3 points,
Hat recall ≥H0−5 and precision ≥H0−3. It additionally makes rapid/overlap margins,
negative controls and zero duplicate/stale-generation events explicit. Separate
instrument and visual-row views remain mandatory. Localizations use the frozen
one-to-one matching protocol and rapid spacing caps; no tolerance fitting.

Before holdout, lock all numerical criteria on adequate development coverage.
The estimand is pooled per-class micro metrics within each domain, with paired
original-recording cluster resampling; negative rates are exposure-weighted.
Use lower one-sided 95% bounds for recognition benefits, upper bounds for harmful
natural-negative rate increases (proposed tolerance +0.1 false Hat/minute), and
exact assertions for complete constructed controls, duplicates and stale events.
Require every mandatory row and report denominators. Inadequate rare-error
exposure or a degenerate all-zero bootstrap remains blocked, not a zero-risk pass.
No confidence interval is manufactured for incomplete labels or two dense Hats.
Relative noninferiority alone does not close false-Hat or user-acceptance gates.

The prior runtime failure is independently retained: 222/1111 L0 batches exceeded
50 ms, inference p95 77 ms, post→worker receipt p95 4.9 s, fifteen late discards,
but JS queue maximum zero. Source inspection locates the observability gap:
`percussion-runtime.js` forwards Worklet messages, while the worker timestamps
receipt only when its handler runs; its three-block queue excludes messages
waiting before that handler. No current trace isolates forwarding from inbox
waiting. A result-progress watchdog is also not an input-age guarantee.

The next bounded load experiment must join sequence/generation/sample intervals
and worklet post, main receipt, main forwarding, worker handler, inference start/
end, postprocessing and offscreen emission. Keep audio progress, wall waiting,
execution, queue depth and generation validity separate. Repeat quiet and fixed
CPU-contention trials without concurrent builds or raw-PCM observers. Only an
identified defect may be fixed; no model thresholds change to hide backlog.
This newly separated load experiment has **not run at D1**.

A future qualified engine needs bounded producer credits, a fixed byte/age cap
and no hidden unbounded inbox. Overrun must invalidate semantic state and report
degraded/unavailable output rather than continuing through lost context or
replaying stale flashes. This is a design requirement, not an implemented fix.

Current hardware is Ryzen 7 8845H, 8 cores/16 logical CPUs, Radeon 780M and
29,860,155,392 bytes RAM. The available Torch is 2.8.0+cpu with no CUDA device.
CPU training is possible in principle; candidate feasibility/time is unmeasured.
No cloud or GPU service is provisioned. Approximately 169 GB disk was free at
inspection; retaining the full E-GMD archive and unpacked audio together would
exceed that space. No large dataset download or dependency installation ran.

The proposed component caps are 0.2 logical cores average and 100 MiB incremental
resident memory, plus 30 minutes with no sustained backlog. Measure actual browser
process CPU/memory both incrementally and for the whole Kora/capture/Bass/worker/
Focus stack. Historical L1 browser measurements were roughly 1.2 logical cores
and 1.2 GiB sampled RSS sum, with sampling/shared-page limitations; these are
baseline receipts, not this candidate's resources. A small tensor cache does not
prove a small browser working set. Lower-powered hardware and a new 30-minute
candidate session remain **BLOCKED**.

| Gate | D1 status |
| --- | --- |
| Q, recognition | BLOCKED: complete natural labels, training data and independence are not established. |
| T, timing | UNQUALIFIED: design dependency calculated; no candidate runtime or physical measurement. |
| R, resources | BLOCKED: no candidate, 30-minute test or lower-powered device coverage. |
| I, integration | NOT STARTED: existing Music/Focus/provider evidence reused; no N adapter/private build. |
| U, listening | NOT STARTED for N; prior provisional H0 preference remains the quality motivation. |
| L, rights | BLOCKED: no cleared complete candidate training/distribution chain. No public release. |

After data readiness and the explicit substantial-training approval, the proposed
bound is one initialization/seed, at most 20 epochs or two CPU wall-hours,
development-only early stopping, no architecture sweep, then one locked holdout
evaluation if development gates pass. Failure stops the candidate. This is a
budget for approval, not an already-launched job or guaranteed sufficient training.

## Delivery, rollback and remaining questions

Fresh verification was read-only: hashes, original partition grouping, graph
inspection and design arithmetic. **No neural inference or holdout scoring ran.**
The audit and exact evidence hashes are in
[readiness-audit.json](../../scratch/offline-quality-live/d1/readiness-audit.json),
with its reproducible private `audit-readiness.py`; JSON/link/invariant validation
is recorded alongside it. Earlier model tests/builds and provider/runtime results
remain historical and are not reported as newly executed product regressions.

An optional direct Librosa-default introspection failed on the current
Numba/Coverage import (`coverage` has no `types`). Static source inspection then
verified the implementation defaults; an initial AST attempt selected a typing
overload stub and was corrected. No dependency, skill code or runtime was modified.
The training environment still needs an executable frontend smoke check after
its data/protocol is provisioned; this failure does not invalidate unchanged
previous cache results. Review also corrected the proposed uncertainty contract:
harm rates require upper bounds, benefits lower bounds, with the estimand and
rare-error limitations now explicit. Original audit output was preserved.

Only the new plan, proposed contract and this report change tracked files. No
evergreen product contract changed. Kora PID 30668 on 1420 and existing Lab PID
27544 on 5173/5174 were reconciled and retained; no D1 background process started.
The old student manifest discrepancy was documented without overwriting it.

The existing private experience and
[listening instructions](../261019-1753-matched-track-quality-gap/listening-guide-vi.md)
remain available. There is no N to install or enable. L0 rollback remains the
existing private selector/revoke path; H0 remains exact-source offline. A future
admitted N must use the existing feature flag/capability route, automatic ordinary
mode selection, active artifact identity, health/fallback reason, original source
ownership and L0 rollback. No second extension, capture, player or scheduler is
authorized. Spotify/protected Apple Music restrictions and undelayed provider
output remain intact. Default promotion still requires actual user listening.

Unresolved prerequisites, in order:

1. Which rights-cleared training audio and natural mixed/vocal negative package
   will be supplied or acquired, with a storage-feasible acquisition scope?
2. Who can verify complete onset coverage/uncertainty on an independent natural
   development/holdout subset, and provide the recording/checkpoint overlap audit?
3. Once those inputs are ready, approve the single bounded training budget and
   lock the final recognition contract before any candidate holdout evaluation.
4. Provide lower-powered target hardware and calibrated speaker/display timing
   capability before claiming the corresponding product gates.
