# Acquisition checkpoint

Acquisition and the single coordinated inference round completed on 2026-10-16.
The final architecture decision is **NO-GO** for replacement; see the
[final report](../reports/engineering-261016-1459-beat-grid-v2-sprint.md).
The novelty/reuse registry passed before that round. User's latest constraint remains
the highest-priority pre-benchmark gate: formats/providers do not establish novelty.

## Frozen source and resources

Base `c93046ad262db21577792eed0ee61c3452525328`, current quality-recovery branch.
Ryzen 7 8845H, 8 cores/16 logical, 27.8 GiB memory, initially 170 GiB free disk;
only Radeon 780M reported, no NVIDIA/CUDA. Docker client exists but its Linux-engine
pipe is unavailable; WSL has only Docker Desktop as default. No daemon was started.
Python 3.12.14 is isolated at `scratch/beat-grid-v2/.venv/Scripts/python.exe` using
the bundled runtime. Managed-Python installation failed; the existing interpreter
worked. Dependencies include PyTorch/torchaudio 2.8.0+cpu, ORT, librosa, soundfile,
ONNX, safetensors, transformers 4.x, Demucs 4.1.0 and private API/scoring libraries.
Capture an exact package freeze before the round. No public model/audio release.

## Checkpoints and minimum execution

| Lane | Current evidence |
|---|---|
| BASE | Same ADTOF ONNX SHA `c571062d…f80a`, 1,815,198 bytes, 35 duplicate local copies. Reuse the 17 unchanged activation traces and actual-browser evidence when contracts match; new MDB inputs need new predictions. No original-weight provenance beyond existing notice is invented. |
| C1 | Git `32b1c9e43fbaede862116ef6241fa9defba39b90`, AGPL-3.0. Select `webUI/drum_cnn.onnx`, SHA `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`, 2,852,169 bytes, 3×7×96 input. Root legacy graph is different (80 bins) and is not a second benchmark lane. Minimal CPU inference passes. Use published server API privately; no covered code goes into a distributed Kora package. |
| C2 | HF revision `771fd5529062b9f6f0b58f01cc4b9819db046f4a`, SHA `23d4b05ce7e9715bdb4396823d68bc886e8a958fa9f6266c0f7132b78098b521`, 5,966,247 bytes, Apache-2.0 claim. Original Magenta E-GMD checkpoint `model.ckpt-569400`; ONNX is a conversion, not semantic novelty. No matching prior Kora OAF experiment found in local assets, reports or Git string history. Bidirectional LSTM confirms future context; minimum CPU inference passes. |
| C3 | HF `f510fb1dbdd968e3218f64e8d7ac1af0fafdb6e2`, SHA `313dcb93e0ed60f52280cd20f2145f32110ffa6f450ce157a69846e16642dd5f`, 335,086,851 bytes, MIT claim. Original EyeLike kernel fails ORT. One equivalent Range/Equal/Cast lowering preserves all original initializer bytes; 40 s minimum graph inference passes (~5.7 s), fixed reshape prevents a shorter inference window. Record the derivative separately and test operator equivalence. Official Demucs `_spec/_mask/_ispec` defines external complex preprocessing. Hat identity from Cymbals remains unqualified. |
| C4 | Git `77dbef225e7029478ebfb916f20c7a00274f0f12`; author code CC BY-SA 4.0, HF weight scope not separately declared. HF `a33c5c6b191a4ca1e0f6dc22140947485eb36ce8`; tau-0.8 safe weight SHA `f94d1773d929166e0a3f63d305975aa6667512f8a71d7706872e1f8b23ca930b`, 289,134,056 bytes. Root checkpoint has identical SHA, so it is skipped. Minimal official CPU tensor-input transcription passes. 24 kHz, 2.56 s chunks, autoregressive Transformer; not live-qualified. |
| C5 | Git `0ac2fe6a35a7968d70ecfb8866cad025c350f5bd`, HF `5384a5dcf7456ea5876de2b350438f0cfbe34726`, released weights exist (each ~5.4 GB). BLOCKED inference dependency: both required official Zenodo VAE/vocoder checkpoint URLs return HTTP403. The author also specifies Linux/Python3.9/CUDA; no CUDA or running Linux container exists locally, and resolution on the selected Python ABI fails. That ABI choice alone is not the acquisition blocker. Inference NOT RUN; no unsafe deserialization and no claimed model performance. No multi-GB model download after required support checkpoints fail. |
| C6 | Git `ef2a36c062341ab0ea585874259ea396a94ae362`, MIT wrapper. ADTOF-dependent complete pipeline; not an independent semantic detector. Its own notices identify unlicensed ADTOF-pytorch and unstated MDX23C weight terms. BLOCKED licensing/rights for the complete default dependency chain. Existing baseline results do not establish equivalence to this wrapper's unacquired weights. No complete-pipeline performance is claimed. |
| C7 | Git `0cb980a11e9ba1a37cbafddec1e85c66d8ffa236`, MIT code. Colab is accessible; Drive link returns `yolov4.weights`, size 256,231,380. Supplied one-channel 11-class `tri2.cfg` expects 256,229,076 bytes under its convolution serialization contract. Difference 2,304 bytes equals two extra first-convolution input channels. Usable drum-checkpoint equivalence is unverified; notebook expects another filename. BLOCKED inference/usable checkpoint contract, no retraining or guessed architecture conversion. |

