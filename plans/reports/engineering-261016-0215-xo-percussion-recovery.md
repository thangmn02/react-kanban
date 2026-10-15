# XO Tour Llif3 Snare and Hi-Hat recovery

Date: 2026-10-16, Asia/Saigon. **Decision: NO-GO for adopting B.** The bounded
experiment recovers some constructed 50 ms attacks but increases false Hats on
Snare-only audio, does not increase XO Snare output, and does not establish
better audible separation or non-regressing timing. Further detector recovery
requires a trained replacement or retraining evaluated against independent
references. No second correction, threshold search or model search was attempted.

## Revision and identities

- Branch: `codex/beat-grid-quality-recovery`.
- Prior private playback/platform work preserved as baseline commit
  `d5b28b1762728756881990cf37d94a2930d89c08`.
- Final implementation and measurement-tool commit:
  `86879c521650514b5c564bf63c8073f9871011ea`. The documentation-only delivery
  commit is resolved by `git log -1 --format=%H -- plans/reports/engineering-261016-0215-xo-percussion-recovery.md`.
  The final delivery receipt is also saved privately in
  `scratch/xo-percussion-recovery/final-revision.json` after committing this report.
- Original source: `%USERPROFILE%/Downloads/Lil Uzi Vert - XO Tour Llif3 (Official Lyric Video).mp3`.
  SHA-256 `98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05`, verified before processing and browser playback.
- Selected source window: 45–57 s. Original excerpt stereo f32 SHA-256
  `9586cf33bd17c54c06e9b93da8d97062329626a3ec61fd020cc30d2bf6825055`.
  Offline analysis adds one second of silence on each side while preserving the
  interior stereo PCM exactly. Full original MP3 is used for actual Companion listening.
