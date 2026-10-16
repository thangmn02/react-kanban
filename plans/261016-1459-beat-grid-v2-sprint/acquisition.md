# Acquisition checkpoint

Acquisition completed on 2026-10-16; no scored quality benchmark started yet.
The next step is the standardized inference round, after writing the final novelty
and reuse registry from the acquired fingerprints. User's latest constraint remains
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
| BASE | Same ADTOF ONNX SHA `c571062d…ea05`, 1,815,198 bytes, 35 duplicate local copies. Reuse the 17 unchanged activation traces and actual-browser evidence when contracts match; new MDB inputs need new predictions. No original-weight provenance beyond existing notice is invented. |
| C1 | Git `32b1c9e43fbaede862116ef6241fa9defba39b90`, AGPL-3.0. Select `webUI/drum_cnn.onnx`, SHA `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`, 2,852,169 bytes, 3×7×96 input. Root legacy graph is different (80 bins) and is not a second benchmark lane. Minimal CPU inference passes. Use published server API privately; no covered code goes into a distributed Kora package. |
| C2 | HF revision `771fd5529062b9f6f0b58f01cc4b9819db046f4a`, SHA `23d4b05ce7e9715bdb4396823d68bc886e8a958fa9f6266c0f7132b78098b521`, 5,966,247 bytes, Apache-2.0 claim. Original Magenta E-GMD checkpoint `model.ckpt-569400`; ONNX is a conversion, not semantic novelty. No matching prior Kora OAF experiment found in local assets, reports or Git string history. Bidirectional LSTM confirms future context; minimum CPU inference passes. |
| C3 | HF `f510fb1dbdd968e3218f64e8d7ac1af0fafdb6e2`, SHA `313dcb93e0ed60f52280cd20f2145f32110ffa6f450ce157a69846e16642dd5f`, 335,086,851 bytes, MIT claim. Original EyeLike bool op fails ORT. One equivalent Range/Equal/Cast lowering preserves all original initializer bytes; 40 s minimum graph inference passes (~5.7 s), fixed reshape prevents a shorter inference window. Record the derivative separately and test operator equivalence. Official Demucs `_spec/_mask/_ispec` defines external complex preprocessing. Hat identity from Cymbals remains unqualified. |
| C4 | Git `77dbef225e7029478ebfb916f20c7a00274f0f12`; author code CC BY-SA 4.0, HF weight scope not separately declared. HF `a33c5c6b191a4ca1e0f6dc22140947485eb36ce8`; tau-0.8 safe weight SHA `f94d1773d929166e0a3f63d305975aa6667512f8a71d7706872e1f8b23ca930b`, 289,134,056 bytes. Root checkpoint has identical SHA, so it is skipped. Minimal official CPU tensor-input transcription passes. 24 kHz, 2.56 s chunks, autoregressive Transformer; not live-qualified. |
| C5 | Git `0ac2fe6a35a7968d70ecfb8866cad025c350f5bd`, HF `5384a5dcf7456ea5876de2b350438f0cfbe34726`, released weights exist (each ~5.4 GB). BLOCKED inference dependency: author Linux/Python3.9/CUDA environment, no CUDA hardware or running Linux container. Actual dry-run resolution of released torch1.13.1+cu116 on current ABI fails. Inference NOT RUN; no unsafe deserialization and no claimed model performance. No download of multi-GB weights after this gate failure. |
| C6 | Git `ef2a36c062341ab0ea585874259ea396a94ae362`, MIT wrapper. ADTOF-dependent complete pipeline; not an independent semantic detector. Its own notices identify unlicensed ADTOF-pytorch and unstated MDX23C weight terms. BLOCKED licensing/rights for the complete default dependency chain. Existing baseline results do not establish equivalence to this wrapper's unacquired weights. No complete-pipeline performance is claimed. |
| C7 | Git `0cb980a11e9ba1a37cbafddec1e85c66d8ffa236`, MIT code. Colab is accessible; Drive link returns `yolov4.weights`, size 256,231,380. Supplied one-channel 11-class `tri2.cfg` expects 256,229,076 bytes under its convolution serialization contract. Difference 2,304 bytes equals two extra first-convolution input channels. Usable drum-checkpoint equivalence is unverified; notebook expects another filename. BLOCKED inference/usable checkpoint contract, no retraining or guessed architecture conversion. |

First-stage HTDemucs uses official safe checkpoint `955717e8`, HF
`adefossez/HTDemucs` at `cbc8a9b1a87023b7fd74e7b3412e6321c0eab003`, SHA
`d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd`,
84,025,440 bytes. Metadata class is checked as `demucs.htdemucs.HTDemucs` before
loading; no pickle is used. A real two-second CPU separation passes. Include its
measured cost in every derived full-mix pipeline. It is a separator, not a detector.

## Corpus and reuse

`scratch/beat-grid-v2/corpus-manifest.json` freezes 63 canonical WAV inputs: 17
existing controlled/listening files byte-identical to previous corpus, plus paired
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
All nine unverified listening excerpts remain accuracy-ineligible.

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

Next: finish canonical learned-identity/reuse registry and dependency freeze;
validate EyeLike equivalence; prepare first-separator cache with recorded source
hashes/cost; run BASE (reuse 17 valid traces), C1, C2 raw/intended/derived-stem, C3 and
C4 sequentially with equal declared CPU resources. Preserve raw classes/activations,
stems and normalized events. Use one-to-one strict rapid-onset matching, separate
display-row and true Hat identity, and never score provisional listening labels.
Then compare correctness/runtime/rights, review, integrate only if qualified, run
final regressions and deliver one architecture decision/report. No conclusion yet.