First-stage HTDemucs uses official safe checkpoint `955717e8`, HF
`adefossez/HTDemucs` at `cbc8a9b1a87023b7fd74e7b3412e6321c0eab003`, SHA
`d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd`,
84,025,440 bytes. Metadata class is checked as `demucs.htdemucs.HTDemucs` before
loading; no pickle is used. A real two-second CPU separation passes. Include its
measured cost in every derived full-mix pipeline. It is a separator, not a detector.

## Corpus and reuse

`scratch/beat-grid-v2/corpus-manifest.json` freezes 65 canonical WAV inputs: 17
existing controlled/listening files preserving the original float PCM exactly, plus paired
drum-only/full-mix excerpts for all 23 original MDB Drums tracks. Original-author
repo `CarlSouthall/MDBDrums` at `b29e2d63c3a023506f4bf353c5b2e8a558eed135`,
93 source files, no download errors. Published manual-review class annotations are
external independent dataset references, not provisional user marks and not a new
claim of perfect coverage. Keep possible omissions and training overlap unknowns.
The MDB++ alternative was inspected but is not the selected scoring corpus.

MDB canonical inputs use the first 20 s (or full shorter duration), score 1 s to
duration−1 s, preserve amplitudes and raw classes. Fixed track-hash split keeps
paired inputs together: 12 development items, 51 locked holdout items total. No
tuning on either. IDMT API/direct archive both returned HTTP403; no bypass. That
limits independently annotated isolated/electronic control coverage. Existing
controlled signals are synthetic; real timbre diversity comes from MDB recordings.
All nine unverified listening excerpts remain accuracy-ineligible. Two missing
requested synthetic controls (isolated Kick and weak dense Hats beneath loud drums)
were added before scoring. The old review WAVs are 16-bit; canonical FLOAT WAVs use
the original F32 PCM, preventing quantization from invalidating baseline reuse.

## Evidence-contract repairs before scoring

Deterministic canonical WAVs omit libsndfile's mutable PEAK timestamp. Reconstructing
that timestamp reproduces all 46 original MDB input SHA values exactly, proving
decoded PCM equivalence. The alias generator now reproduces this proof against the
canonical files and records both container hashes. Only nine separator outputs
based on the earlier quantized listening WAVs were invalidated and regenerated.
The 17 baseline trace replays and 23 valid MDB separator outputs were retained.

The separator originally seeded its shift from the container hash. Historical
numeric seeds are now retained explicitly with each original stem, rather than
claiming that a different seed yields the same output. Future inputs derive their
seed from decoded PCM. A documented post-execution compatibility attestation
preserves 95 original records and binds unchanged inference code, model, dependencies,
raw output and input identities. Replay-only BASE runtime fields are null.

C1's initial full API call stalled in Windows async socketpair creation before
inference. A read-only process stack proved the cause; an unrestricted local host
passes the same event-loop probe and the published API completed normally. No
model/preprocessing workaround was introduced. The failed managed-Python install
and uv freeze cache access error remain setup evidence; package metadata supplies
the exact environment freeze. Own stalled processes were stopped.

The user requested the private listening service again during the sweep. PID 5240
now owns ports 5173/5174; both pages return HTTP200 and are intentionally retained.
Exclude runtime samples overlapping that short rebuild; do not rerun predictions
or use the restored page as evidence of V2 qualification.

Local historical inventory also contains four source-separator ONNX models and
128-frame reexports under `scratch/instrument-proof`; compare their initializer
fingerprints to recognize duplicate exports rather than new models. Current
`local-model-inventory.json` includes small `.pth` path/import files discovered by
extension; those are not trained checkpoints and must be excluded from model counts.

## Evidence locations and next work

All raw data remain in ignored `scratch/beat-grid-v2`: acquisition sources, HF
manifests, checkpoint manifest/download logs, graph identities, minimal inference
logs, dependency installation logs, corpus/reference manifests and access failures.
Source acquisition initially included needless onset JSONs, was stopped (normal
termination refused, task-owned PID force-stopped), corrected and completed. No
duplicate downloader is left. Test process sessions have completed; reconcile
processes again before clean benchmarks. Prior review-server PID was 37640.

