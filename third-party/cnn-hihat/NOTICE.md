# Hi-Hat CNN used by the Kora Music Companion

Kora is open source and non-commercial. The Companion's Hi-Hat row uses this
model, the same one as the private lab's "B" / "H" Hi-Hat track.

## Frame Level Drum Classifier (the model)

- Source: https://github.com/FrancescoZumo/frame_level_drum_classifier
  at commit 32b1c9e43fbaede862116ef6241fa9defba39b90 (webUI/drum_cnn.onnx).
- License: GNU AGPL-3.0, full text in CNN-LICENSE.txt. The Companion package that
  carries this model is distributed under AGPL-3.0; its source is the Kora repository.
- model.onnx SHA-256: 785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db
- Trained on the STAR dataset (https://zenodo.org/records/15690078); see
  CNN-README.source.txt. Used for non-commercial purposes only.

## wasm-audio-resampler 2.0.0 (SoXR in WebAssembly)

- Source: https://github.com/geekuillaume/wasm-audio-resampler
- Wrapper license: MIT, in WRAPPER-LICENSE.txt.
- It compiles SoX Resampler (libsoxr, https://sourceforge.net/projects/soxr/),
  licensed LGPL-2.1-or-later. libsoxr source is available from that project.

## coefficients.json

Frontend filter coefficients derived for the live port of the model's
spectrogram (scripts/cnn-browser-frontend.mjs). No audio is included.
