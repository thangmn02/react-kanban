# Instrument note release verification

Release: Kora 0.1.12 and Music Companion 0.3.12, approved publication with an
instrumental-attack correction discovered during live verification.
Scope and accepted trade-offs: [active plan](../261005-2350-main-instrument/plan.md).
The confirmation redirect and default Tabs changes remain queued separately.

Reviewed capture lifecycle, source identity, model integrity and local loading,
bounded inference/event queues, synchronized audio routing, transport validation,
dominant-note tracking and independent fifth-row flashes. No unresolved blocking
source findings remain. Failed or late inference keeps the fifth row dark.

Validation completed on 2026-10-06:

- Focused checks: 78 tests passed; full quality gate passed, final suite 543 tests in 75 files,
  coverage, TypeScript, lint, production build and bundle budget passed.
  Lint retains 23 existing warnings and zero errors.
- Real ONNX inference on three labeled MUSDB excerpts: instrumental and mixed
  inputs produced attacks; vocal-only, drum-only and bass-only inputs produced
  zero attacks in all three excerpts. These are sample observations, not
  ground-truth transcription counts or a guarantee across all music.
- Actual AudioWorklet/DelayNode playback under the extension's script policy:
  four piano attacks produced four audible attacks and four flashes; worst
  local browser audio/event offset 31.93 ms; the actual deployed worker's
  offset was 60.96 ms, with no runtime errors in either run. The eight real-model
  onset-alignment cases each produced four attacks. This excludes physical
  speakers, Bluetooth and native bridge/rendering latency.
- Signed native build and final web build passed. Updater signature verifies;
  altered installer bytes fail verification. Installer SHA-256:
  `3357301f3f68930413d0c9a00e865716928c291cdf56df54b4e43d428209e26d`.
- Both local companion ZIP aliases are identical: 32 entries, 14,433,653 bytes,
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
`scripts/verify-instrument-playback.mjs`, `scripts/verify-instrument-stems.mjs`
and `scripts/verify-instrument-onsets.mjs`.

The initial release was published at commit dbff255; the Contact-test wait fix
at c559cf0 passed CI and Windows build. Both production domains served the
matching installer/feed, 32-entry companion package and AI setup UI. Netlify
uses the npm-locked bundler, so its generated worker differs from the local
pnpm build. Live worker playback exposed the faint-leading-attack double count;
stable pitch confirmation and growing-attack refinement fix that cause.
All three excluded stems stayed dark on all three excerpts after the fix.

Companion 0.3.12 and the refreshed signed installer are published at a605a6b.
Both production domains serve the matching feed/installer and companion sources
and runtime assets. Live companion SHA-256 is
`8d1cb1ee3cdf2befed611078602915926270b2655a40109d4412d6bce3c6d0e1`;
the actual deployed worker passed all eight onset alignments and playback.
Final checks passed for release commit a605a6b:
[quality, database and E2E CI](https://github.com/thangmn02/react-kanban/actions/runs/37358575214)
and [Windows tests/signed build](https://github.com/thangmn02/react-kanban/actions/runs/37358575227).
Publication and verification are complete. No installation was performed. Rollback: republish
the last stable Kora 0.1.11 deploy for commit af69745 through Netlify's dashboard.
