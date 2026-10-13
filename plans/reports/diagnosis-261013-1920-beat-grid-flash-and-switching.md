# Beat Grid flashes and switching: investigation

Date: 2026-10-13, Asia/Saigon. Inspected checkout: `main`, `2ae6703`.
Scope: diagnosis and an implementation plan. No product code, installed extension,
installer, playback session, or deployment was changed.

## Outcome

The rollback is present. The remaining problem needs two ordered workstreams:
first establish correct, timely four-row flashes and recovery within the same
song; then resolve lag during source, platform, track, and window transitions.
The user's additional observation is important: a song can remain laggy until
changing songs. Investigating only the instant of switching would miss that case.

There are confirmed timing and recovery limitations in the current code. There
is not yet a live trace proving which limitation causes the user's browser lag.
Passing unit tests does not establish listening accuracy or installed-app health.

## Verified baseline and artifacts

- `6d46be3` records the rollback to `e9906d9`. The subsequent commit changes an
  E2E wait. Comparing `e9906d9` with HEAD shows no changes in the music/native
  audio implementation, packaging script, Vite configuration, or grid CSS;
  the extension manifest version changed.
- Desktop configuration and the local updater manifest report `0.1.28`.
  A read-only HTTP check of the [public updater manifest](https://kanthangboard.netlify.app/downloads/latest.json)
  returned HTTP 200 and `0.1.28`. This verifies the advertised version, not the
  downloaded installer bytes or the version currently running on the user's machine.
- The source Companion, generated Desktop Companion, and installed folder at
  `C:/Users/thang/AppData/Local/Kora/music-companion/extension` report `0.3.21`.
  Nine checked runtime/config/model files have identical SHA-256 hashes across
  those three folders. Ten corresponding local ZIP entries, including its
  manifest, match the source bytes.
- The model is present: `percussion.onnx`, 1,815,198 bytes, SHA-256
  `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
  Config, worklet, worker, and the three ONNX runtime assets are also present.
  Missing assets are not an established explanation for this installation.
- Which extension folder is actually loaded in the affected browser, its
  successful runtime initialization, public ZIP parity, and real-song behavior
  remain unverified. An installed folder is not proof that the browser loaded it.

## Findings and their confidence

### 1. Local percussion necessarily arrives after its audio timestamp

Confirmed by the current config and code. The ADTOF config processes five
10 ms feature frames per batch and retains ten frames of right context: 50 ms
batches and 100 ms of future context. Feature extraction also needs FFT samples;
the classifier waits for peak confirmation/group completion. Audio playback is
undelayed (`delaySeconds` is zero).

The worker returns original onset timestamps. Mapping those correctly can
preserve note identity and spacing, but cannot make an already-heard attack
arrive early. The capture engine and scheduler allow some late events before
dropping events more than 600 ms late. Correct scheduling alone cannot eliminate
model lookahead, inference, or a blocked UI thread.

A controlled current-model benchmark using Node WASM, one thread, zero feature
input, and 20 measured runs after five warmup runs produced:

| Measurement | Result |
| --- | ---: |
| Model initialization | 183.41 ms |
| Median inference | 18.71 ms |
| p95 inference | 23.29 ms |
| Maximum measured inference | 25.08 ms |
| Available time per feature batch | 50 ms |

This is a throughput sanity check, not browser latency, musical accuracy, or a
weak-device benchmark. It provides no evidence of baseline inference overload
on this machine and no basis for a speculative model replacement.

Evidence: [config owner and runtime](../../extensions/kanban-music/percussion-runtime.js),
[worker](../../extensions/kanban-music/percussion-worker.js),
[feature extraction](../../extensions/kanban-music/percussion-features.js),
[classifier](../../extensions/kanban-music/percussion-classifier.js),
[capture timing](../../extensions/kanban-music/capture-engine.js), and
[scheduler](../../src/features/music/beat-scheduler.ts).

### 2. Inference can stop or stall while capture still looks healthy

Confirmed recovery gap; relationship to the reported lag is a hypothesis.
`createPercussionRuntime` has a ten-second initialization timeout, but no
post-start inference-progress watchdog. `await session.run(...)` can remain
pending. A `failed` message terminates the worker and disconnects its node.
The capture engine creates percussion once per capture and does not recreate
it after failure, a null initialization result, or a permanent stall.

The independent analyser can continue declaring audibility, emitting Bass,
and renewing capture. The user can therefore retain a live audio/capture state
with missing or stale drum delivery. Track/source replacement creates a fresh
capture and model runtime, which is consistent with recovery after changing
songs, but does not prove that this is what happened.

Worker queues are already bounded to three waiting blocks. UI/capture event
queues are bounded to 2,048 entries. No unbounded-queue or duplicate-worker root
cause was demonstrated. A watchdog must observe processing progress even when
there are no accepted drum notes; silence is not a worker failure.

Evidence: [runtime](../../extensions/kanban-music/percussion-runtime.js),
[worker](../../extensions/kanban-music/percussion-worker.js), and
[capture owner](../../extensions/kanban-music/capture-engine.js).

### 3. Normal visual effects add timing differences independent of detection

Confirmed presentation behavior. The grid already chooses a zero-delay semantic
cell and gives subsequent attacks an immediate overlay while a decorative
geometry continues. It is incorrect to say all attacks are intentionally
delayed or suppressed by shapes.

However, an initial Wave/Ripple semantic cell uses the 700 ms `square-wave`
animation, whose first bright keyframe is at 8% (56 ms). Pop uses a 150 ms
animation with its bright keyframe at 5% (7.5 ms). Secondary Wave cells stagger
by up to 280 ms, and decorative row geometry can remain active for 980 ms.
Normal mode also displays intentional whole-grid shapes. These effects can
make visible flashes appear late or unrelated to a row's instrument, even
when the underlying accepted event is correct.

Compare the existing semantic-only diagnostic view with normal mode on the same
input before changing detection. Preserve accepted shapes and Bass holds;
consider a consistent immediate semantic overlay if the comparison confirms
presentation timing as the problem. CSS animation-start time alone is not the
time a cell becomes visibly bright or the physical display presents it.

Evidence: [BeatPattern](../../src/features/music/BeatPattern.tsx),
[visual delays](../../src/features/music/beatVisuals.ts),
[CSS](../../src/components/focus/floatingFocus.css), and
[semantic diagnostic view](../../src/features/music/SemanticBeatPattern.tsx).

### 4. Switching includes discovery, teardown, permissions, and cold startup

Confirmed mechanisms; their contribution to reported lag is unmeasured.
Automatic discovery waits two seconds after each completed poll, plus request
time. Replacing a subscription serializes teardown, stops the old clock/capture,
closes the offscreen document, and starts the new capture/worklet/model. New-tab
capture can require a browser gesture. Same-source clock discontinuities also
cancel capture and initialize a new runtime.

Desktop selects Companion inference from advertised asset availability rather
than successful inference progress. The alternate native path suppresses
Companion non-clock messages while it owns the subscription. Keep these cases
separate when measuring; removing suppression indiscriminately could create
duplicate detections. Also check whether metadata/duration changes rebuild
`eventOptions` and unexpectedly restart the hook. That is an inspection target,
not a demonstrated bug.

Evidence: [selection and polling](../../src/features/music/useBrowserMusic.ts),
[subscription lifecycle](../../src/features/music/useMusicBeatSync.ts),
[extension capture lifecycle](../../extensions/kanban-music/beat-sync.js),
[Desktop routing](../../src/features/native/nativeMusic.ts), and
[native event suppression](../../src/features/native/nativeAudio.ts).

### 5. Existing documentation cannot establish current accuracy

The Companion README says public downloads exclude the model, but the current
packaging script and inspected ZIP include it. The validation document contains
historical five-row/Spleeter measurements, and its linked learned-percussion
report is absent. Those statements do not validate the rolled-back four-row
runtime. Earlier execution logs also repeatedly claim fixes before the user's
subsequent failed listening checks.

No independent current per-row precision/recall or audio-to-visible-flash
measurement was established in this investigation. Use the existing annotation
scorer with human-verified labels; model predictions, row counts, and DSP
proposals are not ground truth. Bass remains the accepted low-pulse detector,
not an isolated pitched-instrument transcription.

Evidence: [packaging inventory](../../scripts/package-music-extension.mjs),
[README](../../extensions/kanban-music/README.md),
[historical validation](../../extensions/kanban-music/BEAT-VALIDATION.md), and
[annotation scorer](../../scripts/score-percussion-annotations.mjs).

## Validation performed

Thirteen focused suites passed, 181 tests total: percussion classifier,
features, runtime, capability, capture engine, beat sync/timing, UI scheduler,
event merger, beat hook, normal renderer, native audio feed, and native music
integration. These are automated contract/lifecycle checks, largely using test
doubles; they do not test real listening accuracy or the installed browser.

The first pnpm attempt failed canonicalizing its working directory. Direct Node
then encountered sandbox temporary-file permissions. Redirecting temporary
files into ignored scratch let ten suites pass (150 tests); three suites still
hit Vite worker-path `EPERM`. Those three passed outside the sandbox (31 tests).
No tests were weakened or skipped to obtain the result. The public manifest
check similarly needed execution outside the sandbox after DNS access failed.

No dev server or detached browser was started. Test and benchmark processes
completed. Only the report and plan documents are deliverables.

## Recommended order and remaining evidence

Execute [the plan](../261013-1920-beat-grid-flash-and-switching/plan.md).
First measure and repair note identity, semantic flash timing, and recovery
without changing songs. Only then optimize handoffs and investigate whole-browser
responsiveness. Keep the current model, four-row grid, accepted animations,
Bass holds, and capture permissions intact during baseline collection.

Unresolved: the affected browser/build and actual loaded extension; failing
track/time ranges; whether the symptom is audio stutter, delayed flashes, missing
notes, or UI freezes; live worker progress, transport deadlines, UI long tasks,
and resource counts before and after the song change that clears the problem.
