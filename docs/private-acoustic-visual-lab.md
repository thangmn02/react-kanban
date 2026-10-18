# Private acoustic and visual listening lab

This research interface prepares full local recordings and replays saved predictions against exact local audio. It
does not qualify a detector or establish physical audio/display synchronization.
The prior [V2 replacement NO-GO](../plans/reports/engineering-261016-1459-beat-grid-v2-sprint.md)
remains in force. Implementation and measured results are recorded in the
[diagnostic report](../plans/reports/engineering-261018-0809-acoustic-visual-diagnostic.md).
The [full-song upgrade report](../plans/reports/engineering-261018-1010-full-song-listening-lab.md)
records complete-song preparation and listening checks.

## Hybrid Beta in the actual application

Run `node scripts/serve-hybrid-beta.mjs` from the repository, then open
<http://127.0.0.1:1420/music>. This explicit private development command also
serves the existing Tauri debug application's development URL. Reuse the one
tracked server on port 1420; its process receipt is in ignored
`scratch/hybrid-beta/server-process.json`. Research output and browser profiles
are excluded from its watcher because Windows locks active profile files.

Enable **Beat Grid Hybrid — Beta**, choose a prepared recording by filename and
SHA, press **Play music**, then select **Beat grid**. **Local recording and
visual envelope** contains the Original/Short Attack selector. Changing its
envelope preserves the audio element and clock. Disable Beta to pause its
owned local audio and return to the existing provider discovery path.

This is the existing Music/Focus grid, event engine, scheduler and controller.
H0 supplies frozen ADTOF Kick/Snare and CNN Hat. The unchanged browser Bass
detector owns Bass independently on both Web and Desktop local playback; this
differs from native monitored-system-audio Bass. One owned WebAudio graph
provides output and analysis without intentional delay. Complete matching A/B
results are reused without inference; first-time selected files are prepared
on the loopback computer. Missing analysis and known EOF coverage gaps remain
explicit. Predictions are unverified; this does not pass an accuracy gate.