- Existing ADTOF ONNX SHA-256
  `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
  No weights, thresholds or frontend changed. Existing local-evaluation model notice remains.
- Frontend: stereo mean, 44,100 Hz, FFT 2,048, hop 441, 84 bins,
  100-frame model window, five-frame step, ten-frame right context. The five
  outputs remain Kick, Snare, Tom, Hat, Cymbal; Tom has no public percussion row,
  Hat/Cymbal share one row. Bass retains its separate existing behavior.

The user reported real Snare/Hat misses. These are not dismissed by passing
software tests. This investigation has no independently verified listening
annotation establishing that 45–57 s contains a particular Hat roll, closed/open
Hat or ride pattern. The window contains provisional human percussion cues and
model activity, making it a reproducible investigation window, not verified
acoustic truth. No additional arbitrary natural section was claimed to contain a roll.

## One locked correction and attribution

A uses the existing private onset-guided peak picker. B, only when explicitly
packaged with `--private --xo=B`, uses the maximum of existing rolling novelty
and current activation minus the lowest of the preceding three raw score
frames, for Snare/Hat/Cymbal classes only. Numeric thresholds remain
`[.22,.24,.32,.22,.30]`; Kick behavior is byte-for-byte identical on paired activations.

This addresses observed strong learned scores whose rolling novelty falls below
threshold between nearby attacks. It changes one class-decision mechanism.
It does not change grouping, merger, debounce, scheduler, visual animation,
model weights or source epochs. B remains default-off, labeled **NO-GO**.
The normal package does not enable diagnostic recording or this correction.

Both comparison packages pin the existing eligible audio-only experiment to
500 ms intentional output delay. Calibration must still have enough samples
and remain within the existing 500 ms ceiling. This shared diagnostic output
setting is not a second detector correction. Video/Spotify/output-ownership and
consent restrictions remain effective.

## Failure stages

**Model response / identity:** Constructed simultaneous Kick/Snare/Hat bursts
show Snare activation maxima of only .0197 near 7.000 s and .0535 near 9.000 s
(±30 ms), below the .24 novelty threshold even before prominence decisions.
At 80/125 ms spacing, neither A nor B recovers the six constructed Snare hits.
These are model/representation failures under overlap, not UI misses.
Hat-only 20/30 ms bursts likewise collapse into a broad response; the correction
does not create six distinct learned proposals.

For provisional XO Snare cues, a ±150 ms **search window**, not a claimed human
timing-error bound, finds maximum Snare activation/novelty .1170/.0618 around
47.346 s and .0127/.0100 around 53.459 s, with no emitted Snare there. These
require review of instrument identity and timestamp. They support a model
nonresponse hypothesis if the human cue is confirmed; they are not counted as
official false negatives. Other cues have strong Snare scores. The 56.656 s
cue has a proposal at 56.800 s; an earlier unpadded runtime stopped before
finalizing that proposal, so its absence there is not called a model miss.

**Peak suppression:** In frozen XO A, four Snare frames and 59 Hat/Cymbal
frames have raw activation at or above the class threshold but novelty below
threshold. These are frame diagnostics, not 63 missed notes. A→B reduces those
counts to two and 21. No `grouped-with-neighbor` decision occurs inside this
selected XO window. At 50 ms constructed Hat spacing, retained local prominence
changes matched attacks from 3/6 to 6/6. It also increases Snare-only false Hats,
showing why global threshold lowering or retaining every score rise is unsafe.

**Delivery:** The final actual XO run delivers every emitted selected event to
the UI. Each version loses one Hat to existing controller debounce. A separate
loaded-run failure under concurrent build/test work has inference calls around
72–76 ms per 50 ms model step, 2–5 s accumulated lag, and 38 `capture-engine:late`
drops before UI delivery. This is a demonstrated runtime/deadline failure,
preserved separately from the clean runs. It is not repaired by more flashes.

**Visible separation:** In clean controlled A, 23 Hat events are accepted but
only 21 are observed above .5 opacity in the viewport. One of the two missing
observations has `EVENT_RENDERED` and the other only a DOM commit; sampled
visibility cannot resolve whether they were perceptually distinguishable.
In B's 50 ms Hat burst, six distinct trace IDs become visible while the Hat row
stays at or above .5 opacity continuously for 350 ms. Existing 150 ms flashes
can overlap at rapid spacing. This proves overlapping visual activity, not
that a listener perceived six separate attacks. No visual redesign was added
as a second correction.

### Existing 9.880 / 9.890 s pair

The saved Trap pipeline trace identifies a Cymbal-class proposal at 9.880 s
(confidence .446509, novelty .359221) followed by a Hat-class proposal at
9.890 s (.295967, .222223). Both have strong coincident Kick scores (.8087,
.7832), similar Cymbal scores and overlapping subtype activity. Both reach UI;
the second drops at controller `debounce`. A separate aligned model pass has
one broad Hat/Cymbal response around 9.860 s, illustrating frame-phase sensitivity.

The evidence establishes different subtype representations in one short
acoustic region; it does not independently establish two acoustic attacks.
Subtype duplication of one region is a supported hypothesis, with acoustic
identity unresolved. A genuine 10 ms pair is not certified. The safeguard was
retained; removing it to increase counts would not resolve that uncertainty.

## Controlled acoustic results

Deterministic noise/resonator drum signals pass through the production feature
extractor and ONNX model. They are not injected activation impulses. Each burst
contains six known attack instants; alternating bursts contain three S and three
H attacks. Simultaneous bursts contain six of each K/S/H. Seeds, signal recipes,
levels, exact sample times and complete-by-construction references are in
`scripts/prepare-xo-percussion-benchmark.mjs` and the private manifest.

One-to-one matching uses `min(40 ms, interval / 4)`. Tight 20/30 ms tolerances
prevent a midpoint or one proposal from receiving credit for two notes.
At 20 ms the single Hat output is 10 ms early, so strict matching credits zero.
That result does not imply six recognized attacks. An early analysis window
that excluded negative timing offsets was corrected before the locked A/B
comparison; both variants use the corrected identical windows.

Each table entry is matched attacks **A→B**, not an official natural accuracy score.

| Interval ms | Tolerance ms | Hat-only H /6 | Snare-only S /6 | Alternating S,H /3 each | Simultaneous K,S,H /6 each | Weak/strong H /6 |
|---|---|---|---|---|---|---|
| 20 | 5 | 0→0 | 1→1 | 1,0→2,0 | 0,0,0→0,0,0 | 2→1 |
| 30 | 7.5 | 1→1 | 1→1 | 2,0→2,0 | 0,0,1→0,0,1 | 2→2 |
| 50 | 12.5 | 3→6 | 3→6 | 3,0→3,0 | 6,1,4→6,2,6 | 3→5 |
| 80 | 20 | 6→6 | 4→5 | 3,3→3,3 | 6,0,6→6,0,6 | 5→6 |
| 125 | 31.25 | 6→6 | 6→6 | 3,3→3,3 | 6,0,6→6,0,6 | 6→6 |
| 200 | 40 | 6→6 | 6→6 | 3,3→3,3 | 6,3,6→6,4,6 | 6→6 |

Protected Snare-only false-Hat outputs, by spacing:

| Interval ms | 20 | 30 | 50 | 80 | 125 | 200 | Total |
|---|---|---|---|---|---|---|---|
| A→B false Hats | 2→2 | 1→1 | 1→2 | 2→2 | 6→6 | 6→6 | **18→19 FAIL** |

Snare-only matched Snare events improve 21→25 of 36, but the protected false-Hat
cost fails the locked acceptance rule. Hat-only outputs total 23→26, including
one unmatched event in each; weak/strong Hats regress at the strict 20 ms case.
Alternating audio still gives 14 unmatched Hats in each version. The legacy
Snare-only control remains 6/8 matched Snare and five false Hats in both,
with one shifted event. Silence and sustained 220/440 Hz nonpercussion tones
produce zero K/S/H in both. Full TP/FP/FN and timing errors are private JSON.

## Natural regressions and Kick

These are **predicted row counts only**, never precision, recall, F1, or a claim
that extra predictions are genuine. Natural labels remain provisional. The
verified natural accuracy gate is **BLOCKED**.

| Exact source window | A K/S/H | B K/S/H |
|---|---|---|
| XO 45–57 | 16 / 9 / 40 | 16 / 9 / 48 |
| MONO Em Là 0–13 | 0 / 0 / 1 | 0 / 0 / 1 |
| Whiplash 8–20 | 20 / 23 / 29 | 20 / 24 / 32 |
| Whiplash 60–72 | 31 / 18 / 36 | 31 / 18 / 40 |
| Whiplash 95–107 | 36 / 39 / 13 | 36 / 39 / 15 |
| Avicii Levels 45–57 | 7 / 22 / 34 | 7 / 23 / 37 |
| Muse Hysteria 45–57 | 27 / 18 / 33 | 27 / 19 / 44 |
| Coldplay Yellow 45–57 | 18 / 9 / 38 | 18 / 10 / 38 |
| Satie Gymnopédie No.1 0–12 | 0 / 0 / 0 | 0 / 0 / 0 |

All source-file and original PCM hashes are verified against the existing
benchmark and recorded in the private manifest. MONO's existing false-Hat
issue persists. More Hats on rock/Whiplash are unverified extra activity, not
an accuracy improvement. XO's 11 added/three removed event keys include three
10 ms shifts rather than 11 newly discovered acoustic hits.

Every Kick event's timing and values are exactly equal in paired A/B replay
across all 17 fixtures and each of the six real browser activation streams.
This is a **PASS for no algorithmic Kick change**, not verified natural Kick accuracy.

## Actual Companion delivery and visible flashes

Owned isolated **Edge 155.0.4283.45** profiles load the real unpacked extension,
capture actual media, enable typed buffered preview through the production
controls, and display the production BeatPattern component/stylesheet.
No generated event messages substitute for detector output.

The harness asserts A=`onset-guided`/`xo-A`, B=`local-prominence`/`xo-B`, typed
preview enabled, 500 ms output throughout the selected passage, and at least
one viewport-visible percussion flash in that passage. The analyzer requires
the exact unique six-run matrix, matching manifest SHA, completed clean runs,
and finite trace-derived audio/song anchors with ≤50 ms spread (observed ≤14 ms).
It explicitly rejects incomplete artifacts. Packaging asserts each source
sentinel occurs exactly once rather than silently accepting a stale variant.

For XO, passage inclusion uses trace `targetPlaybackTime` 45≤t<57.
An independent animation-frame observer records first computed opacity ≥.5
with the whole cell in the viewport. **Visible ID counts are not independent
perceptually separated flashes.**

| Version / row | Classifier proposals | Capture sent | UI received / scheduled | Controller accepted | Viewport-visible IDs |
|---|---|---|---|---|---|
| A Kick | 17 | 17 | 17 / 17 | 17 | 17 |
| A Snare | 9 | 9 | 9 / 9 | 9 | 9 |
| A Hat | 40 | 40 | 40 / 40 | 39 | 39 |
| B Kick | 16 | 16 | 16 / 16 | 16 | 16 |
| B Snare | 9 | 9 | 9 / 9 | 9 | 9 |
| B Hat | 48 | 48 | 48 / 48 | 47 | 47 |

Each run has one Hat `beat-controller:debounce` drop. All accepted XO events
have viewport observations. Animation-start telemetry observes only 36 A and
42 B Hat IDs, while the independent observer sees 39/47; those instrumentation
counts are not treated as extra missing flashes.

A and B are fresh captures of the same recording, not identical feature-frame
phases. Therefore the live Kick count 17→16 is disclosed but cannot be attributed
to B. Replaying each real activation stream with both pickers gives A-stream
17/9/40→17/9/47 and B-stream 16/9/40→16/9/48. Kick remains exactly unchanged
within each stream. Frozen identical activations provide the causal comparison.

Clean controlled transport has A Hat-only 23 accepted/21 viewport-observed,
B 27/27; A Snare-only 21 Snare +17 false Hats accepted/visible; B 25 Snare
visible and 19 false Hats emitted, one debounced, 18 visible. WAV quantization,
warm-up and capture phase differ from pure offline f32; these are delivery
results, not replacements for the frozen acoustic scoring table.

### Timing and cost

- XO classifier-only paired replay, 1,385 frames, ten warm-ups/30 measured:
  A median .2922 ms / p95 .5961; B .3529 / .7230. Model inference is unchanged.
- Offline Hat-only 14 s: 279 inference calls, 5,802.9 ms total inference,
  94.0 ms features; Snare-only 7,075.5 ms inference, 108.9 ms features.
  These accelerated measurements exclude real-time transport/output scheduling.
- Actual XO calibration p95/p99: A 241.61/249.84 ms; B 239.37/239.71 ms.
- First viewport observation minus each event's latest controller/renderer
  epoch target: XO A median 9.56 ms / p95 65.55 / max 117.07;
  B 10.49 / 107.17 / 137.09. This does **not** establish non-regressing timing.
  Extrapolated page-session clocks are not used for this offset because session
  refreshes can shift that estimate; raw wall timestamps/trace anchors are retained.
- Aggregate owned-browser CPU after calibration/resume: A 42.72 CPU s /
  28.46 wall s (150.1% of one logical core), B 45.25 / 28.37 (159.5%). These
  include browser processes and instrumentation, are single observations and
  have different resume times. They are not isolated model CPU or a qualified budget.
- Concurrent-build Snare run failed deadlines as described above. A prior
  controlled attempt also reached file end before diagnostic collection,
  closing capture; the transport fixture now has 12 s silent tail. Both failed
  artifacts are retained and excluded from the clean ledger. An earlier
  service-worker dynamic-import diagnostic attempt failed; collection now
  uses the existing privileged offscreen endpoint.

These are browser software measurements. No physical speaker/display alignment,
listening quality, absence of echo/pops, or human perceptual separation is certified.

## Private A/B listening and reproduction

Generated guide: `scratch/xo-percussion-recovery/ab-listening-guide.html`.
Load exactly one of:

- `scratch/xo-percussion-recovery/candidate-A/extension`
  — **Kora Music Companion Private XO Baseline A**.
- `scratch/xo-percussion-recovery/candidate-B/extension`
  — **Kora Music Companion Private XO Candidate B (NO-GO)**.

Disable other Companion versions, enable developer mode in Chrome/Edge, Load
unpacked, and reload both local pages. Use one grid owner in the same browser.
The local review server is left running on deterministic ports 5173 (grid)
and 5174 (audio source), command `node scripts/verify-private-companion.mjs --serve`,
PID 7392. Reuse it; if stopped, restart that command from the repository.

1. Open `http://127.0.0.1:5174/`, choose the exact Downloads MP3 above, start
   at zero at rate 1, and click Companion's toolbar icon on this source tab.
