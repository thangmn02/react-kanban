# Hat real-playback discrepancy recovery

2026-10-16, Asia/Saigon. **Overall NO-GO for accurate, synchronized full-mix tracking.**
Visual fusion is reproducible and the private R prototype improves known 50/80 ms
sequences. It does not repair recognition, certify timing, or establish listening
acceptance. The user's continuous brightness, missing flashes, late flashes and
uncertain identities remain valid qualitative evidence. No official natural
Precision, Recall or F1 was calculated; provisional marks remain investigation aids.

## 1. Revision and private identities

Baseline: `e2e2b73a944270a66057c34224629bc770f5f8f7`, branch
`codex/beat-grid-quality-recovery`. Implementation revision:
`4082e07250301944c8dea11ab3acfee425740b79`. Final delivery revision and artifact hashes
are recorded in `scratch/hat-playback-discrepancy/final-revision.json`; resolve the
report delivery commit with `git log -1 --format=%H -- plans/reports/engineering-261016-0447-hat-playback-discrepancy.md`.

Exactly two current-task packages, version 0.3.24, **UNVERIFIED DETECTOR PREVIEW**:

| Identity | Extension name | ZIP SHA-256 |
|---|---|---|
| hat-A | Kora Music Companion Private Hat Baseline A | `e6c4446164729fe9141bb4b7a0df13afdd802e24c0981e3e30ba4c2455f1dc33` |
| hat-R | Kora Music Companion Private Hat Visual Recovery R | `668ab68b6bb44b5f2d4d27758835e0d454dbd61ec3de20ab6eae065c65774bb5` |

Packages live under `scratch/hat-playback-discrepancy/candidate-A/` and `candidate-R/`.
Both use onset-guided classification, thresholds `[.22,.24,.32,.22,.30]`, the same
ADTOF model (`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`),
stereo mean/44.1 kHz/FFT 2048/hop 441/84 bins/window 100/step 5/right context 10,
and eligible intentional 500 ms audio-only delay. Previous detector B stays NO-GO.

## 2. Equivalent-input matrix

Original: `%USERPROFILE%/Downloads/Lil Uzi Vert - XO Tour Llif3 (Official Lyric Video).mp3`,
SHA-256 `98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05`.
Actual playback uses the full original file, rate 1, selected source seconds 45–57.
Offline decoding uses the same original source, with full context through second 60.

| Test | Exact input/path | Result |
|---|---|---|
| T1 | Known constructed Hat WAV; production extractor/ONNX | 23 Hat proposals in 44–58 s; rapid attacks already merge or are suppressed upstream |
| T2 | Byte-identical pre-capture WAV; actual Edge tabCapture/Companion/Grid | A/R each emit and visibly identify 25 Hats; content alignment accounts for capture phase |
| T3 | Original XO MP3; production offline path | 16 Kick / 9 Snare / 41 Hat proposals in 45–57 s; these are predictions, not accuracy scores |
| T4 | Same original MP3; actual buffered private route | A: 17/9/41 emitted; R: 16/9/40 emitted; detailed downstream counts below |
| T5 | Six constructed events at each fixed interval; actual production renderer | Full 24-run A/R × six intervals × reduced/normal motion matrix; no recognition claims |
| T6 | Time-aligned XO Hat stem/full mix | UNAVAILABLE: no existing aligned stem; no separation artifacts or independent stem truth invented |

Hat WAV SHA-256 `74aabf44e4870d08675f6196dc701beb5b8a29ca8a94f794fcf4152d7d72afe3`;
Snare control WAV `8060b950c2590287b8a88e8ccff785fd83b5f969376b2093f1507ee04d4030fc`.
Constructed bursts contain six known attacks at each interval, with warmup and silence.
Edge 155.0.4283.45 ran one capture/grid owner at a time, with matching configuration
and no simultaneous builds during clean measurement. Browser-skill bootstrap failed
with EPERM; repository-owned isolated Edge harnesses provided actual capture evidence.

## 3. Clocks and event ledger

Machine evidence is retained privately under `scratch/hat-playback-discrepancy/`:
`manifest.json`, `discrepancy-ledger.json`, `actual-msedge-xo-hat-only-snare-only.json`,
`actual-msedge-xo-load.json`, `renderer-results.json`, `regression-results.json` and
`captured-replay/`. The analyzer asserts complete run matrices and source/model/build
identities. Raw audio is excluded from Git.

Stable trace IDs link feature/audio time, scores, peak decision, emission, offscreen
send, bridge receive, scheduling, acceptance, DOM commit, animation start and sampled
visible identity. Private diagnostics retain 400 feature blocks, 1,800 score frames
and 512 predictions, without PCM. Default builds leave these endpoints disabled.
Source-to-capture feature fits pass normalized RMSE .0098–.0658, stable half-window
offsets within 5 ms and alternative-fit contrast ≥25.2; grid resolution is 2.5 ms.
Raw musical timestamps remain intact. Estimated content time is a separate field.