At the earlier execution checkpoint, the registry, dependency freeze and 32
first-stage stems were complete. BASE, C1, C2, C2-separated and C3 completed the
original 63 inputs; C4 was running. The two
additional completeness controls will receive every applicable lane in the same
round. Raw classes/activations, stems and normalized events are retained. C4's
released YAML sets max_length512, overriding the helper's 1024 fallback. No value
was changed; a weak/strong Hat input exposed substantially slower autoregression.

The remaining work at that checkpoint was to finish inference and strengthen raw/replay validation
guards without repeating unchanged neural results, score the immutable reference
receipt, compare correctness/runtime/rights, review, integrate only if qualified,
run final regressions and deliver one architecture decision/report. All are now
completed as recorded in the final report; these checkpoint notes preserve the
execution history rather than define a new work cycle.

## OAF output-contract repair, identified within the round

The published eight-column export selects pitch42 for Hi-Hat. The exact Magenta
revision named inside that model, `c15687ebd1c1cc12658cd468c737d3c24c02b918`, maps
the eight-class HH/Tambourine/Maracas group to base pitch46. Both original mapping
and configuration were fetched at that pinned revision and hashed. On a natural
drum input the exported pitch42 channel peaks below 1e-6, consistent with selecting
an untrained output. This invalidates the published export's Hat evaluation; it
does not establish that the underlying OAF detector cannot recognize Hats.

One bounded repair changes only nonlearned Gather `columns[3]` from 21 to 25
(pitch minus21); all learned initializer bytes and graph operations remain equal.
Preserve the original model and original C2 results as invalid-selector diagnostic
evidence. `c2-output-contract-repair.json` binds both artifacts, the official source
map and the exact change. This is the same trained detector with its output contract
restored, not a new technology or a second threshold/model-selection cycle.

The saved raw outputs contain only eight selected columns, omitting trained pitch46;
they cannot recover the missing neural output without executing the prefix. Repeat
only affected C2/C2-separated inference after the current C4 process finishes, and
assert parity of the seven unchanged output columns against the preserved results.
Reuse all unaffected lane outputs and all existing first-stage stems. No tau,
threshold, audio, annotation or holdout partition changes are authorized by this repair.

## CPU batching adjustment within the same C4 detector

The released batch-eight route took about 388–396 s on several 14–15 s inputs because
finished rows still pass through the decoder until the slowest row finishes.
Read-only review found no cross-row semantic interaction in evaluation mode.
The author's supported batch_size1 override preserves the same checkpoint,
preprocessing, 2.56 s chunks, greedy decode and max_length 512. Kernel-shape rounding
could theoretically affect a near-tied argmax, so exact ordered raw-note parity
was required before semantic reuse.

Two completed six-chunk inputs passed exactly: weak/strong Hats, 25 notes,
395.7 to 64.6 s neural time; XO, 148 notes, 29.0 to 20.4 s. No completed eight-chunk original
batch was available; unprobed completed inputs were not rerun. All 15 completed
batch8 records retain their original execution identity and times, with a separate
parity attestation. The incomplete Pop batch8 call was intentionally stopped;
normal process termination refused, so only the owned worker tree was force-stopped.
The remaining 50 C4 inputs completed at batch one. Batch-eight and batch-one runtime summaries stay
separate; this execution-layout change is not a new detector or new quality round.

Final validation guards bind raw JSON events, declared NPZ existence/hashes,
baseline replay traces, complete model/pipeline/dependency identities, immutable
corpus/annotations and separator seeds. The 236 valid earlier executions were retained
without neural repetition; original records remain archived. Separator preparation
and output serialization were measured separately once per 32 inputs and added as
explicit stage-sum cost, not misrepresented as a new interleaved end-to-end run.

## Final evidence and disposition

All 357 model results and 32 first-separator records validate. C2's corrected 97
results include 95 exact seven-column onset/velocity parity checks; the two added
controls have no earlier counterpart. C4 retains 15 original batch-eight executions
plus 50 batch-one executions. No duplicate checkpoint or unaffected neural run was
repeated merely to refresh validation metadata.

TorchAudio 2.8.0+cpu was already recorded by the 15:09 installation log and the
pre-C4 117-package freeze. The final guard-only migration binds that build, proves
the complete inference source unchanged, and preserves original records and the
actual parity-probe execution fingerprint. All 389 records retain identical
predictions and timing fields. Changing the TorchAudio build invalidates cache
compatibility; its regression test passes.

The final comparison has 606 scored views and 54 unscored listening records.
The 208-case ledger contains explicit uncertainty and no official accuracy from
human provisional marks. The matched runtime view uses the same 21 natural full
mixes for every lane, excluding the two C3 rebuild-overlap mixes from all lanes.
All replacements fail the natural public-row recognition gate. No V2 adapter,
listening package, deployment or new technology-selection cycle is warranted.
