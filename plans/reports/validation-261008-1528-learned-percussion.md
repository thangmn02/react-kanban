# Learned percussion candidate — local listening handoff

Implemented one ADTOF learned Rows 1–3 candidate and stopped automatic tuning.
It materially improves the measured negative-control/full-mix trade-off and is
ready for private user listening. This is not production acceptance or Phase 5.
No source separation, training, new model survey or fourth DSP gate was added.

## Reuse and architecture

Reuse the installed ADTOF-pytorch 0.1.0 pretrained FrameRNN weights, pinned
research checkout `85c192e78f716ea0b111cc8a5ee4a8f6a3a4f8a9`. Strict weight
loading succeeds. The network has 449,741 parameters: convolutional features
and three bidirectional recurrent layers. Exported ONNX is 1,815,198 bytes,
SHA256 `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.

44.1 kHz PCM → centered 2048-sample Hanning FFT / 441-sample hop → exact trained
84-bin log filterbank → one-second trailing spectro-temporal window → local
ONNX worker → pretrained class peak decisions → existing semantic events.
Inference runs every 100 ms with 100 ms right context. The source network is
bidirectional; this is bounded-delay streaming, not an inherently causal or
zero-latency network. No arbitrary future track audio is read.

Existing model operating points `[.22,.24,.32,.22,.30]` are unchanged. They
apply to learned activation novelty, not the raw acoustic onset/flux generator.
Kick and snare map independently; hat/cymbal share Hat; tom is not relabeled.
No accepted learned attack explicitly produces `non-percussion/abstain`. This
means abstention, not a separately trained negative-class probability.
`confidence` is the uncalibrated class activation. `classMargin` is the learned
peak's margin over its operating point, not a winner-vs-runner-up probability.
All five raw class scores remain available at the classifier interface.

The unchanged spectral-flux DSP remains an acoustic proposal/envelope source.
Its drum proposals are traced as semantic:false and cannot publish Rows 1–3.
Bass retains the exact pre-pass detector and publication behavior. Learned
events retain original audio timestamps and scored producer telemetry. Missing
assets, unsupported sample rate, load or inference failure abstain; playback,
audibility, Bass and leased analysis continue. Pending load is abortable; stale
capture owners cannot publish. Worker backlog is bounded to three feature
blocks; a gap resets its history and classifier instead of replaying stale work.

Renderer, merger, scheduler, cache, Melody and failed DSP candidates were not
edited by this pass. The existing 40 ms same-type dedupe and late-event policy
remain. The producer record identifies `percussion-classifier`; existing
transport/DOM diagnostic contracts remain intact.

## Exact controls

48 existing inputs: 26 supplied stem/control excerpts and 22 original excerpts.
No new separation, media download or audio upload. Negative controls total
**1,675 → 66 percussion events, a 96.06% reduction**. A/B/C/F denote supplied
vocals, piano, bass and sum of non-drum stems respectively. All counts are
Kick / Snare / Hat; the role names below are fixtures, not production rules.

| Negative control | Pre-pass DSP | Learned candidate |
|---|---:|---:|
| H.S.K.T. A | 7/72/64 | 0/0/0 |
| H.S.K.T. B | 4/0/0 | 0/0/0 |
| H.S.K.T. C | 46/14/0 | 12/0/0 |
| H.S.K.T. F | 45/60/64 | 12/0/0 |
| Chân Ái A | 45/91/96 | 0/2/0 |
| Chân Ái B | 1/0/0 | 0/0/0 |
| Chân Ái C | 20/1/0 | 18/1/0 |
| Chân Ái F | 28/84/94 | 13/0/0 |
| Nujabes A | 7/76/33 | 0/0/0 |
| Nujabes B | 13/0/0 | 0/0/0 |
| Nujabes C | 25/0/0 | 0/0/0 |
| Nujabes F | 52/73/33 | 1/0/0 |
| Chinese pop A | 15/45/52 | 0/0/0 |
| Chinese pop B | 0/0/0 | 0/0/0 |
| Chinese pop C | 18/1/0 | 3/0/0 |
| Chinese pop F | 47/64/51 | 1/0/0 |
| Nujabes guitar | 50/4/0 | 0/0/0 |
| H.S.K.T. other | 5/0/0 | 0/0/0 |
| Bích Phương 0:00–0:13 | 0/0/0 | 0/0/0 |
| Gymnopédie piano | 21/0/0 | 0/0/0 |
| MONO 0:00–0:40 | 31/68/55 | 0/1/2 |

Bích Phương was already silent under the pre-pass flux repair; the learned
candidate preserves that result. MONO's vocal/lead tracking attacks are largely
suppressed. Bass-only controls still cause false learned kicks, especially
Chân Ái; the new classifier has not solved every low-frequency ambiguity.
This finding is distinct from Row 4, whose behavior remains unchanged.

| Positive/control excerpt | Learned Kick/Snare/Hat |
|---|---:|
| H.S.K.T. drums / mix | 43/27/97 · 47/27/75 |
| Chân Ái drums / mix | 26/16/12 · 27/15/16 |
| Nujabes drums / mix | 26/26/90 · 26/29/84 |
| Chinese pop drums / mix | 70/1/44 · 70/1/27 |
| Hysteria mix | 65/40/71 |
| Voodoo People mix | 83/81/119 |
| Levels 0:00–0:30 | 0/0/18 |

Matched learned drum-stem timestamps surviving in the corresponding mix,
one-to-one within ±50 ms: H.S.K.T. 42/43 kicks, 21/27 snares, 66/97 hats;
Chân Ái 26/26, 14/16, 7/12; Nujabes 26/26, 24/26, 81/90; Chinese pop 70/70,
1/1, 25/44. Overall 403/478 matched stem predictions survive the mix.
This is mixture robustness evidence, not independent true-hit recall.

Against the previously saved transcription timestamps, Hysteria matches 65/65
kicks and 39/41 snares; Voodoo People 65/65 and 57/58; Nujabes 26/26 and 24/24;
H.S.K.T. 42/42 and 19/19; Chân Ái 26/26 and 13/13. Hat reference matches range
from 35.9% (Chân Ái) to 89.4% (Nujabes). Those saved model references are not
universal or independent human ground truth. Their agreement cannot substitute
for listening. The Levels intro reference contains no kick/snare timestamps;
zero output there is not automatically a masking failure. Its extra hats remain
a listening concern. No parameter was tuned to those tracks.

Soft-hit loss is not independently quantified because controls have no
human soft/strong labels. The missing hats above make the loss visible; do not
declare acceptable recall or infer soft-hit loss only from old DSP total counts.
Per-type activation distributions and timestamp matching are retained in the
private comparison export.

## Verification and runtime evidence

- Full existing suite plus new tests: **101 files / 736 tests passed**.
- Focused source/frontend/classifier/lifecycle/telemetry: **24 tests passed**.
- Typecheck, scoped ESLint and app production build passed. Build retains its
  existing large-chunk warning; no unrelated bundle optimization was attempted.
- PyTorch→ONNX parity maximum absolute errors: `9.50e-8`, `1.19e-7`.
- Real-audio Python→JavaScript frontend parity: `2.61e-7` over 290 frames.
- JavaScript peak/abstain decisions match all 48 Python evaluation cases exactly.
- Real learned event replay: **48/48 diagnostic cases passed** through existing
  normalization, merger, controller and semantic DOM path. 3,047 typed raw
  events → 3,047 normalized → 3,034 merged/committed. Thirteen same-type events
  were explicitly rejected by the existing 40 ms dedupe; no cross-type rebroadcast.
  The initial private assertion requiring every duplicate to render failed;
  inspection proved the documented dedupe, and the harness now explicitly
  validates its reason and a matching same-type neighbor. No production merger
  change was made. Animation starts in this harness are dispatched in jsdom,
  not physical display/speaker measurements.
- Owned isolated Edge 154 MV3 extension loaded the actual model, WASM worker
  and AudioWorklet. Three seconds of a supplied Nujabes drum control produced
  2 kicks / 4 snares / 9 hats, 29 worker batches, no dropped backlog. Runtime
  startup ~205 ms. Observed earlier run delivery lag ~190–270 ms; playback itself
  is not delayed. User listening must assess whether that lag is acceptable.
- Native CPU ONNX evaluation took roughly 1.5 seconds per 30 seconds of audio
  with two threads. Browser uses one WASM thread. This machine's checks do not
  certify low-end Celeron/i3 performance, all browsers or extended live sessions.

Browser checks use a disposable owned Edge profile; no user cookies or logged-in
tabs are read. Preview PID 3132 / port 5173 is reused. Owned test browsers close
in finally blocks. No server, database, updater feed or deployment was changed.

## Listening build and stop

Unpacked folder:
`src-tauri/target/learned-percussion/companion`.

Disable the previously loaded Companion, then Load unpacked this folder in
Edge. Its name is **Kora Music Companion — Learned Percussion Test**, version
0.3.14 with an explicit test version name. Refresh the music tab and local Kora;
use `http://127.0.0.1:5173/beat-grid?musicDebug=1&musicFourRows=1`. Browser tab
capture may require one toolbar click on the playing music tab. This is a local
test; installed/public release folders were not upgraded to this model.

Private outputs under `src-tauri/target/learned-percussion/`: model metadata,
48 activation/event exports, confidence/matching comparison, classifier/frontend
parity, pipeline traces, browser trace and check logs. These stay ignored and
are not intended for source control. Packaging scripts reproduce the local
candidate from the installed research weights and existing ONNX dependency.

**Production blocker:** original ADTOF model license is CC-BY-NC-SA-4.0; this
candidate is a private evaluation, not commercial deployment permission.
Resolve model/weight distribution rights before any production release. The
source interface remains replaceable; no automatic alternative-model search
or another tuning pass is started.

Stop for user listening feedback. Remaining acceptance: false low-bass kicks,
missing/extra hats, perceptual full-mix precision and added live lag. Bass repair,
Melody work and Phase 5 remain stopped.

Primary references: [ADTOF](https://github.com/MZehren/ADTOF),
[installed PyTorch path](https://github.com/xavriley/ADTOF-pytorch),
[ONNX Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html).
