# Private Melody repair: the missing middle phrase is recovered, but closure remains blocked

The user confirms that the revised H.S.K.T. 16–21-second passage follows the voice. However, Nujabes and other excerpts still sound wrong. Broader representative Melody listening therefore fails. The specific continuation repair is preserved, but it is not a completed Melody release.

## What caused the missing phrase

The saved H.S.K.T. input contains 11 Basic Pitch vocal candidates beginning between 16 and 21 seconds. Seven pass the existing amplitude floor but last only 106–152 ms. The selector discarded them before phrase construction because its standalone duration floor was 160 ms. Two longer candidates survived, but their isolated islands failed the minimum phrase-size check. Two other candidates remain below the amplitude floor. The previous output selected zero vocal notes in this interval.

The missing candidates therefore originate in postprocessing, rather than normalization, transport or rendering. The gap in the previous ownership timeline runs from 15.787 to 21.027 seconds. User listening establishes that vocals continue there; candidate timestamps alone are not human note ground truth.

A first experiment admitted short notes directly into general phrase construction. It merged much of H.S.K.T. into one long phrase, removed important ownership checkpoints and kept accompaniment in control. That experiment is rejected and preserved privately.

The revised `primary-melody-phrases-v3` candidate reconnects only two independently confident phrases from the same source when measured pitched candidates bridge the interval continuously. It retains the existing amplitude floor, anchor phrase scores, anchor start checkpoints and ownership hysteresis. The bridge uses the existing pitch-transition and temporal-continuity checks, monophonic selection and same-pitch retrigger merge. An isolated short fragment, absent audio or disconnected pitch jump cannot manufacture a continuation. This applies equally to vocals and instruments, with no song or vocal priority.

H.S.K.T. now selects nine measured vocal attacks in the reported interval and retains vocal ownership from 11.233 to 29.554 seconds. Total selected attacks change from 46 to 57. The user accepts this passage in listening. Counts do not establish correctness or recall.

## Full-excerpt review and broader effects

The approximately 0.128–11.233-second region still selects the guitar candidate. This is a distinct ownership problem: an early guitar phrase scores 0.736 against a vocal phrase scoring 0.574; subsequent ownership inheritance retains accompaniment until the stronger vocal phrase begins at 11.233 seconds. Basic Pitch vocal candidates are present. No vocal override or global confidence relaxation was applied to hide this failure.

The same repair was run on all 11 unchanged audio/candidate inputs. Hysteria changes from 64 to 50 attacks as reconstructed vocal ownership replaces some guitar attacks. Take Five changes from 51 to 52; Ambient keeps 65 attacks but changes one ownership handoff. The remaining excerpts keep their previous total attack counts. These ownership changes require listening, not an accuracy claim. Gymnopédie remains particularly sparse at three selected attacks.

The comparison remains available at [the private local listening page](http://127.0.0.1:5173/src-tauri/target/melody-closure/listen.html). Refresh it and verify the displayed version is `primary-melody-phrases-v3`. It contains original audio, Melody attack clicks, synthesized selected pitches, ownership and attack timestamps. Synthesized pitches are explicitly labeled and are not an isolated recorded voice.

Private evidence is under `src-tauri/target/melody-closure`: `hskt-vocal-gap-diagnostic.json`, the current report and audio, and preserved source/results for the original failed tracker, initial phrase candidate and rejected short-note experiment. No evaluation audio, model weights or personal annotation exports are committed.

## Frozen baseline and verification

Rows 1–3 remain the user-accepted precomputed ADTOF development baseline, model SHA-256 `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`, with the recorded thresholds and timing configuration unchanged. The seven frozen detector/delivery/render source hashes still match. Bass is unchanged. The original failed PrimaryMelodyTracker source matches its preserved copy.

The user's MONO, Levels and Weightless annotation lists identify wrong flashes, not true drum attacks; they are not used as positive training or precision/recall labels. Other listened-to precomputed excerpts were accepted, while Caravan remains visually unverified. The supplied render trace contains 450 cached semantic animations with no type-to-row mismatch.

Regression tests cover supported short-note continuations, unchanged anchor scores/checkpoints, forbidden source priors, isolated fragments, disconnected timing/pitches, retrigger suppression, monophony and bounds. The final full suite passes 105 files and 757 tests. Type checking, scoped ESLint and the web build pass; the build retains its chunk-size warning. The isolated Edge check validates all 11 audio durations, nonoverlapping selected notes, seek/play/pause preservation and judgment export, with zero page errors. Switching comparison audio preserves playback position within 33 ms; this is not detector or animation latency. It does not establish perceptual accuracy or a new ordinary-playback/Modal end-to-end result.

The initial Python test run failed because the sandbox denied temporary-directory access. The unsandboxed rerun passed all 24 server tests. The current new holdout reused authorized local MONO audio: 30 seconds took 50.312 seconds through the existing heavy CPU analysis. This is not a remote Modal or first-playback capture measurement. Unchanged cached playback latency evidence remains in [the percussion comparison report](validation-261008-2052-percussion-playback-comparison.md).

## Gates, application and rollback

| Gate | Result |
| --- | --- |
| Percussion baseline | Accepted for development, with known flagged errors |
| Bass | Unchanged |
| H.S.K.T. middle-phrase diagnosis | Confirmed in postprocessing |
| H.S.K.T. 16–21-second continuation listening | PASS, confirmed by the user |
| Broader Melody listening | FAIL: Nujabes and additional songs remain wrong |
| Phase 4 final integration | FAIL exit gate; integration is withheld |
| Phase 5 | Not started |
| Ordinary capture to Modal/cache/playback | Still unverified for this candidate |
| Commercial production rights | Blocked by unresolved ADTOF noncommercial obligations |

[ADTOF](https://github.com/MZehren/ADTOF) identifies noncommercial licensing obligations; ONNX conversion or cached output is not treated as clearance. [Basic Pitch](https://github.com/spotify/basic-pitch) uses Apache 2.0 and [Demucs](https://github.com/facebookresearch/demucs) uses MIT, but those licenses do not clear the combined percussion pipeline, user audio, all binary dependencies or production capture privacy. Capture consent, temporary-input retention/cleanup and the prepared audio-input migration still require the gated production review.

No cache/Modal default, renderer, scheduler, merger, database, hosted storage or production deployment changed in this pass. No commit or Phase 5 hardening is claimed while the required quality gate remains open. The selector remains explicitly private/opt-in through `--phrases`; preserving the default and recoverable local snapshots keeps this repair from silently replacing the accepted playback path. The journal CLI failed with `Command failed`; a native write retained the session record under `plans/journals`.

## Unresolved questions

1. Which perceptual-role evidence can distinguish the main line from coherent accompaniment across the broader set? Nujabes remains wrong; its 31-attack output is unchanged by this continuity repair. No further automatic threshold, model or training cycle is started.
2. Early H.S.K.T. accompaniment ownership remains a concrete quality blocker. A further bounded ownership repair requires evidence beyond forcing vocals or weakening the gate.
3. Real bounded playback input, ordinary cached Melody rendering, production rights and privacy gates remain necessary before Phase 5 or deployment.