2. Open `http://127.0.0.1:5173/`, select **Authorized audio-only review**,
   listen to captured output, allow calibration, and Pause before source 45 s.
3. Open Private candidate and truthfully complete all four checks: authorized
   audio; captured output audible without echo/second playback; intentional
   delay accepted; **Show unverified instrument predictions during buffered playback**.
4. Click **Enable calibrated 500 ms delay** while paused. An incomplete or
   over-budget calibration stays blocked. Resume to collect more samples if needed.
5. Confirm **UNVERIFIED DETECTOR PREVIEW**, correct A/B label,
   **experimental-buffered**, actual **500 ms** delay and enabled typed preview.
   Play through 45–57 s with the grid visible. Do not seek after enabling;
   seek/source/generation changes revoke preview.
6. Pause, disable the first version, enable the other, reload both pages and
   repeat from zero with the same device, browser, volume, source and delay.
   Return to A or the prior private package afterward; B is diagnostic only.

YouTube zero-delay live preview remains a separate previously implemented
route. It is not this matched-buffer test; synchronized video cannot enable
the audio-only buffer. No safeguard is bypassed to obtain typed flashes.

Both packages use the same rows and trace interfaces:
`window.candidate.telemetry.records` in the grid and privileged extension
message `{target:'beat-offscreen',kind:'percussion-diagnostics'}`. Score recording
is bounded to 1,800 frames/512 predictions, disabled by default and includes
no PCM. Raw audio, scores, profiles and trace artifacts remain ignored/private.