**Melody / Lead (saved analysis)** is available only for an exact saved Lead
reference. Those short reference recordings are separate catalog entries:
matching titles do not bind them to full songs. The bridge retains pitched-note
versus vocal-articulation provenance and dominant-monophonic validation. Its
150–450 ms duration-sensitive trail produces one attack per saved event.
Missing percussion stays unavailable on Lead-only references; independent Bass
can still run. New full-song and live Lead inference are unavailable in this
checkout; see [the runtime audit](server-beat-analysis.md#current-checkout-availability).

Optional **Developer / research diagnostics** reports row counters, source/cache
identity, software DOM lateness and audio-clock information, and exports a
technical trace. Software measurements and AudioContext output-latency estimates
do not measure speaker-to-pixel synchronization. Natural listening notes remain
provisional; unmatched predictions are not established false positives.

For the separate private live A baseline, load the private Companion package,
play an authorized source tab and invoke its toolbar action. Select that source
in Music and use **Private candidate → Live preview**. The explicit local app
origin 1420 is recognized alongside 5173/5174. Live CNN remains unavailable;
offline H0 playback does not demonstrate live CNN operation. Simultaneous Web
and Desktop capture clients share Companion's existing single owner and can
replace each other; test one capture client at a time. No public rollout,
installer publication, cloud analysis or model-rights clearance follows from
this development command. Ordinary builds keep the local Beta disabled and
contain no local preparation server.

Measured evidence and remaining gates:
[Hybrid Beta integration report](../plans/reports/engineering-261018-1525-hybrid-beta-melody.md).

## Frozen H0 full-song listening

The private [Full-Song Lab](http://127.0.0.1:5173/lab/) offers primary A/B/H
comparisons and C as a diagnostic reference. **H — Hybrid ADTOF + CNN** is
marked **PRIVATE RESEARCH — PRECOMPUTED HYBRID**. It reuses
`H0-frozen-routing-diagnostic-v1` from `hat-recovery-core.py` through a local
JSON bridge: A's original Kick/Snare and B's original Hat only. A Hat/Cymbal,
B Kick/Snare and invented Bass/Melody are excluded. IDs, timestamps, classes
and simultaneous different instruments survive unchanged. Each H event carries
its original model, checkpoint SHA, result SHA and cache key; the source panel
and exports include the complete component contracts.

Use **Retained exact recordings** in the Song selector to choose an already
prepared recording by filename and displayed SHA. This does not upload again,
rename a recording or reassign an existing user slot. The original Rằng, HSKT,
Nujabes and Chinese recordings remain available even after slot replacement.
Uploading requires choosing a normal slot. H is explicitly incomplete until
both matching frozen A/B records are ready; there is no fallback. A's missing
raw-frame intervals remain unavailable for H Kick/Snare; B's coverage governs
H Hat independently.

H's router requires checkpoint A
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`
and B `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`.
Every clip request validates the persisted A/B hashes and source/PCM contract
before selecting a cached H result. The in-memory routing key additionally binds
canonical WAV, algorithm SHA and both component contracts; concurrent requests
share one computation. Restarting the server reroutes saved events once per
requested binding, without neural inference or rewriting A/B results.

Full-song listening initially uses **Short Attack**; **Original** remains
selectable. A/B/H and renderer switches change event/render inputs only and
preserve the same native audio element, source, clock, speed and position.
Neither renderer choice nor H implies improved detection or physical timing.
The detailed excerpt view retains its existing Original default and blind
A/B/C reference contract. All saved markers remain inspectable by zooming the
bounded timeline.

Rằng **[26,44)** retains all **21** frozen B Hat predictions in H (A has 8 Hat
and 2 Cymbal). The user's Hat-negative report remains provisional. The Chinese
**[200,220)** case remains available; the described rhythm was illustrative,
not a verified transcription. No threshold increase or Snare veto enters H.

Quick feedback supports H, missed Kick, visual merging and H-versus-A/B
preferences as qualitative observations. Select H for the two comparison
buttons; the server rejects other selected tracks and records the compared
pair. Source time, source/canonical hashes, selected track, renderer, component
provenance, reviewer and note are retained. Old notes are preserved. Reviewing
a note restores its track and renderer. Notes never establish official
precision/recall/F1 or become independent blind references.

Hướng dẫn: chọn đúng tệp trong **Retained exact recordings**, chọn **H · Hybrid
ADTOF + CNN**, giữ **Short Attack** rồi bấm **Play full song**. Đổi A/B/H ngay
khi đang nghe; dùng Seek hoặc Loop để nghe lại đoạn cần kiểm tra. Ghi nhận xét
ở phần 4, hoặc xuất feedback để lưu toàn bộ ghi chú. HSKT ở danh sách lưu trữ
là bản gốc theo SHA, không phụ thuộc nội dung ô HSKT hiện tại.

Launch from the repository with `node scripts/serve-acoustic-visual-lab.mjs`;
reuse the owned process on ports 5173/5174 instead of starting a duplicate.
Verification: `node --test scripts/full-song-hybrid.test.mjs` and
`node scripts/verify-full-song-hybrid.mjs` (includes complete three-minute 1x
playback in an isolated browser). See the
[H0 listening report](../plans/reports/engineering-261018-1449-h0-full-song-listening.md).
H0 is authorized for private listening only. CNN centered context/global dB
normalization, causal operation, live synchronization, physical speaker-to-pixel
timing, AGPL-3.0 integration and weight distribution remain unresolved gates.
Production deployment is not authorized.

## Targeted Hi-Hat investigation

Open [the private Hat investigation](http://127.0.0.1:5173/lab/?mode=hat-recovery)
for the Rằng [26,44) negative report, the retained Nujabes recording, the
user-selected Chinese [200,220) interval and a labeled repeated control. The
[investigation report](../plans/reports/engineering-261018-1347-hat-false-positive-recovery.md)
records hashes, exact counts, raw evidence, threshold/control/holdout results and
the NO-GO decision for advancing a corrected hybrid. Natural listening reports
remain provisional; a missing independently reviewed positive subset is explicit.

Select a case, play it and switch A/B, renderer or a clearly named experimental
track without restarting the audio. Timestamp buttons seek and expose bounded
frozen raw scores. Export contains event identities, the provisional ledger and
measured delivery/frame proxies. Read-only source and snapshot checks fail closed
if their exact bytes change. A/C/B preparation and detailed blind references are
unaffected. The view consumes private artifacts in `scratch/hat-recovery/`; a
clean clone has neither these recordings nor analysis results.

Threshold tracks change only the rising-edge extraction threshold and therefore
may select different original raw frame times. They add no fitted time shift,
debounce or generated hits. `cnn-hat-snare-dominance-v1` is a rejected same-frame
Snare/Hat score veto; it loses independently referenced Hats. H0 routes frozen A
Kick/Snare plus frozen B Hat, with exact provenance and unavailable intervals.
It remains acoustically unqualified. The later H0 listening authorization above
permits the unchanged route in private full-song evaluation; rejected correction
experiments remain rejected. It is not a qualified live route.
Original model outputs, renderer envelopes and Companion behavior stay frozen.

Hướng dẫn: chọn **Case**, bấm **Play investigation**, đổi **Event track** A/B để
nghe cùng đoạn. Bấm mốc thời gian để xem điểm thô; thử **Original / Short Attack**
để phân biệt sự kiện bị thiếu với các flash bị nhập vào nhau. Bấm **Export
complete investigation** để lưu bằng chứng. Các mục Experimental và H0 chỉ để
kiểm tra; chúng chưa được chọn làm mặc định.

## Full-Song Listening Test

The default `/lab/` page is the full-song view. It has two named slots, **Rằng Em
Mãi Ở Bên** and **HSKT**, plus Local file. Names are user labels, not audio
identity. Select the exact authorized MP3, WAV or FLAC using the file picker;
no renaming or hard-coded Downloads path is required. Upload means a transfer
to this loopback server on the same computer, not a cloud service. Original
bytes, SHA-256, decoded PCM, decoder/resampling details, duration and numerical
preparation revision are retained locally. HSKT is not expanded or inferred.

Preparation runs one CPU4 worker at a time, A then C then secondary B. The UI
shows per-model state and stage progress, errors, cancellation and retry. Limits
are 256 MiB input, mono/stereo, 1–720 seconds, 6 GiB worker-tree resident memory
and one hour per job. Exceeding a limit reports BLOCKED; there is no substitute
detector. A partially ready song shows its actual per-model readiness. A/C must
both say READY for a complete A/C comparison; B may be used as a secondary control.

The exact existing model loaders, feature extraction and thresholds are reused.
ADTOF processes its original overlapping feature context; C1 computes its global
normalization/frontend on the complete recording before published batched
inference; corrected OAF receives the entire HTDemucs drum stem in one call,
retaining bidirectional context. There are no independent external detector
chunks or joins. HTDemucs retains official shifts=1, split=true, overlap=.25,
CPU4, mono mean/std normalization and decoded-PCM-derived seed. Its load,
separation and serialization cost is included in C preparation. Sample-length
parity is checked. No onset time shifts are fitted to a song.

Processing the complete file does not create missing EOF context. Raw frame
coverage is checked separately: the unchanged ADTOF extractor leaves a short
uncomputed tail (about 0.12–0.16 seconds on the initial songs). The UI marks its
exact interval unavailable, preserves the original output, and refuses official
model metrics for review windows intersecting it. No silence padding or fake
hits are added to conceal that boundary. C1/OAF raw coverage is reported separately.

The source clock starts at the first sample returned by the pinned libsndfile
decoder. MP3 codec delay/padding is handled by that decoder; Kora adds no guessed
correction, trim or silence. Canonical playback and every model use that same
44.1 kHz stereo float recording. Mono is duplicated and other sample rates use
the recorded soxr_hq resampling transform. Source-relative time is sample/44100.

Successful evidence is versioned at
`scratch/acoustic-visual-lab/full-songs/<original-sha>/models/<contract-key>/`.
Keys bind original/PCM identities, verified model weights/pipelines, decoder
versions and automatically hashed numerical code in
[`full-song-numerics.py`](../scripts/full-song-numerics.py). Worker/status
serialization is separate; changing it alone cannot create a new detector
experiment. Each model record preserves its producing worker hash. Retry reuses
valid completed lanes, recomputes damaged/mismatched lanes, and preserves other
cache versions. Separator cache checks include content, seed, contract and
sample count. Startup marks obsolete contracts STALE; retry verifies them.

Playback uses one native streaming audio element, with bounded HTTP range reads;
the browser does not load full neural tensors or repeatedly decode on model
switch. A/B/H/C and original/short switches change prediction/render inputs only.
The media/waveform binding includes original SHA, analysis revision, canonical
WAV and decoded PCM identities; a changed canonical source is reloaded explicitly.
The overview has at most 2,048 envelope bins, detail envelopes use 10 ms bins,
and event lanes show at most 160 markers per class. Zoom to inspect dense input.
No individual event is removed from saved evidence because of that DOM bound.

Quick feedback captures actual current source time, song hash, selected model,
renderer, note, observation ID/version and nearby A/B/C predictions. It remains
**model-exposed qualitative feedback**, stored in a separate
`feedback-<reviewer>.json` from blind annotations. It cannot produce P/R/F1 or
become an acoustic reference. Listening continues when flagging. **Review
passage** pauses and opens the adjustable ±2-second context; **Detailed
annotation** opens the existing strict workflow. Its `full-exposed-*` namespace
is forced exposed/provisional on the server, even after removing URL parameters.
For a separately independent blind review, use a separate reviewer and the
existing blind protocol rather than converting impression notes.

The renderer trace separates saved predictions, bounded deliveries, observed
frame IDs, shared-row computed-brightness attack proxies and human notes.
Computed frames are not perceived attacks or physical timing. Background tabs
can undersample. The original/short choices receive identical prediction IDs,
classes and timestamps; neither creates missing drum hits. Reduced motion
remains honored.

### Hướng dẫn ngắn

1. Mở [lab](http://127.0.0.1:5173/lab/), chọn bài và chọn tệp nếu chưa có.
2. Chờ **A** và **C** báo **READY**, rồi bấm **Play full song**.
3. Đổi A/C khi đang nghe; chú ý Snare và Hi-Hat. Có thể thử Original/Short Attack.
4. Bấm một nhận xét như **Missed Snare**, **False Hi-Hat**, **Flash too late**
   hoặc **Unsure / needs review**. Nhạc vẫn tiếp tục; ghi chú là tùy chọn.
5. Xem lại bằng **Review passage**, hoặc bấm **Export listening feedback** để
   gửi kết quả. Không cần gắn nhãn từng tiếng trống để bắt đầu nghe.

## Start and stop

Use the acquired workspace and its existing isolated Python environment. Check
port owners before starting; stop the old owned listening server instead of
starting another port. From the repository root:

```powershell
# Required before first reuse of the frozen sprint evidence:
powershell -NoProfile -File scripts/reproduce-beat-v2-round.ps1 -VerifyOnly
scratch/beat-grid-v2/.venv/Scripts/python.exe scripts/prepare-acoustic-visual-lab.py
node scripts/serve-acoustic-visual-lab.mjs
```

Open [the listening lab](http://127.0.0.1:5173/lab/). The existing
[Private Grid](http://127.0.0.1:5173/) links to it. The server builds the private
entrypoints at startup; restart it after edits. Its PID, ports, command and
workspace are recorded in `scratch/acoustic-visual-lab/server-process.json`.
Stop the foreground command with Ctrl+C. It binds only to loopback, serves
allowlisted audio, and writes reviews locally. It requires the previously
acquired private evidence; a clean clone contains no music or model weights.

The preparation script fails on changed historical artifacts, source code or
result records. The owning documentation may link this lab; its old Git blob is
verified against the frozen receipt and the current documentation hash is
recorded separately. No predictions are recomputed by preparation.

## Detailed blind annotation and original excerpts

Open [detailed acoustic review](http://127.0.0.1:5173/lab/?mode=detail) for the
original excerpt workflow. Full-song feedback does not populate these references.

1. Leave predictions hidden. XO starts at source time 45.000 seconds and loops
   through 57.000. Play, pause, seek or replay the passage. Set a reviewer ID.
2. Click the waveform to position the cursor, zoom and replay around it. Mark
   only audible attacks. Choose instrument, confidence, overlap, ambiguity and
   onset uncertainty. A waveform peak is not automatically a drum identity.
   Keep uncertain sounds unknown or exclude ambiguous intervals.
3. Save locally and export the annotation JSON. Preliminary marks stay
   `provisional-human-reference`. You may then reveal A/B/C, switch predictions
   during the same playback, inspect individual markers and the semantic grid,
   and export per-hit evidence. Switching candidates does not restart audio.

For an official excerpt subset, first independently check every included onset
and complete Kick, Snare and true-Hat coverage outside excluded intervals.
Use the coverage panel to attest completeness and explicitly freeze **before
using model output to select or correct the reference**. Exclusions have a
50 ms boundary guard. Natural matching is at most 50 ms, constructed controls
40 ms, and same-class neighboring onsets tighten either tolerance to gap/4.
No prediction can match two references. Timing uncertainty must also fit the
natural 50 ms/gap/4 bound. A frozen subset is a reviewer attestation, not
automatic verified ground truth or general music-domain qualification.

Exposure persists through hide, reload and import. New or acoustically edited
marks after disclosure retain exposure. Changing events, coverage, ambiguous
intervals or reviewed bounds after disclosure makes the selection provisional;
an independent blind subset is then needed for official metrics. Existing
unchanged blind references retain provenance. No unmatched provisional
prediction is called a definite false positive. Do not tune thresholds to
manual timestamps. The prior Whiplash onset references are not silently imported
or promoted.

The structural [annotation schema](../scripts/acoustic-annotation.schema.json)
is supplemented by [runtime validation](../scripts/acoustic-visual-lab-core.ts).
Reviews and revision history live in ignored
`scratch/acoustic-visual-lab/annotations/`; export before moving machines. The
default namespace is `listener`; `?review=another-reviewer` selects an explicit
separate local review. A stale save receives a conflict instead of overwriting
the latest revision. Automated checks use their own namespaces.

## Source and candidate identity

The source panel shows the original file, canonical WAV and browser-decoded
float PCM SHA-256 values. The browser verifies both canonical WAV and decoded
44.1 kHz PCM before enabling playback. The owned AudioContext is the one clock
for A, B and C. Source time is `canonicalSample / 44100 + sourceOffset`.
Leading silence, exact unpadded PCM identity and separator sample-length parity
are checked in `scratch/acoustic-visual-lab/reuse-verification.json`. There are
no manual candidate offsets. Failed decoding/hash checks disable playback.

| Track | Saved pipeline | Interpretation |
| --- | --- | --- |
| A | BASE, frozen accepted ADTOF | Original baseline; not rejected ADTOF Candidate B |
| B | C1, Frame-Level Drum CNN | Saved outputs only; no live-streaming claim |
| C | C2-separated, corrected OAF + HTDemucs | HH/Tambourine/Maracas remains grouped percussion, never verified true Hat |

Individual Kick, Snare, Hat, grouped-percussion, Cymbal and Tom markers retain
their identity and source timestamp. The existing grid has a shared upper
percussion row; use the separate lanes for semantic distinctions. Saved raw
scores are uncalibrated model output. Missing raw stages remain unavailable.
Controls with no saved separated OAF input show N/A, rather than inferred output.

## Visual and live diagnosis

The detailed excerpt view defaults to Original; full-song listening defaults
to Short Attack. One private short-attack prototype uses a
40 ms marker and a separate 130 ms soft trail. Neither changes event labels,
timestamps or production behavior. Rapid-repeat tests inject six constructed
Hat references, bypassing the detector and production controller. Their report
separates known references, saved detector output, lab delivery, first-frame
IDs and brightness rises; controller acceptance is unavailable in this fixture.
Exports retain the sampled evidence independently of later playback. Insufficient
frame sampling produces an unavailable result, not a missed-hit count. Reduced
motion suppresses the sharp prototype flash. Brightness rises are a DOM/frame
proxy, not a human-perception or physical speaker-to-pixel measurement.

For the actual live baseline, stop lab playback, use Chrome or Edge with the
existing private Companion, and open [the exact source](http://127.0.0.1:5174/).
Select the matching passage, play it and click Companion's toolbar icon on that
source tab. Use the existing Private Grid consent and live-preview/calibrated
delay controls. The in-app browser can run offline listening but cannot load the
Companion extension. No provider permissions or synchronization guards change.

Open **Private live pipeline trace**, start a fresh app trace, keep the grid
visible, then export it. Import into the lab with the same passage selected.
Stable IDs join available stages; a source declaration binds timestamps but
does not prove captured PCM or physical alignment. App-only exports may lack
worker/Companion stages. Missing bounded log records never prove transport loss.
The generated-source verification script additionally collects offscreen logs;
it does not substitute for natural XO listening.

Per-hit exports include raw/proposed and strict matched predictions, errors,
frame observations and exactly one primary causal label per model/case, plus
optional secondary causes in the annotation contract. Confirmed non-UNKNOWN
causes require evidence citations. Uncertain cases stay UNKNOWN. Use explicit
late/drop records to investigate processing; do not infer a model miss merely
from an absent flash.

Focused verification commands are `node --test scripts/acoustic-visual-lab-core.test.mjs`,
`pnpm exec tsc --project scripts/tsconfig.acoustic-lab.json --noEmit`,
`node scripts/verify-acoustic-visual-lab.mjs`,
`node scripts/verify-acoustic-lab-api.mjs`, and
`node scripts/verify-acoustic-lab-live.mjs`. The last three require the server;
the live check also requires the existing private extension package. They use
isolated temporary browser profiles and generated controls, not a user session.