Replaying identical captured features through the production model reproduces all
six clean runs with **maximum score difference 0**, 1,800 comparable frames/run.
Offline/source and captured/online counts can differ before transport because model
window phase and captured features differ; this is not a visualization correction.
Raw UI source labels lead feature-aligned content by approximately 85–92 ms median.
They are not treated as acoustic truth. Output deadlines instead use the owned
AudioContext `getOutputTimestamp()` and the actual 500 ms buffer, independently of
the UI's target-clock conversion. Physical speaker/display timing remains unmeasured.

## 4–5. First supported failure stages and delivery

| Case | First supported stage / evidence | Uncertainty |
|---|---|---|
| Constructed Hat 49.100 s | CLASSIFIER_SUPPRESSION: local activation .48175 exceeds .22, novelty .21509 does not; no separate rise | Known construction; no threshold change justified by this case alone |
| Constructed simultaneous K/S/H 7 s | MODEL_NONRESPONSE: maximum Snare activation .01971 within ±30 ms | Preserved control, not an XO stem |
| XO provisional Snare 47.346 / 53.459 s | UNRESOLVED_ACOUSTIC_IDENTITY; Snare maxima .1170/.0127 in ±150 ms search windows | Neither identity nor clicked onset is verified |
| XO A 52.54489 s, trace `1dbc5fca-b42c-4314-8fab-0c6e03b5c081:525` | Observed controller debounce; possible SUBTYPE_DUPLICATION precedes downstream loss | Genuine separate Hat is unproven; not a definite false negative |
| Constructed Snare R 53.12501 s, trace `8ca19a89-0bb9-4538-9acf-2c918f9c32ee:394` | TIMING_FAILURE: first visible identity 153.31 ms after known-onset output-clock proxy | Software proxy, not physical scan-out |
| T5 six events/50 ms | VISUAL_FUSION at renderer envelope: A two brightness attacks, R six | Human perception pending |
| XO R 53.32054 s, trace `ba3ddc6d-c272-4596-8dbb-ba9057e178b6:532` | Accepted and DOM-committed, but no animation-start/visible identity observed | Remaining renderer observation failure; acoustic identity unverified; excluded from timing denominator, explicitly counted here |

XO Hat stage counts: A **41 emitted/sent/received/scheduled → 40 accepted/committed/visible**,
with one debounce. R **40 emitted/sent/received/scheduled/accepted/committed → 39 visible**.
All 25 Hat-only outputs reached acceptance and visible identity in each actual run.
No evidence supports treating every unpaired natural prediction as a false positive.
At a 20 ms agreement tolerance, offline/capture Hat proposals pair 36/41 for A and
40/41 for R; these compare pipeline outputs, not independently supported attacks.

## 6. Visible retriggers and decay

Measured viewport background RGB composited with overlay alpha, normalized between
idle/hit colors; an attack crosses .5 after decaying to ≤.3. This excludes shadows,
spatial geometry, physical luminance and human perception. DOM identity alone is
insufficient. T5 normal-motion results, six constructed events in every cell:

| Spacing (ms) | 20 | 30 | 50 | 80 | 125 | 200 |
|---|---|---|---|---|---|---|
| A brightness attacks | 1 | 1 | 2 | 2 | 6 | 6 |
| R brightness attacks | 1 | 1 | 6 | 6 | 6 | 6 |
| Actual T2 A attacks (25 detected total) | 1 | 1 | 2 | 2 | 4 | 5 |
| Actual T2 R attacks (25 detected total) | 1 | 1 | 4 | 6 | 6 | 6 |

Actual T2 predictions per burst are 1/1/5/6/6/6 for both builds. Tight, known-reference
matches are 0/1/5/6/6/6 (tolerances min[40 ms, interval/4]); a timestamp outside that
tolerance is not turned into a match. The 50 ms R burst has five predicted identities
but four brightness attacks. Actual frame gaps reach 79 ms: renderer-only success
does not guarantee arbitrary real-runtime retriggers. At 80 ms, A bright spans are
233/224 ms; R spans are 34/33/33/99/33/33 ms. All raw attacks/decays are in the ledger.
R reduced motion stays at .35 opacity with no ≥.5 rapid attacks. Twenty-to-thirty ms
activity still fuses, with browser refresh and human perception limits acknowledged.

## 7. Timing and overload

Clean measurements below are p95 ms, signed first-visible minus predicted-onset
output-clock proxy. They exclude missing visible observations. Natural onsets are
model predictions; the constructed control additionally has known sample onsets.

