# Earlier live percussion decisions: private L1 delivery

Date: 2026-10-19, Asia/Saigon. Branch: `codex/beat-grid-quality-recovery`.
Implementation: `44381b228b1506602b239134f9ebaa3402adf1d6`.
D1 baseline checkpoint: `55d69054015e011da4f1de95700622d4cf40f668`.

## Decision

**GO for a selectable private L0/L1 listening comparison. NO-GO for default
promotion, universal accuracy/resource qualification or physical ±50 ms.**
L1-gap0 reduced controlled software animation p95 by 10–24 ms, but some worst
samples became slower. The remaining delay is about 200 ms. L0 stays default;
switching back retains the audible source and its clock. No deployment ran.
Human listening acceptance and fresh L1 provider listening remain open.

The user approved the bounded L1 offline comparison after the
[D1 architecture checkpoint](engineering-261019-1101-low-latency-semantic.md).
This report completes the engineering comparison and private handoff; it does
not manufacture final listening or physical acceptance.

## Identity, novelty and decision boundary

ADTOF weights remain
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`;
CNN weights remain
`785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`.
The frozen classifier SHA remains
`c84142ba2a4c202211a6182d00cc3eadf192ff5ecbf10f5675b0a64c0ac733b0`;
frontend SHA remains
`0abd2a532ab585509fab0e93cf174ec763bee6b0b317550175bcf9a3c8355317`.
Thresholds, feature values, model context, cadence and onset timestamps did not
change. Offline H0, independent Bass and cached Lead retain their contracts.

L1 changes postprocessing semantics: close a pending peak after zero rather
than two intervening candidate frames. For isolated peaks the decision is p+3
instead of p+5. This is a new decision variant, **not a new model**. Development
also compared immediate p+2 closure. Both had identical development recognition;
the conservative tie selected gap0 before holdout. Immediate closure was not
evaluated on holdout or integrated. No further sweep or threshold tuning ran.

The actual graph has bidirectional recurrence. With 23.22 ms FFT centering,
100 ms future context, 30 ms isolated decision horizon and the existing batch
phase, L1 requires **153.22–193.22 ms of input** after its predicted onset,
versus L0's 173.22–213.22 ms, before computation and presentation. A 20 ms score
horizon reduction produces 0 or 50 ms release savings on individual retained
events at the five-frame cadence. It does not guarantee 20 ms per visible hit.
The existing output-clock estimate is separate, typically 50 ms and sometimes
66 ms in the long L0 run. These estimates are not calibrated speaker latency.
Even subtracting 50 ms from the most favorable input bound leaves over 100 ms
before computation/display. L1 does not establish the physical ±50 ms target.

Historical causal-student accuracy rejection and reduced-context probes were
reused as architectural evidence, as recorded in D1. ONNX conversion is not
novelty. L2 training/search was not repeated; L3 speculative semantic flashes
were not introduced. A causal redesign needs separate recognition evidence and
appropriate training data, rather than another offset or conversion experiment.

## Recognition evidence

All private evidence below is under `scratch/low-latency-semantic/l1/`.
`selection.json` binds the evaluator, original corpus, saved activations and
development results before confirmation. Final hash checks confirmed all
65 original results/activation bindings and the frozen evaluator unchanged.
No neural baseline rerun was needed for D2. Runtime adapter parity covers
**70 streams / 222,875 frames**, including exact event values and decision frames.

The original MDB split contains five development and 18 locked holdout tracks,
with paired drum-only/full-mix domains. Scored duration is 90 seconds per domain
on development and 311.873 seconds per domain on holdout. Paired domains are
not independent additional tracks. Original published annotations are author
reviewed but may omit events; checkpoint training overlap is unknown. Matching
reuses the original one-to-one protocol, 50 ms natural/40 ms constructed caps,
and a nearest-same-class spacing limit. These scores do not certify exhaustive
ground truth or generalization to a training-disjoint population.

Percent P / R / F1 on development; L0, gap0 and immediate are identical:

| Domain | Kick | Snare | True Hi-Hat |
|---|---|---|---|
| Drum-only | 94.74 / 98.63 / 96.64 | 88.02 / 72.06 / 79.25 | 93.05 / 80.93 / 86.57 |
| Full mix | 83.75 / 91.78 / 87.58 | 83.70 / 55.39 / 66.67 | 93.05 / 80.93 / 86.57 |

Percent P / R / F1 on locked holdout:

| Domain / variant | Kick | Snare | True Hi-Hat |
|---|---|---|---|
| Drum-only, L0 and L1 | 97.22 / 97.43 / 97.33 | 86.84 / 84.26 / 85.53 | 88.60 / 90.56 / 89.57 |
| Full mix, L0 | 95.08 / 91.01 / 93.00 | 87.26 / 68.51 / 76.76 | 90.17 / 78.47 / 83.91 |
| Full mix, L1 | 95.08 / 91.01 / 93.00 | 87.26 / 68.51 / 76.76 | 90.02 / 78.47 / 83.85 |

L1 adds three proposals and removes none: FunkJazz full-mix Hat at 15.29 s
inside the scored interval; LatinJazz full-mix Hat at 19.8 s and Punk drum-only
Kick at 19.81 s outside the original [1,19) interval. Inside the scoring region,
Hat matches stay 532 and unmatched proposals rise 58→59. The Hat F1 loss is
0.066 percentage points. No exact class/time duplicates appear. Natural matched
onset error p95 remains about 20 ms; that is localization, not delivery latency.

Dense holdout recall is unchanged: Kick 3/4, Snare drum 29/40 and mix 26/40,
Hat drum 22/22 and mix 20/22. Overlap recall is unchanged: drum Kick/Snare/Hat
96.43/96.84/86.15%; mix 90.63/84.74/76.45%. Coverage is small. Ambiguity-aware
cross-class associations are retained in `regressions.json`; simultaneous hits
and incomplete annotations prevent treating them as a clean confusion matrix.

No proposals change in saved ADTOF regressions for Nujabes full song, actual
Rằng [26,44), actual HSKT full song, Whiplash full song, China [200,220), or the
original unscored XO passage. Source hashes, not current listening-slot aliases,
bind the actual recordings; no slot assignment was changed. All song judgments
remain `provisional-human-reference`, with unknown exact onset uncertainty and
ambiguous intervals. No official P/R/F1 or definite false-positive claim uses
those marks. This does not improve live Hats to the frozen H0 CNN behavior.

The predeclared relative screens passed. The frozen evaluator's historical
`eligibleForRuntime` field means **eligible for runtime evaluation only**.
`offline-qualification.json` explicitly keeps `promotionEligible:false`, resource
and latency qualification false, and physical synchronization unverified.

## Actual browser timing and resources

Actual private Companion, worklet/ONNX worker, Kora transport/controller/grid,
the same authorized deterministic 180-second CC0 source, 1x and no intentional
delay were used in isolated Chrome 155.0.8059.80 on this Windows machine.
Foreground trials use about 24 seconds; stress uses the same two-worker CPU
contention as D1. No heavy build/test ran during the successful quiet trials.
These are independent trials, not matched acoustic events or statistical bounds.
Raw receipts remain **PARTIAL**, preserving software/headless coverage limits.

Software animation delay in ms relative to existing mapped event targets:

| Trial | Detector | n | p50 | p95 | Worst |
|---|---|---:|---:|---:|---:|
| Foreground 1 | L0 | 80 | 185.41 | 227.65 | 234.35 |
| Foreground 1 | L1 | 80 | 172.66 | 209.99 | 258.34 |
| Foreground 2 | L0 | 85 | 195.55 | 217.50 | 249.59 |
| Foreground 2 | L1 | 81 | 172.25 | 201.29 | 234.59 |
| Foreground 3 | L0 | 78 | 181.67 | 225.54 | 230.03 |
| Foreground 3 | L1 | 82 | 188.99 | 201.48 | 215.83 |
| To source EOF | L0 | 641 | 192.03 | 214.21 | 294.07 |
| To source EOF | L1 | 663 | 185.10 | 204.22 | 297.63 |
| CPU contention | L0 | 232 | 191.46 | 220.75 | 242.52 |
| CPU contention | L1 | 225 | 165.19 | 208.90 | 283.01 |

Combined values include independently scheduled Bass. Percussion-specific
animation p95: foreground Snare L0 226.45/209.64/221.91 vs L1
202.59/200.32/202.26; Hat L0 229.70/219.74/229.13 vs L1
217.80/201.77/202.36 ms. Long Snare 214.23→204.18 and Hat 215.40→205.19;
stress Snare 220.75→214.63 and Hat 224.30→212.32. No Kick appears in these
Companion timing windows; the separate constructed Kick control provides coverage.
Bass long-run p95 is 27.94→31.11 ms, with worst 71.89→126.33 ms. Worst-case
regressions are retained and prevent a blanket tail or resource pass.

Both long trials reached natural 180-second EOF, with 177.154/177.125 seconds
of admitted preview, 29 healthy playing samples each and no unexpected lifecycle
records. Observed queue depth stayed zero. Long inference p95/worst was
30/34 ms L0 and 29/31 ms L1; stress 31/34 and 32/34 ms. Offscreen→background
p95 was 1 ms long / 2 ms stress; background→app 4 ms long and 5/7 ms stress.
Frame presentation and occasional transport tails remain observable.

There are two background `beat-sync:clock` drops in every paired trial, with
zero explicit app semantic drops in the measured window. Long app
accepted/committed/rendered counts are L0 652/652/641 and L1 675/674/663.
Bounded stage logs, startup gating and per-row rendering mean these are not
proof of zero end-to-end loss. Accepted onset IDs are unique in all ten paired
trials. See `runtime-summary.json` and the raw sibling `l1-runtime/` folders.

Observed isolated Chrome CPU/RAM (L0→L1):

| Trial | Mean logical-core equivalent lower bound | Sampled RSS sum p95, GiB |
|---|---|---|
| Foreground 1 | 1.247→1.215 | 1.198→1.232 |
| Foreground 2 | 1.251→1.214 | 1.242→1.197 |
| Foreground 3 | 1.219→1.189 | 1.233→1.241 |
| Long | 1.211→1.196 | 1.220→1.204 |
| Stress | 1.348→1.487 | 1.179→1.224 |

CPU uses observed process-counter deltas and omits startup before first sighting
and short-lived processes. RSS sums can double-count shared pages and miss
between-sample peaks. Five/31/12 samples were collected per short/long/stress
trial. Harness, sampler and stress-worker costs are excluded. No agreed target
browser budget or universal resource pass is inferred, especially from stress.

## Rapid controls, lifecycle and preserved failures

Six complete 14-second actual worker/grid controls reuse D1 sample-accurate
20/30/50/80/125/200 ms references. Replaying L0 on the same fresh L1 activations
preserves all constructed matches, including segment comparisons, and adds no
absent-row events. Actual L1 worker events exactly match the replay. This is
not a second L0 delivery measurement. Worker queue maximum is zero.

Worker events / visible traces: overlap 54/54, Kick-only 18/18, Snare-only
39/38, Hat-only 23/23; silence and sustained tones 0/0. The Snare-only control
still contains **18 false Hat proposals**, unchanged from L0. Hat 0.99 s and
1.00 s arrive in one worker batch; the earlier latest-per-row trace is
coalesced before a frame. This is one missing visible observation, not proof
of a missing verified Snare. All worker predictions were delivered to the
harness, but **134 events / 133 visible traces is not a per-hit visual pass**.
No artificial serialization, timestamp correction or renderer rebuild was used.
Existing rapid/overlap recognition misses are not repaired by L1.

Actual controlled lifecycle checks passed: L1→L0→L1 preserves source URL,
advancing 1x clock and audible graph; pause revokes preview; resume requires
reactivation; two seeks and source replacement clear old events and reacquire
capture; independent Bass remains responsive. Tab switching was exercised, but
headless visibility stayed `visible` throughout: hidden/minimized qualification
is unavailable. One active source and the existing owner fencing were used;
simultaneous competing owners are not newly qualified.

Three failed attempts remain available: initial L1 configuration was stripped
by the relay (fixed by enum forwarding and regression test); initial long L0
lost its offscreen receiver around source second 44 (cause unresolved; source
edits/Vite updates coincided, while quiet L0/L1 repeats passed); initial
lifecycle helper did not reopen the source-remounted disclosure (helper fixed,
guards unchanged, retry passed). These failures were not erased or counted as
successful trials. A late Brave handoff tab had closed and was recreated.

## Integration, providers and rights

Private Companion **0.3.25**, built with
`node scripts/package-music-extension.mjs --private`, exposes the capability-gated Live detector selector. L1 restarts only
the drum worker, fences its old callbacks and resets synchronization. It keeps
capture/output, independent Bass and the established event pipeline. Revoke,
disable and configuration-failure cleanup restore L0. A later worker runtime
failure retains the selected classifier for the existing retry path; it does
not automatically fall back to L0. Older companions keep the existing UI.
Public, XO A/B and Hat A/R actual isolated package builds exclude the L1 module,
constructor/import, runtime whitelist and capability. No release was published.

Provider discovery/control and semantic eligibility remain separate. Existing
seven-provider tests pass; prior real provider receipts are reused from the
[provider report](engineering-261019-0549-provider-live-upgrade.md), not relabeled
as new L1 tests. In Brave, fresh read-only Kora UI observations show YouTube
metadata and an advancing playing clock; current capture is unproven and the
older Companion has no Live detector selector. Earlier SoundCloud UI exposed
metadata and a paused player. No provider playback or consent was changed.
Fresh L1 YouTube listening remains pending the private extension reload and
the user's authorized, audible source. Apple Music/Spotify discovery/control
contracts are regression-tested, but no fresh signed-in playback is claimed.
Spotify semantic analysis and protected Apple Music analysis remain blocked.
Deezer/Tidal/YouTube Music have shared-path regression coverage, not new live
account or protected-audio qualification.

The repository's model notice records ADTOF as local evaluation only with
CC-BY-NC-SA-4.0 release rights unresolved. This sprint changes no model/audio
rights status and grants no provider-analysis permission. There was no cloud
analysis, media download, provider buffering, speed change, DRM workaround or
new Lead generation.

## Verification and handoff

Full Vitest: **942 tests / 118 files passed**, including Music/Focus and source
ownership regressions. Additional Node tests: **20 passed**. Python comparison,
scoring and compatibility tests: **9 passed**. Typecheck, lint and production
Vite build passed. Lint retains 31 warnings; build retains the large-chunk
warning. Actual H0 Web regression passed with all four rows (Kick 11, Snare 17,
Hat 34, Bass 20), same source clock across visual modes, pause/seek/source switch
and Beta-off recovery. No H0 inference rerun or cache mutation was needed.
Read-only reviewer found no remaining material implementation/policy blocker.

Use the [Vietnamese L0/L1 guide](../261019-1101-low-latency-semantic/listening-guide-l1-vi.md).
The private package includes a corrected standalone guide for **1420/music**.
Brave's Kora tab is left open. Reload the existing unpacked private extension
from `scratch/browser-first-candidate/extension`, verify 0.3.25, then refresh
Kora and the source tab. Browser tooling cannot perform the blocked internal
extensions-page reload; the user must do that normal browser action. Complete
the three live checks only if true, choose L1 and enable no-delay live preview.
Switch the selector to L0 to roll back. No calibrated delay is needed.

Retained server: PID 38164, `node scripts/serve-hybrid-beta.mjs`, 127.0.0.1:1420,
this worktree. Measurement contexts, stress workers and port 1431 are closed.

**PHYSICAL SPEAKER-TO-PIXEL SYNC — UNVERIFIED.**

Unresolved: human L1 listening acceptance; authorized real-provider L1 capture;
calibrated physical timing; a target device resource budget; hidden/minimized
behavior; the first long L0 receiver loss; exhaustive natural labels and unknown
checkpoint training overlap. If materially lower live semantic latency remains
required after listening, the smallest justified next study is one separately
trained/validated causal design with data/rights prerequisites, not more L1
threshold tuning on favorite songs.
