# Instrument note release verification

Release: Kora 0.1.12 and Music Companion 0.3.11, approved for publication.
Scope and accepted trade-offs: [active plan](../261005-2350-main-instrument/plan.md).
The confirmation redirect and default Tabs changes remain queued separately.

Reviewed capture lifecycle, source identity, model integrity and local loading,
bounded inference/event queues, synchronized audio routing, transport validation,
dominant-note tracking and independent fifth-row flashes. No unresolved blocking
source findings remain. Failed or late inference keeps the fifth row dark.

Validation completed on 2026-10-06:

- Focused checks: 78 tests passed; full quality gate: 540 tests in 75 files,
  coverage, TypeScript, lint, production build and bundle budget passed.
  Lint retains 23 existing warnings and zero errors.
- Real ONNX inference on three labeled MUSDB excerpts: instrumental and mixed
  inputs produced attacks; vocal-only, drum-only and bass-only inputs produced
  zero attacks in all three excerpts. These are sample observations, not
  ground-truth transcription counts or a guarantee across all music.
- Actual AudioWorklet/DelayNode playback under the extension's script policy:
  four piano attacks produced four audible attacks and four flashes; worst
  browser audio/event offset 29.03 ms, no runtime errors. This excludes physical
  speakers, Bluetooth and native bridge/rendering latency.
- Signed native build and final web build passed. Updater signature verifies;
  altered installer bytes fail verification. Installer SHA-256:
  `ab329a80a77c009db4ce1ec30f8f279d8db6280efc2c823a1d91f336796dd6a5`.
- Both companion ZIP aliases are identical: 32 entries, 14,433,469 bytes,
  including local worker/WASM/worklet and license notices. Package inspection
  found no model weights, tests or private configuration.
- Whitespace check and release source scan passed. All verification browsers
  and servers closed; no verification listener remains on port 1431.

Known limits: opt-in downloads total about 157 MB and use 3.5 seconds of audio
buffering. Spleeter's instrumental stem can contain multiple instruments;
the dominant harmonic tracker cannot guarantee exact note-for-note isolation
in arbitrary mixed songs. First-time options-page downloads and live installed
browser/full-song listening remain unverified. Captured audio stays local and
is not retained on disk. Repeatable verification tools are
`scripts/verify-instrument-playback.mjs` and `scripts/verify-instrument-stems.mjs`.

Publication, deployment and installation have not been performed for this release.
