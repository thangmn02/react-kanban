# Targeted Hat false-positive and sequence-loss recovery

**NO-GO for advancing a corrected private hybrid.** Raising CNN's threshold or
rejecting Hat when its Snare score dominates does not protect independently
referenced Hats. Frozen A/B and an explicitly hypothetical H0 remain available
for investigation; nothing is integrated into the production Companion.

The [private investigation](http://127.0.0.1:5173/lab/?mode=hat-recovery) navigates
the exact sources and cases, keeps one native playback clock while switching
tracks/renderers, and exports per-event, cycle and raw-score evidence. The
[operator guide](../../docs/private-acoustic-visual-lab.md) explains the workflow.
Branch: `codex/beat-grid-quality-recovery`; starting commit:
`456ff90a70df2ab68003c9b25c8cf6a8ed7a9301`. Final commit, source/code hashes,
regression logs and server ownership are bound in the post-commit
[delivery receipt](../../scratch/hat-recovery/delivery.json).

## Frozen identities and scope

The existing A/B/C pipelines and full-song numerical contract are identical to
the previous delivery, including contract SHA
`927bd3a00550173ae760eaab42a543b92bba97fa17350d7c929e71acf5a113b9`.
An inference container/format is not treated as model novelty. All valid full-song
and previous 65-input results were reused; there was no technology sweep,
checkpoint substitution, training or repeated historical inference. Only the new
54.567-second controlled sequence required real A/B inference, once per model.

| Track | Exact checkpoint SHA-256 |
| --- | --- |
| A, frozen ADTOF | `c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a` |
| B, released Frame CNN | `785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db` |
| C, corrected OAF, diagnostic only | `4c58ebfc53e7ec92a47a570d3cf7c0838142e7e03b0a64da42d642387ae3fffa` |

A keeps its trained frontend, original context, novelty thresholds
`[.22,.24,.32,.22,.30]`, onset-guided peak/group decisions and 10 ms activation
timeline. B keeps its global dB reference, centered features and strict `>.5`
0-to-1 onset extraction. Both original and private short renderer source hashes
are frozen. No accepted default or production scheduler/controller/permission
changes. The existing active user preparation completed before server restart.

## Exact cases and reference limits

| Case | Original source SHA-256 | Interval and status |
| --- | --- | --- |
| N1, Rằng Em Mãi Ở Bên | `edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a` | [26,44), USER_REPORTED_HAT_NEGATIVE |
| P1, Nujabes — Luv(sic) feat. Shing02 | `349b0b80a4e8f7f206d3fed48ccb6bc938b179a171bbff9ecaf9ec6171145f9f` | Whole recording 280.241633 s; specific independently reviewed rapid-Hat subset pending |
| S1, user-selected Chinese recording | `2693f11c0f6f605a25574e3a73032ef709ae6d64c0d8b7461fcff1a397c2e7bd` | [200,220), provisional repeated-loss report; recording lasts 292.130249 s |
| S1 controlled sequence | `e9c793a6a06e8e9421d27e163fda318259ed17aae99ec89998628235e24a002c` | Generated 54.566893 s, complete by construction |

Original bytes and canonical WAV hashes were verified. No identity is inferred
from the filename. The user clarified that the pattern text was illustrative,
not a transcription, and located the natural problem around 200–220 seconds in
the Chinese file. HSKT is a different recording and is not substituted for S1.
The user described CNN as better over Nujabes generally; no precise rapid
passage/onset set was invented. Natural notes produce no P/R/F1 and unmatched
predictions are not declared verified false positives.

## N1: exact proposals and acoustic ledger

Strictly inside [26,44): B has **21 Hat events**; A has **8 Hat and 2 Cymbal**
events. These map to 21 and 10 shared-upper-row proposals respectively. There
are 54 B frames above .5, which are not 54 onset events. Overlapping screenshots
and events at or after 44 seconds are not added to these totals.

The [31-row ledger](../../scratch/hat-recovery/negative-ledger.json) records each
model event, checkpoint, exact timestamp, raw score, nine neighboring frames,
other-class scores, decision margin, original batch/step position, local RMS,
centroid, spectral flatness, band-energy fractions and spectral flux. For A, the
decision margin is novelty minus its configured threshold, not raw activation
minus threshold. B scores include strong proposals as well as near-threshold
crossings; a confidence increase does not simply remove all the suspect sounds.

RMS/band/flux associations are exploratory statistics on model-selected events,
not instrument labels. Closed/open Hat, other cymbals, shaker/tambourine,
sibilance, synth transients, processing leakage and unknown percussion remain
explicit unresolved acoustic hypotheses. Spectral energy does not independently
establish their identity. Every natural event remains
USER_REPORTED_ABSENT_NOT_INDEPENDENTLY_VERIFIED, with no human-confirmed false
total. **NEGATIVE HAT CASE: AMBIGUOUS / NOT VERIFIED.**

All N1 saved events reached the lab renderer in both envelopes; upper-percussion
delivery is joined by exact event ID. Shared-row proposal totals do not prove
production controller acceptance: that stage is unavailable for this offline
comparison. No count is silently promoted into a live synchronization claim.

## Frontend and repeated-pattern diagnosis

The unchanged official CNN endpoint executes the entire waveform's 22,050 Hz
mono load, 1,024-point centered STFT, 96 mel bins, whole-recording maximum dB
reference, width-9 deltas, ±3-frame contexts and edge-only zero context padding.
4096 is a batch of independently formed context windows, not independently
normalized audio chunks. Exact replay of its 16,031×3 saved logits through the
official adapter reproduces the complete frozen sigmoid matrix (maximum
difference 0) and every saved onset. The sibling NPZ is separately hash-bound.
See [frontend parity](../../scratch/hat-recovery/frontend-parity.json) and
[logit provenance](../../scratch/hat-recovery/logit-provenance.json).

Using a local maximum on the same N1 mel frames would change features by about
8.869 dB. That feature-only counterfactual is
`frontend-local-reference-feature-diagnostic-v1`, performs
no inference and is not applied. Whole-song versus excerpt context can differ
under the released contract; there is no measured full-song implementation
discrepancy to repair. Global reference and centered features remain live
streaming feasibility blockers.

The new control has six identical CNN-frame-aligned cycles, six weak-Hat/Snare
overlap cycles and six cycles crossing batch frame 4096. Every cycle is scored
individually against complete generated attacks. Matching occurs globally before
cycle assignment, so a slightly early prediction is not falsely counted as the
previous cycle's extra event and the next cycle's miss.

B recovers **54/54 Kick and 90/90 Hat** attacks, including every later cycle and
the batch boundary. Identical-cycle logit differences are at most approximately
0.000142; there is no lost Hat or batch reset in this test. A recovers **47/54
Kick and 87/90 Hat**. Its three weak-Hat misses in overlap cycles 2–4 have raw
response but peak novelty about .2097/.2088/.2161 below .22, before any renderer.
Seven Kick misses likewise first fail the existing novelty threshold. This is
observed threshold suppression, not proof that raising/lowering that threshold
is safe, or that all natural misses share the cause. A's 10 ms lattice is not
phase-aligned to every CNN-aligned cycle.

The natural Chinese window shows fewer accepted Hats in some later time bins,
with corresponding raw-score changes. Its five 4-second bins are explicitly not
musical cycles. Without independently marked attacks/cycle boundaries, changes
in the music, learned responses and threshold/rising-edge behavior cannot be
separated causally. **REPEATED PATTERN LOSS: INCONCLUSIVE for natural S1**;
controlled A losses first occur in postprocessing, and visual fusion is measured
separately. [Cycle evidence](../../scratch/hat-recovery/sequence-results.json).

## Bounded experiments and independent protection

Every threshold setting below is reported. Metrics are Hat micro-aggregates on
the previously frozen eighteen-track MDB full-mix holdout (311.873 s), using the
existing one-to-one 50 ms/quarter-gap matcher. This is retrospective independent
reference evidence, not a newly untouched confirmatory set. Development,
drum-only, controls and per-input metrics remain separate in the
[complete sweep](../../scratch/hat-recovery/threshold-sweep.json).

| B Hat threshold | N1 proposals | MDB P / R / F1 (%) |
| --- | ---: | ---: |
| .30 | 31 | 58.6 / 89.7 / 70.9 |
| .40 | 24 | 63.2 / 84.4 / 72.3 |
| .50, frozen | 21 | 67.0 / 76.7 / 71.5 |
| .60 | 16 | 70.5 / 70.4 / 70.4 |
| .70 | 15 | 75.3 / 64.2 / 69.3 |
| .80 | 12 | 78.5 / 56.0 / 65.4 |
| .90 | 6 | 86.6 / 45.0 / 59.2 |

Threshold variants select original raw crossing frames; their onset changes are
the documented extraction consequence, not fitted shifts. Rising-edge event
counts need not be monotone: increasing a threshold can split an active run.
No threshold is selected. The 90 generated repeated Hats survive these settings,
but weak/rapid controls and independent natural recall do not. Nujabes counts
fall from 871 at .5 to 505 at .9; these counts do not establish which attacks
were correct or lost. Its independently reviewed positive recall stays unavailable.

A repeatable class-confusion mechanism exists in complete generated Snare-only
controls: B emits 24 false Hats despite no Hat in the construction, and several
have dominant Snare scores. One predeclared lightweight rule rejects an existing
B Hat when its same-frame Snare probability is at least Hat+.10. It introduces
no new onset, time shift, spacing, A agreement or learned calibration.

The veto reduces Snare-only false Hats **24→10**, but N1 only **21→20**. MDB
precision rises 67.0→69.5% while recall falls **76.7→68.1%** and F1 falls
**71.5→68.8%** (58 additional true-Hat misses). Dense Hats under loud drums
fall **23→21 of 36** true matches. Nujabes loses 45 proposals whose correctness
is unverified. This rule is rejected. Snare confusion on a generated control is
not a demonstrated explanation for all N1 events, and multi-label classes cannot
be assumed mutually exclusive. No unsupported spectral veto or verifier is added.
See [mitigation results](../../scratch/hat-recovery/mitigation-results.json).

MONO, XO and Whiplash saved excerpts are included as unscored regression
diagnostics. At .5/.9, CNN Hat counts are MONO 0/0, XO 44/13, W1 28/7,
W2 33/12 and W3 31/0; changing counts is not an accuracy improvement. Existing
isolated, simultaneous, weak/strong and dense controls remain individually
reported. Frozen A Kick/Snare and original holdout metrics are unchanged.
**CNN HAT RECOVERY: TRADEOFF UNACCEPTABLE for the tested corrections.**

Threshold IDs are `cnn-hat-threshold-diagnostic-v1-30` through `-90` in steps of
10. The score-veto ID is `cnn-hat-snare-dominance-v1`; H0 is
`H0-frozen-routing-diagnostic-v1`. Rollback is simply selecting frozen **A** or
**B** in Event track (and Original renderer if desired). No weight, baseline
cache, postprocessor default or production configuration was changed.

For unchanged A Kick/Snare on the same eighteen-track full-mix holdout, P/R/F1
remain 95.1/91.0/93.0% and 87.3/68.5/76.8%, respectively. Frozen A true-Hat is
90.2/78.5/83.9%; these published-reference aggregates are reused, not inferred
from the user's favorite songs or the new synthetic control.

## Rendering, hybrid and verification

Real native playback used the same frozen event IDs/classes/times in Original
and Short Attack. The following are measured proxies from one isolated browser
run, not subjective attacks or guaranteed physical timing.

| Passage / track | Delivered / frame-observed IDs | Shared-row brightness rises, Original / Short |
| --- | ---: | ---: |
| N1 A, all classes | 18 / 18 each | 6 / 10 |
| N1 B, all classes | 23 / 23 each | 11 / 19 |
| First six controlled cycles, B | 48 / 48 each | 25 / 30 |

There were no late drops in these runs. All N1 upper-row predictions were
delivered and frame-observed; their brightness can still fuse. This separates
display limitations from acoustic missing events without claiming better
recognition. Renderer exports retain the actual run and model IDs.

H0 privately routes frozen A Kick/Snare and frozen B true-Hat, preserving exact
times, original prediction IDs, provenance, chronological ordering and
simultaneous different classes. It excludes A Hat/Cymbal and duplicate identity
records. Class-specific missing A/B coverage remains explicit; nothing fills
EOF/context gaps. H0 is tested routing evidence, not a corrected selected model.
**HYBRID A+B: NOT YET JUSTIFIED.** No tested Hat correction qualifies for the next
private hybrid evaluation; integration remains NO-GO.

Focused core, snapshot/raw/audio guards and native source/race/seek/loop/export
tests pass. App tests: 912 in 116 files; Node contracts: 39; Python core/scoring/
cache tests: 6/5/6. App/private typechecks, build and bundle budget pass (718.8 KiB
main against 976.6 KiB). Lint has zero errors and 27 existing warnings. The
full-song, 24-case excerpt renderer, annotation API and actual generated-source
Companion regressions pass. Original/short inputs match exactly. Independent read-only review
found no remaining material blocker after complete raw-logit provenance was
added. Application, research and Companion regression totals and final retained
server ownership are recorded in the delivery receipt. No private audio, model
checkpoint or human note is committed or redistributed. Failed development
diagnostic logs remain retained separately from final passing receipts.

Regression exposed a Windows metadata-archive collision in the existing status
helper: repeated clock values could overwrite a prior invalid-source record.
Archive names now use UUIDs, with a deterministic repeated-clock regression test.
The helper is outside the numerical cache identity, so successful predictions
remain reused with their original producer hash. A full-song verifier also now
checks source isolation with a populated Local slot instead of assuming that the
user has left it empty. User slots were not cleared or reassigned. Earlier
regression receipts/screenshots are archived and restored after the new checks.

Remaining review: identify a complete independently reviewed Nujabes rapid-Hat
subset; classify ambiguous N1 sound sources; and mark actual natural S1 attacks
and cycle boundaries. These are evidence gaps, not a reason to accept a filter
or fabricate complete reference labels.