| Actual run | Model emission | Transport | Visible minus predicted output | Visible minus known output |
|---|---:|---:|---:|---:|
| XO A | 240.14 | 95 | 67.67 (n=66) | unavailable |
| XO R | 231.50 | 30 | 41.47 (n=64) | unavailable |
| Hat-only A / R | 229.95 / 241.47 | 16 / 46 | 49.02 / 27.41 | 42.75 / 17.12 (n=24 each) |
| Snare-only A / R | 221.75 / 241.66 | 26 / 106 | 90.84 / 160.47 | 61.14 / 43.32 (n=20/21) |

Separate captures and runtime jitter prevent attributing these timing differences to
R. No timing correction was implemented; R Snare maximum known-output error remains
153.31 ms. Clean output clocks run and advance continuously, but physical ≤50 ms p95
is BLOCKED and consistent software timing is FAIL.

One 8 s bounded CPU case constrained only the owned isolated browser to one CPU with
a 70/85 ms competing duty cycle; affinities were restored and verified. This loads
the entire owned browser, not only inference. Maximum observed model-input lag is
1,827.8 ms; capture expires, reacquires, resets its output clock and finishes degraded
with buffer 0 and typed preview off. No single alignment is fitted across that reset.
Old-event/drop telemetry is preserved; late/stale proposals are not rewritten as
current music. No delay increase was added. Capture replacement loses the old bounded
score ring, so loaded recognition evidence is partial. Audio continuity/pops during
the transition are unverified: robustness fails, despite explicit preview revocation.
Failed load-target discovery attempts are retained separately, not counted as passes.

## 8–10. One correction, before/after and non-regression

R changes only the private Hat visual transient to 40 ms and suppresses underlying
Hat onset fill/shape overlays. Model/classifier/thresholds, event count/time, other
rows and ordinary build defaults are unchanged. No second prototype or peak search.
The identical-input T5 comparison isolates the visual improvement; six actual clean
paths establish its limits. **MODEL REPRESENTATION LIMITATION — TRAINED DETECTOR
REQUIRED** remains the stopping decision for recognition recovery demonstrated by
the constructed overlap/false-Hat controls; ambiguous XO attacks remain unresolved.

Seventeen preserved production activation traces replay with every event value and
timestamp exactly unchanged between baseline, A and R. Controls include XO,
MONO (0 Kick/0 Snare/1 Hat), three Whiplash passages, Levels, rock/pop, piano,
silence/tones, known Hats, Snare and overlaps. Kick outputs are exactly unchanged.
Snare-only offline retains 21 Snare + 18 false Hats; actual A/R each retain 21 Snare
+ 17 false Hats. R makes existing wrong predictions easier to see; it does not remove
them. Natural regression counts are frozen-output equality, not accuracy validation.

## 11–12. Listening guide and gates

Generate with `node scripts/package-music-extension.mjs --private --hat=A` / `--hat=R`.
Open local `scratch/hat-playback-discrepancy/ar-listening-guide.html`. It identifies
builds, one-owner setup, original source, typed-preview checks, identical 500 ms delay,
45–57 s listening, reload/reset behavior and overload limitations. Judge continuous
brightness, absent/extra/late flashes and uncertain instrument identity qualitatively.
Complete millisecond annotations are not requested. User acceptance remains pending.

| Gate | Decision |
|---|---|
| Equivalent input/build/provenance and captured-feature replay | PASS for the six clean runs |
| First-stage case attribution | PASS with explicit unresolved natural identities and renderer observation limit |
| Bounded visual mechanism | PASS for known T5 50/80 ms retriggers; real playback/human acceptance limited |
| One correction / false-Hat and Kick non-regression | PASS for unchanged detector outputs; no accuracy improvement claimed |
| Real timing/load investigation | PASS for evidence completeness; software timing and load robustness FAIL |
| Official natural accuracy / physical synchronization | BLOCKED / BLOCKED |
| Full regression, type, lint, build and bundle | PASS: 912 Vitest tests, 18 Node tests, 17 exact frozen traces, build/typecheck and bundle; lint has zero errors and 25 existing warnings |
| Adoption / public release | NO-GO / not performed |

Final-revision reruns and checksums are retained in the private receipt and `final-*.log`
files. Read-only review verified report/artifact agreement and explicit missing-visibility
denominators. Eleven closed task-owned browser profiles were removed after process and
path checks. The review server was restarted as PID 37640 on fixed ports 5173/5174;
both pages returned HTTP 200. It is intentionally left running for the comparison.

Open questions: whether R helps the user's actual listening; which natural attacks
are independently identifiable; renderer observation loss under real state changes;
and uninterrupted audible output under capture expiry. No further model/threshold
search or public qualification is implied by this delivery.
