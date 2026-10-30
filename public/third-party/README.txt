Kora non-commercial staging evaluation: third-party audio assets

ADTOF: https://github.com/MZehren/ADTOF
Original project authors: M. Zehren, M. Alunno and P. Bientinesi.
PyTorch conversion described by: https://github.com/xavriley/ADTOF-pytorch
PyTorch conversion attribution: Xavier Riley and the upstream project contributors.
Upstream license: Creative Commons Attribution-NonCommercial-ShareAlike 4.0.
The complete upstream text accompanies this notice in ADTOF-LICENSE.txt.
Upstream attribution and source references must be retained with redistribution.

The frozen percussion model used by Kora is an ONNX adaptation of the ADTOF
model described in the PyTorch conversion repository. Its SHA-256 is:
c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a
The converted model is provided for non-commercial evaluation under the
upstream CC BY-NC-SA 4.0 terms. All 35 ONNX initializers exactly match all
50 upstream checkpoint tensors after float32 conversion, GRU gate packing
and output-matrix transpose. The pinned checkpoint and conversion details
are recorded in adtof-model-provenance.json. The historical export script
has not been recovered. This notice does not represent separate commercial
permission or declare the complete public release qualified. Model bytes
are unchanged. Keep this attribution, modification record and license
with redistributed copies; the model portion retains CC BY-NC-SA 4.0.
Kora's MIT code license does not override the model's license conditions.

ONNX Runtime Web 1.30.0: https://github.com/microsoft/onnxruntime
Copyright (c) Microsoft Corporation. All rights reserved.
Its MIT license and upstream third-party notices accompany this file.

This staging build does not distribute a replacement Windows installer or
Music Companion package. Private Hybrid CNN and SoXR experiments are not
enabled by the Opal presentation switch.