Reproduce against the preserved local benchmark with:

```powershell
node scripts/trace-xo-percussion.mjs
node scripts/compare-xo-percussion.mjs
node scripts/prepare-xo-transport.mjs
node scripts/package-music-extension.mjs --private --xo=A
node scripts/package-music-extension.mjs --private --xo=B
# Keep the existing 5173/5174 review server running.
node scripts/verify-xo-companion.mjs
$env:KORA_XO_TRANSPORT_INPUTS='hat-only,snare-only'
node scripts/verify-xo-companion.mjs
Remove-Item Env:KORA_XO_TRANSPORT_INPUTS
node scripts/analyze-xo-percussion.mjs
```

The original acoustic preparation command is
`node scripts/prepare-xo-percussion-benchmark.mjs`; it deliberately refuses to
overwrite an existing manifest and depends on the preserved earlier local
benchmark/corpus identities. Preserve existing evidence before preparing a
separate fresh benchmark. Avoid running heavy builds during timed playback;
the load failure above remains a separate robustness result.

### Evidence fingerprints

All paths in this table are under `scratch/xo-percussion-recovery/`.

| Artifact | SHA-256 |
|---|---|
| `manifest.json` | `6abcc8fcbbdd05171327094f571d3092ad90e2ed2e0e0ba1efcdef469ca7baa7` |
| `comparison.json` | `f15f8297059810413377cbd24562333912e1487af31c3ccc3e5ec357c0859d5f` |
| `actual-msedge-xo.json` | `ad1a68ef8f039ba1bfdb8b169229c5bb0dc3f7ebe42086c2aa122d16c5832321` |
| `actual-msedge-hat-only-snare-only.json` | `57ea88a975303384f003949266cd9c45872f50224b7842b303d4d3742276a9b5` |
| `candidate-A/kanban-music-companion.zip` | `ff1d5ec2f543602de909f0a96f976d8c0a81f759b214f5df02f44216ca86cc14` |
| `candidate-B/kanban-music-companion.zip` | `b114369ec1321a3291d69aec3604816bf415900f7558951b817291cbf67738fd` |

