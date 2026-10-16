# Beat Grid V2 technology sprint

Decision: **NO-GO** for replacing the frozen baseline. All runnable candidates completed the coordinated round; none qualified on independent natural Snare/Hat correctness. No production deployment or new detector integration occurred.

## Scope and identities

Branch: `codex/beat-grid-quality-recovery`. Frozen base:
`c93046ad262db21577792eed0ee61c3452525328`. Acquisition checkpoint commit:
`afb10ab3569f6b640456044b2409c97aa2958075`. Final delivery identity will be recorded
in `scratch/beat-grid-v2/final-revision.json` after final regression checks.

Novelty was assessed before benchmarking by architecture, learned tensors,
checkpoint provenance, preprocessing, classes and complete pipeline. An ONNX
conversion is not a new detector. Thirty-five baseline copies, four pairs of
separator reexports with identical initializers, and the duplicate root/tau-0.8
ADT_STR weight file were recognized and skipped. The rejected ADTOF B and prior
visual R experiment were not treated as new technologies.

The normal ADTOF, capture/output ownership, source generation, timestamps,
controller/scheduler, source-bound cache and rights/provider guards remain intact.
The private listening server was restored at the user's request on ports 5173/5174;
it serves the existing baseline private experience, not a qualified V2 detector.

## Acquisition and license matrix

