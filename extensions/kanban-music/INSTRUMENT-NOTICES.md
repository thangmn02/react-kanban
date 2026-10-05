# Local instrumental analysis

Model: Deezer Spleeter 4-stem pretrained weights, MIT license, converted to
ONNX by Best Practice using Xiaomi's Apache-2.0 Spleeter port. The conversion
uses the 4-stem model's ELU activations. Model download provenance and SHA-256
hashes are maintained in `instrument-models.js`.

- https://github.com/deezer/spleeter/blob/master/LICENSE
- https://github.com/deezer/spleeter/blob/master/paper.md
- https://github.com/madewith-bestpractice/spleeter-4stems-onnx
- https://huggingface.co/Best-Practice/spleeter-4stems-onnx

The model separates vocals, drums, bass and remaining instruments. The final
stem can contain several instruments. A harmonic profile selects a dominant
note line; this does not guarantee isolation of a named instrument, every
note, or complete rejection of stem leakage. No pitch transcription is shown.

Only the input/output time dimension and exported intermediate shape metadata
are adapted for 128-frame inference; weights/operators are unchanged. Runtime
code is bundled locally. Audio stays in bounded volatile memory, is never
uploaded, and is discarded when capture stops. Cache Storage holds only model
weights. Original audio passes through a 3.5-second delay for synchronization.

ONNX Runtime Web (Microsoft, MIT) and fft.js (Fedor Indutny, MIT) notices are
included in `THIRD-PARTY-LICENSES.txt` in the packaged extension.