`evidence-ledger.json` joins each prediction's score, novelty, original onset,
capture receipt, trace ID, send/receive/scheduler/controller stages/drop reason
and actual viewport timestamp. `baseline-offline/*.json` and
`candidate-replay/*.json` retain all raw score frames and rejected/grouped peak
decisions. `analysis-log.jsonl` is the compact generated stage summary.

## Gates and listening acceptance

| Gate | Status |
|---|---|
| Exactly one focused correction; no model search | PASS |
| Improved constructed 50 ms isolated Hat/Snare matching | PASS, narrow synthetic result |
| Protected Snare-only false-Hat cost | FAIL, 18→19 |
| Reliable 20/30 ms Hat recovery and overlapping Snare recovery | FAIL |
| Verified genuine natural Snare/Hat improvement | BLOCKED |
| Perceptually distinct rapid flashes / subjective better listening | BLOCKED; overlapping visibility observed |
| Kick algorithmic regression on identical activations | PASS, exact equality |
| Natural Kick accuracy / physical synchronization | BLOCKED |
| No timing/CPU regression | Not established; XO B DOM p95 is worse and load run fails |
| Real Companion typed-preview delivery, exact A/B identity, eligible 500 ms output | PASS for the recorded local route |
| Independent complete natural reference and official accuracy gate | BLOCKED |
| Adoption/release of B | **NO-GO** |

