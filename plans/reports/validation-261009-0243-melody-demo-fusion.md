# Private Melody comparison in the existing Beat Grid

Implemented at [the existing debug route](http://127.0.0.1:5173/beat-grid?musicDebug=1). Refresh, expand **Beat debug**, and click **Use saved Melody demo**. Pause unrelated YouTube music; press Play in the fixture player. Start with Gymnopédie piano and switch the **Row 5 Melody detector** selector. **Return to live Beat Grid** releases the fixture player.

The four modes are MELODIA Baseline, Basic Pitch Only, MELODIA + Basic Pitch Fusion, and Side-by-side A/B. A/B mounts two instances of the existing `SemanticBeatPattern`, each still 5×8, against one audio element and the existing fixture clock/scheduler. Rows 1–4 receive no fixture events; their live processing is unchanged. No new renderer or independent playback timer was created. Existing listening pages remain available.

## Matching inputs and one bounded experiment

Saved piano/vocal Basic Pitch candidates were matched to the decoded stem samples, crop boundaries and original offsets. Three matching original-mixture Basic Pitch ONNX runs were saved using the existing model/parameters; no separation, MELODIA inference, model training or parameter sweep occurred. Stem Basic Pitch used saved 30-second analysis context; the corresponding MELODIA baseline analyzed the saved shorter passage. This context difference is explicit in the sidecar provenance.

The fixed private [fusion policy](../../src/features/music/diagnostics/melody-detector-fusion.ts) deduplicates pitches, abstains on ambiguous simultaneous candidates, and produces a monophonic Basic Pitch comparison. Fusion protects every baseline onset/pitch/offset; additions require a distinct baseline gap and sufficient duration/spacing. Available voiced F0 disagreement vetoes an addition; absent F0 requires stronger isolated Basic Pitch evidence. Decisions are exported. **Model activations are not calibrated probabilities, and an accepted experimental proposal is not proof of primary-melody identity.**

| Input | Unchanged baseline | Raw BP proposals | BP-only selected | Fusion additions | Fusion total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Gymnopédie piano, 0–10 s | 7 | 51 | 9 | 3 | 10 |
| Gymnopédie original, 0–30 s | 19 | 149 | 20 | 8 | 27 |
| H.S.K.T. vocals, 16–26 s | 34 | 29 | 16 | 1 | 35 |
| H.S.K.T. original, 0–30 s | 111 | 160 | 34 | 0 | 111 |
| Nujabes original, 0–30 s | 89 | 9 | 0 | 0 | 89 |

Nujabes has no confident BP-only output under this candidate. Its fusion intentionally equals baseline. The seven piano-stem events remain independent and exact; output was not forced to the listener's estimated 12 attacks. Added pitches may still be accompaniment or octave errors. **Musical acceptance remains pending human listening.**

## Diagnostics and validation

Counters expose total, played, latest onset, owner/source and MIDI pitch. Original, analyzed-input and raw BP auditions reuse one player. `Record 30 seconds` stops at the passage boundary or a clock/detector/input discontinuity. Trace export includes per-lane semantic commits/animations, target time, actual playback time, source, detector, MIDI, experimental/unverified flags, policy decisions, Phase 0 telemetry and human missed/extra/timing/pitch markers. Remounted detectors receive fresh event identities to preserve previously captured provenance.

The [isolated Edge check](../../scripts/check-melody-detector-demo.mjs) verified all modes, paused/playing position-preserving switches, seek/replay/pause, unique identities, one player, baseline preservation, monophony, zero Rows 1–4 fixture hits, marker/export metadata and cleanup. Both A/B lanes rendered the complete prepared passages:

| Input | Baseline / fusion DOM commits | Median / p95 commit delay | Animation starts |
| --- | ---: | ---: | ---: |
| Gymnopédie stem | 7 / 10 | 12.6 / 24.0 ms | 17 |
| H.S.K.T. stem | 34 / 35 | 10.2 / 17.1 ms | 69 |
| Nujabes mix | 89 / 89 | 9.3 / 18.2 ms | 178 |

Delay means actual DOM commit media position minus target onset; it is neither audible-output latency nor a musical-accuracy score. Compact A/B controls fit a 380-pixel content width with vertical scrolling and no horizontal overflow. Browser evidence is in [browser-check.json](../../src-tauri/target/melody-detector-demo/browser-check.json), alongside three row traces and `demo-grid.png`. These generated artifacts remain local/ignored.

Full Vitest suite: **108 files, 776 tests passed**. Final focused regression: **44 tests passed**. Typecheck and changed-file lint passed. Production Vite build passed; private demo strings/modules are absent from its JavaScript. Existing Vite import/chunk and percussion-asset warnings remain outside this change. **203 protected hashes match**, covering preserved model/diagnostic outputs; only the existing private adapter's metadata and development-only route entry were intentionally extended.

The in-app browser runtime could not load because of Windows EPERM. Browser validation therefore mounted the actual MusicGrid component in isolated Edge; it does not establish a signed-in full-shell test. The existing port 5173 server (PID 3132) was reused. Test browsers exited. No publication, production Melody integration, Modal/database change, or later phase was performed. Stop for listening review.