| Lane | Pinned implementation/checkpoint | Status and execution | Rights and domain |
| --- | --- | --- | --- |
| BASE | Frozen Kora ADTOF | RUNNABLE; 17 matching traces reused, new inputs inferred | Existing local-evaluation notice; 44.1 kHz, five-class frame detector |
| C1 | [Frame CNN](https://github.com/FrancescoZumo/frame_level_drum_classifier/tree/32b1c9e43fbaede862116ef6241fa9defba39b90), published webUI model | RUNNABLE; actual unmodified public API completed | AGPL-3.0 code; isolated private evaluation, no covered implementation copied into distributed Kora. 22.05 kHz, 96 mel bins, Kick/Snare/Hi-Hat; mixed/drum training domain |
| C2 | [OAF Drums](https://huggingface.co/thebluescreen/oaf-drums-onnx/tree/771fd5529062b9f6f0b58f01cc4b9819db046f4a), Magenta E-GMD `model.ckpt-569400` conversion | RUNNABLE; published Hat output selector repaired with unchanged learned weights; corrected sweep completed. Direct drum audio and full mixes; separated full mixes are a distinct pipeline | Apache-2.0 claim; original drum-focused domain. 44.1 kHz waveform; trained base pitches preserved after selector repair |
| C3 | [DrumSep](https://huggingface.co/splitzo/drumsep/tree/f510fb1dbdd968e3218f64e8d7ac1af0fafdb6e2), [original code](https://github.com/inagoy/drumsep/tree/c1cea3f47bacd410412c7f563109f0a227b0e784) | RUNNABLE after one exact EyeLike compatibility lowering; original graph itself fails ORT | MIT claim; 44.1 kHz drum input, Kick/Snare/Cymbals/Toms. Cymbals does not establish Hi-Hat identity |
| C4 | [ADT_STR](https://github.com/pier-maker92/ADT_STR/tree/77dbef225e7029478ebfb916f20c7a00274f0f12), [tau-0.8](https://huggingface.co/Pierfrancesco/adt-str/tree/a33c5c6b191a4ca1e0f6dc22140947485eb36ce8/setting-tau-0.8) | RUNNABLE; complete sweep, 15 original batch-eight and 50 batch-one inputs | Code CC BY-SA 4.0; separate checkpoint-license scope undeclared. 24 kHz, 2.56 s chunks, autoregressive Transformer, custom 26-class pitches |
| C5 | [Separate-and-Detect](https://github.com/ddman1101/Separate-and-detect/tree/0ac2fe6a35a7968d70ecfb8866cad025c350f5bd), HF `5384a5dcf7456ea5876de2b350438f0cfbe34726` | BLOCKED — inference dependency; required official VAE and HiFiGAN URLs both return HTTP403. No model inference claimed | MIT claims; released main checkpoints about 5.4 GB each. Author Linux/Python3.9/CUDA stack also unavailable locally; selected-ABI failure alone was not used as the acquisition blocker |
| C6 | [drum2midi](https://github.com/miraer/drum2midi/tree/ef2a36c062341ab0ea585874259ea396a94ae362) | BLOCKED — licensing/rights in complete default chain; no complete-pipeline performance claimed | MIT wrapper, ADTOF-dependent semantic detector, upstream ADTOF-pytorch has no declared license and default MDX23C weight terms are unstated. Baseline evidence cannot stand in for this complete pipeline |
| C7 | [YODO](https://github.com/varsaav/yodo/tree/0cb980a11e9ba1a37cbafddec1e85c66d8ffa236) | BLOCKED — usable weights/inference contract. Linked file size differs from supplied one-channel configuration by 2,304 bytes, exactly two first-convolution input channels | MIT code; notebook expects `tri2-80k.weights`, linked download identifies `yolov4.weights`. No guessed channel conversion or training |

The full-mix C2/C3 chains use official safe
[HTDemucs weights](https://huggingface.co/adefossez/HTDemucs/tree/cbc8a9b1a87023b7fd74e7b3412e6321c0eab003),
four-source `955717e8`. MIT Demucs code, source metadata class checked, no pickle
checkpoint executed; its Hugging Face card does not separately declare checkpoint
license scope, so distribution rights for that complete chain remain unresolved.
First-stage separation time, CPU and memory are included in
the complete pipeline. Raw DrumSep stems are retained, never used as reference truth.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| BASE | 1,815,198 | `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a` |
| C1 selected webUI | 2,852,169 | `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db` |
| C2 | 5,966,247 | `23d4b05ce7e9715bdb4396823d68bc886e8a958fa9f6266c0f7132b78098b521` |
| C2 corrected selector | 5,966,247 | `4c58ebfc53e7ec92a47a570d3cf7c0838142e7e03b0a64da42d642387ae3fffa` |
| C3 original | 335,086,851 | `313dcb93e0ed60f52280cd20f2145f32110ffa6f450ce157a69846e16642dd5f` |
| C3 compatible graph | 335,090,099 | `bbe61244551359af03d8b39584cdb4127a5491fe8462ed33640e52489032d0bc` |
| C4 tau-0.8 | 289,134,056 | `f94d1773d929166e0a3f63d305975aa6667512f8a71d7706872e1f8b23ca930b` |
| First separator | 84,025,440 | `d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd` |

## Corpus and fairness

The frozen corpus has 65 inputs: ten complete-by-construction synthetic controls,
nine unverified user-listening excerpts, and 23 paired drum-only/full-mix natural
recordings. The two missing requested controls were added before quality scoring,
without changing previous inputs or inspecting scores. Independently annotated
acoustic/electronic isolated coverage remains limited: the IDMT archive returned
HTTP403. Generated signals are never described as recorded acoustic ground truth.

The natural reference is the original author-published
[MDB Drums](https://github.com/CarlSouthall/MDBDrums/tree/b29e2d63c3a023506f4bf353c5b2e8a558eed135)
manual-review dataset, CC BY-NC-SA 4.0, private noncommercial research only.
Per-genre grouping uses the original
[MedleyDB metadata](https://github.com/marl/medleydb/tree/537bb7bad0601fc58e4fff8404f71658b86ef60e/medleydb/data/Metadata),
with all 23 metadata files pinned and hashed; genres are not inferred from titles.
First 20 s or shorter; score 1 s through duration−1 s. A track-hash split fixed
before predictions keeps pairs together: five development and eighteen holdout
tracks. Overall input partitions are 12 development and 53 holdout. Published
annotation omissions and unknown checkpoint training overlap limit generalization;
these are scores against the published references, not new certification of perfect
coverage or independent performance on XO.

All lanes receive the same canonical stereo float32 PCM, without amplitude
normalization before their official preprocessing. Previous baseline F32 traces
remain valid; earlier 16-bit review copies do not establish equivalent model input.
Mutable WAV PEAK headers were proved equivalent by reconstructing their exact old
container hashes. Historical separator RNG seeds are retained explicitly, and
future seeds use decoded PCM identity. Original records and post-execution
compatibility attestations are retained; no duplicated neural experiments were
silently rerun. Replay-only runtime fields are null.

C1 uses the published global dB reference, centered delta/context features, sigmoid,
0.5 threshold and rising edges. C2 uses the conversion author's strongest frame
within each continuous >0.5 onset run. C3 uses official complex Demucs frontend and
inverse, fixed 40 s padding, then default librosa onsets with hop441/backtrack false
and fixed 1e-5 silence floor. C4 uses its released tau-0.8 configuration and official
greedy decoder without shortening the checkpoint configuration's 512-token limit
(the Python helper's fallback is 1,024, but that fallback is not used). No thresholds,
tau variants or class mappings were fitted to holdout or user clicks.

The published OAF export selects pitch42, but the
[exact Magenta training map](https://github.com/magenta/magenta/blob/c15687ebd1c1cc12658cd468c737d3c24c02b918/magenta/models/onsets_frames_transcription/drum_mappings.py)
stores the HH/Tambourine/Maracas group at base pitch46. The original exported Hat
channel was nearly zero on a natural drum input. One nonlearned Gather index is
corrected from 21 to 25; every learned initializer byte and graph operation remains
unchanged. This is a contract repair to the same detector, not model novelty or
threshold tuning. Original results remain invalid-selector diagnostics. Only C2
requires repeated inference because the saved eight outputs omit the trained Hat
column and do not retain recoverable intermediate activations. The seven unchanged
columns must match their earlier saved values. Full TensorFlow restoration parity
is still the converter author's claim; it is not presented as independently rerun.
All 95 original inputs passed the seven-column onset/velocity check with maximum
absolute difference 0. Two new controls have no previous outputs. The corrected
97-run C2/C2-separated sweep is complete.
The repaired raw pitch46 means Magenta's grouped HH/Tambourine/Maracas target,
not a separately identified open-Hat subtype. Its non-Hat members remain an
explicit semantic limitation and potential false-Hat source.

The C4 CPU execution layout uses the author-supported batch-size-one argument for
remaining inputs. Review verified independent rows in evaluation mode; exact
ordered note parity passed on the completed weak/strong Hat and XO inputs. Neural
time changed from 395.7 to 64.6 seconds and 29.0 to 20.4 seconds respectively.
Both probes have six chunks; no completed eight-chunk batch was available. The
15 earlier batch-eight results keep their original execution identity and timing
with a separate semantic-compatibility attestation. Unprobed completed inputs were
not rerun; CPU shape-dependent rounding remains a theoretical limitation. All
independently annotated natural C4 inputs use batch size one. Timing summaries
separate both layouts. No checkpoint, tau, frontend, chunk, greedy decision or
512-token limit changed, and this is not counted as a new model.

Matching is one-to-one, maximum cardinality then minimum absolute error. Natural
tolerance is at most 50 ms, synthetic at most 40 ms, further limited per reference
to one quarter of its nearest same-class gap. Dense-repeat and overlap subsets,
per-genre results, raw classes and the shared Hat/Cymbal display row are reported
separately. ADT_STR custom pitch46 is Cymbal; standard GM pitch46 is open Hat.
Only the shared-row reference view collapses exactly coincident Hat/Cymbal labels;
prediction duplicates remain measurable and no nearby-onset merge is fitted.

## Results and architecture decision

**NO-GO.** None of the evaluated replacements justifies replacing the frozen baseline. No new streaming or offline detector is integrated, and no V2 A/B package is presented as qualified. The current private baseline and generic fallback remain available. This completes the bounded selection round.

All 357 result records passed fail-closed validation: five lanes × 65 inputs plus 32 separated full mixes. The scorer produced 606 eligible views and 54 unscored listening records. The 32 first-separator cache records also remain verified. TorchAudio 2.8.0+cpu is now included in dependency fingerprints; its pre-existing installation log and 117-package freeze support a validation-only migration of 389 records. Original execution records, C4 batch-eight identities and the actual parity-probe execution fingerprint remain archived; no predictions or timing values changed.

### Independent natural holdout

These are micro-aggregated scores against the published MDB references on eighteen held-out tracks, 311.9 scored seconds per domain. Each cell is Precision / Recall / F1 (%). The same recordings supply both domains; they are not independent additional tracks.

| Full-mix pipeline | Kick P/R/F1 | Snare P/R/F1 | True Hat P/R/F1 |
| --- | ---: | ---: | ---: |
| BASE | 95.1 / 91.0 / 93.0 | 87.3 / 68.5 / 76.8 | 90.2 / 78.5 / 83.9 |
| C1 | 90.5 / 91.9 / 91.2 | 78.1 / 64.7 / 70.8 | 67.0 / 76.7 / 71.5 |
| C2 | 92.6 / 64.5 / 76.0 | 58.5 / 43.4 / 49.8 | 85.7 / 46.0 / 59.9 |
| C2-separated | 95.1 / 92.3 / 93.7 | 79.0 / 76.0 / 77.4 | 87.5 / 74.6 / 80.6 |
| C3 | 70.2 / 98.1 / 81.9 | 66.0 / 87.2 / 75.2 | — / 0.0 / 0.0 |
| C4 | 67.7 / 83.1 / 74.6 | 51.9 / 53.0 / 52.4 | 70.2 / 22.3 / 33.8 |

C2-separated improves Snare recall from baseline 68.5% to 76.0%, but lowers precision from 87.3% to 79.0%; Snare F1 gains only 0.7 percentage points. Its Hat F1 falls from 83.9% to 80.6%. C3 raises Snare recall with substantially more unmatched Snare proposals and cannot identify true Hat. C1 and C4 do not supply a better full-mix Snare/Hat tradeoff. More events do not establish recovery.

| Original drum-only input | Kick P/R/F1 | Snare P/R/F1 | True Hat P/R/F1 |
| --- | ---: | ---: | ---: |
| BASE | 97.2 / 97.4 / 97.3 | 86.8 / 84.3 / 85.5 | 88.6 / 90.6 / 89.6 |
| C1 | 96.8 / 96.6 / 96.7 | 86.1 / 85.5 / 85.8 | 70.6 / 85.5 / 77.3 |
| C2 | 97.1 / 92.7 / 94.9 | 84.6 / 81.9 / 83.2 | 87.7 / 74.9 / 80.8 |
| C3 | 66.6 / 99.6 / 79.8 | 62.3 / 95.7 / 75.5 | — / 0.0 / 0.0 |
| C4 | 88.9 / 96.1 / 92.4 | 80.5 / 82.6 / 81.5 | 87.6 / 48.1 / 62.1 |

C3 Hat precision is undefined because it emits no Hat-labelled events; its zero Hat recall describes unsupported identity, not silent Cymbal stems. C2 Hat scores use its coarse HH/Tambourine/Maracas target. Neither can establish pure Hat subtype correctness.

| Full-mix public Hat/Cymbal row | P/R/F1 (%) | Every public percussion row ≥90% P and ≥85% R |
| --- | ---: | --- |
| BASE | 85.0 / 82.2 / 83.6 | FAIL |
| C1 | 75.6 / 72.1 / 73.8 | FAIL |
| C2 | 84.6 / 42.4 / 56.5 | FAIL |
| C2-separated | 88.7 / 65.5 / 75.3 | FAIL |
| C3 | 63.5 / 89.8 / 74.4 | FAIL |
| C4 | 64.4 / 31.9 / 42.7 | FAIL |

### Error, density and overlap diagnostics

Unmatched counts below refer only to the independently published reference, with its possible omissions. Onset errors are conditional on matched events; they are not physical playback latency. Each natural holdout has 470 Snare and 678 Hat references. Dense subsets contain only 40 Snare and 22 Hat references, so their percentages have limited support.

| Full mixes | Missed Snare / unmatched Snare | Unmatched Hat / rate per minute | Snare error median/p95 ms | Hat error median/p95 ms |
| --- | ---: | ---: | ---: | ---: |
| BASE | 148 / 47 | 58 / 11.2 | 10.0/20.0 | 10.0/19.8 |
| C1 | 166 / 85 | 256 / 49.3 | 5.9/16.1 | 6.2/18.8 |
| C2 | 266 / 145 | 52 / 10.0 | 10.0/20.0 | 10.0/22.3 |
| C2-separated | 113 / 95 | 72 / 13.9 | 10.0/20.0 | 10.0/21.9 |
| C3 | 60 / 211 | 0 / 0.0 | 6.5/20.0 | — |
| C4 | 221 / 231 | 64 / 12.3 | 10.0/30.0 | 10.0/23.1 |

| Full mixes | Dense Snare / Hat recall (%) | Overlapping Snare / Hat recall (%) |
| --- | ---: | ---: |
| BASE | 65.0 / 90.9 | 84.7 / 76.5 |
| C1 | 62.5 / 86.4 | 80.5 / 72.9 |
| C2 | 45.0 / 63.6 | 48.9 / 35.7 |
| C2-separated | 72.5 / 90.9 | 86.3 / 60.1 |
| C3 | 67.5 / 0.0 | 97.9 / 0.0 |
| C4 | 40.0 / 36.4 | 66.8 / 15.0 |

The overlap subsets contain 190 Snare and 361 Hat references. Complete per-track, per-genre, development/holdout and domain metrics, including Kick onset errors, are in `comparison.json` (`scored`, `genreSummary`, `summary`). Original genre metadata covers Jazz, Musical Theatre, Pop, Rock and Singer/Songwriter; this small set does not certify broader genres or unknown training independence.

### Controlled failure cases

These are complete synthetic references. They diagnose failure modes without qualifying natural accuracy. C3 public-row counts include Cymbals; it emits no true Hat identity.

| Lane | False public Hat-row events: Snare-only / legacy Snare / sustained tones | True Hats recovered under loud drums (of 36) | Isolated Hat repeats: 20/30/50/80/125/200 ms (each of 6) |
| --- | ---: | ---: | --- |
| BASE | 18 / 5 / 0 | 18 | 0 / 1 / 3 / 6 / 6 / 6 |
| C1 | 24 / 6 / 0 | 23 | 1 / 2 / 5 / 6 / 6 / 6 |
| C2 | 5 / 1 / 0 | 14 | 0 / 0 / 4 / 6 / 3 / 6 |
| C3 | 23 / 5 / 112 | 0 | 0 / 0 / 0 / 0 / 0 / 0 |
| C4 | 12 / 3 / 0 | 8 | 0 / 0 / 1 / 6 / 6 / 6 |

All direct lanes emit zero public percussion-row events on digital silence. The explicit sustained-tone control exposes 112 C3 public Hat-row proposals. Baseline dense Hats recover 18/36; C1 recovers 23/36, but its natural Hat precision falls to 67.0% and Snare-only false Hat events increase. No lane passes by generating denser flashes. The complete simultaneous, weak/strong, isolated Kick and repeat-segment results remain in `comparison.json`.

### User listening evidence

The case ledger contains 208 provisional cases, including whole-passage review intervals. Every case is `provisional-human-reference`, unverified and scoring-ineligible, with audibility/instrument/timing/coverage uncertainty. A ±150 ms join is only a navigation aid. Missing labels or nearby predictions establish neither false positives nor false negatives. No threshold was fitted to these marks.

| Pipeline | XO 45–57 s: Kick / Snare / Hat / Cymbal proposals | MONO: total proposals | Whiplash W1/W2/W3: true Hat proposals |
| --- | ---: | ---: | ---: |
| BASE | 16 / 9 / 34 / 6 | 1 | 16 / 8 / 0 |
| C1 | 17 / 10 / 44 / 0 | 1 | 28 / 33 / 31 |
| C2 | 12 / 26 / 1 / 1 | 5 | 0 / 0 / 0 |
| C2-separated | 14 / 16 / 44 / 0 | 0 | 0 / 0 / 1 |
| C3 | 17 / 42 / 0 / 62 | 246 | 0 / 0 / 0 |
| C4 | 18 / 16 / 18 / 6 | 64 | 11 / 7 / 0 |

C2-separated changes XO from one to 44 Hat proposals, but that is unverified activity, not demonstrated recall. It produces no MONO events in this excerpt; C3 and C4 produce many proposals requiring acoustic review. BASE’s one MONO Cymbal proposal occupies the shared Hat row. Model disagreements and the Whiplash Hat gaps identify passages for review; this sprint establishes no natural-listening winner and makes no “sounds better” claim.

Raw onset activations and source-relative timestamps are retained for BASE/C2. C1 sigmoid score distributions are derived from saved logits at its published onset frames. These scores are uncalibrated and not mutually comparable. C3’s onset extractor and C4’s greedy decoder emit no event-confidence probability, so their confidence distribution is explicitly unavailable; velocity or stem energy is not substituted. `listening-case-ledger.json` and `comparison.json.listening` retain the individual proposals and uncertainty.

## Runtime and capability boundaries

Hardware: Ryzen 7 8845H, 8 cores/16 logical, 27.8 GiB RAM, Radeon 780M with no CUDA
device. Every model uses four CPU threads, CPU provider and float32; no GPU inference.
The isolated Python3.12.14 environment and exact package freeze are retained.
Native PyTorch/ORT measurements include preprocessing and postprocessing, while
cold-load values cover the explicit model-loading call, not a fresh OS/Python or
browser start. C1's first call includes lazy frontend startup. Sequential chain CPU
is summed; resident peak is the maximum stage, not a sum of nonconcurrent models.
Four C3 samples overlapping the requested listening-server rebuild are excluded
from runtime aggregation, while their valid predictions remain in quality results.

The comparison below uses the same 21 independently annotated natural full mixes for every lane. The two rebuild-overlap mixes are removed from all lanes in this matched cost view. C4 uses batch one throughout this subset. `runtime-comparison.json` records the exact IDs and binds `comparison.json`; its original all-input summaries retain separate batch-eight/batch-one groups.

| Pipeline | Weighted / p95 RTF | Explicit cold load s | Peak resident GiB | Host CPU % |
| --- | ---: | ---: | ---: | ---: |
| BASE | 0.096 / 0.103 | 0.019 | 0.18 | 21.8 |
| C1 | 0.009 / 0.010 | 0.578 | 0.47 | 17.9 |
| C2 | 0.017 / 0.019 | 0.042 | 0.30 | 14.4 |
| C2-separated | 0.527 / 0.598 | 0.336 | 1.82 | 24.3 |
| C3 | 0.906 / 1.050 | 1.683 | 6.20 | 23.8 |
| C4 | 5.402 / 13.100 | 5.433 | 0.67 | 25.1 |

RTF is processing wall seconds / input audio seconds. CPU is aggregate process CPU time / wall time / sixteen logical processors; it is not per-core peak. GPU inference is unused; system GPU utilization was not sampled. BASE’s seventeen replay-only inputs never contribute runtime. C4’s earlier batch-eight full-mix group has weighted RTF 17.054 across seven unverified listening inputs; the distinct batch-one group has weighted RTF 5.889 across 25 inputs. Those groups have different content and must not be read as a paired speedup. Only the two exact-note parity probes above supply paired batch-layout timings.

| Pipeline | Mean preparation / neural / postprocessing s | Mean first separator incl. I/O s | Mean total wall s |
| --- | ---: | ---: | ---: |
| BASE | 0.275 / 1.357 / 0.069 | 0.000 | 1.870 |
| C1 | 0.074 / 0.085 / 0.000 | 0.000 | 0.166 |
| C2 | 0.011 / 0.305 / 0.001 | 0.000 | 0.337 |
| C2-separated | 0.009 / 0.304 / 0.001 | 9.904 | 10.238 |
| C3 | 0.051 / 5.895 / 1.741 | 9.904 | 17.596 |
| C4 | 0.013 / 104.901 / 0.000 | 0.000 | 104.918 |

These phase timers have explicit limits. C1 combines feature extraction and its non-neural API wrapper under preparation; no separate postprocessing timer was exposed. Total wall includes input reads, raw-output recording and untimed loop/serialization overhead, so component columns need not sum to total. First-separator preparation and output serialization were measured separately once on each exact source/output, then added to the retained neural-stage timing; complete chains are measured stage sums, not fresh interleaved end-to-end runs. Four C3 records remain excluded only for runtime; their quality predictions remain valid. Original all-input and drum-only costs are retained in `comparison.json.runtimeSummary`.

| Lane | Necessary context / compatibility | Classification boundary |
| --- | --- | --- |
| BASE | Existing 100 ms right context, plus frontend processing | Prior actual-browser route evidence is reused; accuracy/timing qualification remains unmet |
| C1 | Global clip dB maximum and centered features; no causal conversion tested | Native ORT works; browser streaming/backlog untested |
| C2 | Bidirectional LSTM across input clip | Offline evaluation; low native RTF cannot prove a live route |
| C3 | Fixed 40 s graph, first separator on full mixes | Offline evaluation; original ORT EyeLike unsupported, compatible derivative separately identified |
| C4 | 2.56 s chunks and autoregressive decoding | Offline evaluation; CPU feasibility measured, browser path absent |
| C5/C6/C7 | Acquisition gates failed | RESEARCH-ONLY / BLOCKED; no runtime invented |

No new candidate has proven sustainable AudioWorklet/Companion streaming, bounded
browser worker backlog, ≤30 ms necessary future audio, or physical ≤50 ms p95.
Software timestamps and native real-time factor cannot pass those gates.

## Gate and architecture disposition

| Gate | Status | Evidence and consequence |
| --- | --- | --- |
| Historical novelty / duplicate reuse | PASS | Architecture, tensor and pipeline inventory preceded inference; identical exports skipped. |
| Eligible acquisition | PASS / BLOCKED | BASE–C4 completed; C5 dependency, C6 rights and C7 usable-weight contract blocked with actual access/source evidence. |
| Frozen evidence and reproducibility | PASS within acquired workspace | 65 inputs, 357 validated results, raw outputs, 32 separator caches and archived migrations. A fresh clean-host reinstall was not rerun. |
| Natural public-row accuracy | FAIL for every runnable lane | No lane meets ≥90% precision and ≥85% recall on all three public percussion rows. |
| True Hat, dense/overlap and false-Hat preservation | FAIL for replacement | No candidate establishes a sufficient natural Snare/Hat tradeoff while retaining Kick and controlled negatives. |
| Streaming / necessary future audio | FAIL or unproven | Baseline needs 100 ms right context; other evaluated frontends/chunks are noncausal or longer. No new sustainable browser path. |
| Physical synchronization ≤50 ms p95 | BLOCKED | No physical speaker-to-pixel measurement; matched onset errors cannot substitute. |
| Distribution rights / operational readiness | BLOCKED for release | Existing baseline and several new checkpoint scopes remain unresolved; no new release adapter qualified. |
| Private V2 integration and listening package | BLOCKED by recognition gate | No qualified replacement, so no misleading V2 package or forced A/B integration. Existing private baseline service retained. |
| Regression and packaging | PASS | App, Node, Python, build and package checks below; no product detector/runtime code changed. |

Recognition is the first filter. BASE remains the strongest overall full-mix reference in this round, while still failing the aspirational Snare/Hat gates. C2-separated is an incremental Snare-recall tradeoff with lower Snare precision and Hat F1, added separation cost, offline context and unresolved separator-weight scope. C1 is cheap natively but has inferior natural precision and AGPL integration implications. C3 is expensive, emits a coarse Cymbal stem and incurs many unmatched proposals. C4 has inferior full-mix recognition and slow autoregression with seconds of context. C5–C7 have no complete measured result and cannot be ranked as accuracy winners.

There is no qualified streaming ranking winner and no qualified offline ranking winner. No replacement is designated a clear research champion. The final decision is **NO-GO**: retain the frozen ADTOF/generic-fallback architecture, preserve these results, and do not start another technology-selection cycle without explicit user authorization. No event timing, animation, thresholds, provider rights or permission boundary was changed to conceal failure.

## Reproduction and evidence

Private artifacts live in `scratch/beat-grid-v2/`, excluded from Git: pinned source
and checkpoint manifests, learned-identity registry, environment freeze, immutable
corpus/reference/trace receipt, per-lane raw outputs and normalized events, measured
separator caches, access-failure logs, comparison and provisional case ledger.
No copyrighted audio, dataset audio or learned checkpoint is redistributed.

Local evidence links: [model/checkpoint manifest](../../scratch/beat-grid-v2/checkpoint-manifest.json), [novelty/reuse registry](../../scratch/beat-grid-v2/identity-reuse-registry.json), [package freeze](../../scratch/beat-grid-v2/environment-freeze.txt), [dependency license inventory](../../scratch/beat-grid-v2/dependency-license-inventory.json), [corpus freeze](../../scratch/beat-grid-v2/round-corpus-freeze.json), [all raw and normalized results](../../scratch/beat-grid-v2/results), [comparison](../../scratch/beat-grid-v2/comparison.json), [result receipts](../../scratch/beat-grid-v2/result-receipts.json), [matched runtime](../../scratch/beat-grid-v2/runtime-comparison.json), [provisional case ledger](../../scratch/beat-grid-v2/listening-case-ledger.json), and [final revision/check receipt](../../scratch/beat-grid-v2/final-revision.json). These private local artifacts are not bundled into a clean clone.

From the isolated, acquired workspace, run
`powershell -File scripts/reproduce-beat-v2-round.ps1 -VerifyOnly` to verify and
rescore existing evidence. Without `-VerifyOnly`, valid matching cache entries are
reused and missing inputs are inferred. A stale identity fails instead of overwriting
evidence. Acquisition and corpus preparation scripts retain the exact sources and
deterministic transformations; follow the acquisition checkpoint for environment
setup and source dependencies. C1 async Windows execution requires the local host
to permit socketpair creation; the restricted host stalled before inference.

Verification completed on 16 October 2026: 912/912 app tests (116 files), 22/22 Node research tests, and 15/15 Python contract tests. Typecheck, production build, Companion packaging and bundle budget passed; main entry is 718.8 KiB against a 976.6 KiB budget. Lint passed with zero errors: 25 existing app warnings plus two unused-directive warnings in downloaded Matplotlib dependency copies. Existing large-chunk build warnings remain. Twenty-two research Python files parse, acquisition JavaScript syntax checks pass, and the two reproduction/setup PowerShell scripts parse. No app regression was hidden or weakened.

Raw logs are `final-vitest.log`, `final-node-tests.log`, `final-evidence-verification.log`, `final-lint.log`, `final-typecheck.log`, `final-build.log` and `final-bundle.log` in the private evidence folder. `final-revision.json` binds the final Git revision, source-file hashes, result receipts and these checks. Final review confirmed the dependency migration, unchanged predictions/timings, and every decision, quality, controlled-case, listening and runtime table against its artifacts. Report encoding was corrected before saving the final revision receipt. Normal-package inspection confirms both 46-file Companion archives retain the private flag off and contain no new V2 checkpoint.

Open questions: independently complete, accurately timed XO/Whiplash subset;
checkpoint training overlap; uncertain checkpoint-license scopes; physical output
timing; whether model disagreements correspond to the user's audible attacks.