Focused tests, all 912 application tests across 116 files, and all 16 script
tests passed. Lint has no errors, with existing unrelated React-hook warnings;
TypeScript, production build, bundle budget and normal/private A/B packaging
passed. The final delivery revision repeats the complete suite and writes its
results under private scratch logs. Review findings on unchecked package
substitutions, missing passage visibility, incomplete run coverage, manifest
binding and invalid clock anchors were fixed. Existing lifecycle, stale-event,
rapid merger, floating-point debounce boundary, video, Spotify, no-semantic-
qualification and audible-output failure controls remain covered by the suite.
No copyrighted audio, raw provisional annotation data, browser profiles or
secrets are committed. No deployment or public publication occurred.

The user's annotations remain **provisional-human-reference**, with incomplete
coverage, unknown timestamp errors and ambiguous instrument identity. Search
windows retain uncertainty labels. Unmatched natural predictions are not
definite false positives, and no official natural P/R/F1 was computed or gate
passed. Official evaluation still needs a separately verified, complete natural
subset with sufficiently accurate onsets and explicit ambiguous-interval handling.

User listening remains requested on the same 45–57 s passage:

1. Are Snare/Clap hits less frequently missed?
2. Are repeated Hi-Hats more consistently represented?
3. Do audibly distinct attacks appear separately?
4. Are there more false Hat flashes?
5. Has Kick become worse?
6. Does buffered playback sound normal, without echo, pops or visible timing drift?

Listening feedback can guide a future trained-detector task; it does not promote
these incomplete labels into official accuracy scores or override B's failed
controlled regression.
