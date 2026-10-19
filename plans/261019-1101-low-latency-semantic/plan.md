# Low-latency semantic detection recovery

Status: D1/D2 and controlled D3 engineering complete; private listening handoff
delivered. D4 decision is GO for private comparison only, with human listening,
real-provider L1 capture, resource qualification and physical acceptance open.
Branch: `codex/beat-grid-quality-recovery`.
Starting HEAD: `ddc4d2be015a6e18412a7cc9befcdb43a2862654`; clean on entry.

## Accepted outcome and constraints

Determine whether live semantic percussion can arrive materially earlier while
preserving useful recognition. Keep frozen L0, offline H0, independent Bass,
Lead, all seven provider contracts, ownership, consent and private restrictions.
No timestamp offsets, delayed provider audio, broad model search or deployment.
Reuse valid model/activation/reference evidence; format changes are not novelty.
Conversation stays English; the requested listening artifact will be Vietnamese.

## Delivery checkpoints

1. D1: Freeze identities and environment; repeat three foreground live trials,
   one complete 180-second source, CPU stress and a known-onset rapid fixture.
   Audit frontend/window/output/grouping and playback-clock mapping. Derive
   per-event release bounds with explicit assumptions and measurement limits.
2. Architecture review: the supplied brief explicitly says “Stop for architecture
   review if the required improvement demands changing model semantics.” Finish
   concrete D1 evidence before asking; do not run/adopt changed decisions first.
3. D2 after that review: bounded L1 activation replay against frozen L0 and
   separate MDB development/holdout, regression passages and negative controls.
   Review historical causal student/reduced-context evidence before admitting L2.
4. D3 only for a recognition-qualified candidate: existing private Companion
   selectable integration, rollback, runtime/lifecycle/permitted-provider checks.
5. D4: recognition/timing/resource tradeoff, Vietnamese listening guide, GO/NO-GO,
   exact commits and remaining physical measurement/rights requirements.

## Approved L1 comparison

The user approved the bounded L1 offline comparison on 2026-10-19. Compare
frozen L0 with exactly two offline variants: group closure after zero intervening
candidate frames (`gap0`, isolated score p+3), and immediate closure (`immediate`,
isolated score p+2). Change only the final group-closure condition in a pinned
in-memory copy of the classifier. Do not edit production classifier/weights,
features, thresholds, cadence, model context, scheduler or H0. These are new
postprocessing semantics, not new models. Do not add further variants.

Reuse validated BASE activations and the original frozen corpus/split. Select
once on development, write the selection and evaluator hashes, then evaluate
only that selected variant against L0 on locked holdout and remaining controls.
If neither variant qualifies on development, freeze the more conservative gap0
as a rejected diagnostic before opening holdout. No holdout-driven adjustments.

Predeclared screening limits: each natural Kick/Snare/true-Hat F1 may fall at
most 2 percentage points and precision/recall at most 3 points in either domain;
dense and overlap recall may fall at most 2 points. Complete synthetic controls
must not lose matched attacks or add false events in absent rows. No duplicate
class/time identities. Paired retained-event input-release savings p95 must be
at least 10 ms to justify further runtime work. These are conservative local
engineering screens, not a user-certified universal quality target. If a screen
fails, reject integration. Runtime/physical/resource qualification remains a
separate gate even if these offline screens pass.

Provisional song regression results report changed proposals and uncertainty,
never official metrics. Preserve all old result/activation/reference files.

Development selected gap0 on an equal-score conservative tie; selection and
evaluator hashes were frozen before confirmation. Natural holdout has three
added proposals and no removals: one additional unmatched true Hat within the
scoring interval, and two additions outside the scoring interval. Per-segment
controls and five source-bound song regressions passed the relative screen.
The runtime adapter exactly matches 222,875 saved decision frames on 70 streams.
`offline-qualification.json` explicitly keeps promotionEligible false; the
frozen comparison's legacy eligibleForRuntime field means evaluation only.

D3 reuses the existing worker/capture/event path with a private-only selector
and L0 rollback. The original classifier/weights/features/thresholds are byte
unchanged. Restart only the drum worker at a new synchronization boundary;
retain the audible graph and independent Bass. Preserve baseline public and
historical XO/Hat package module graphs and keep the L1 option out of them.
Complete actual paired timing, EOF/stress, lifecycle, negative controls and
resource measurements before any private adoption claim. Physical sync and
universal acoustic accuracy remain unverified.

## D1 acceptance and evidence

Preserve source/model/frontend/classifier hashes, raw per-event timings, IDs,
renderer records and resource scope. Reproduction uses the existing actual
Companion harness and deterministic CC0 source. Synthetic sample onsets establish
controlled timing only. Provisional song references remain provisional and are
not official acoustic labels. Software callbacks cannot qualify physical sync.

Private evidence: `scratch/low-latency-semantic/`.
Report: [D1](../reports/engineering-261019-1101-low-latency-semantic.md).
Follow-up: [L1 comparison and private handoff](../reports/engineering-261019-1717-early-percussion-decisions.md).
Listening: [Vietnamese L0/L1 guide](listening-guide-l1-vi.md).
Reuse prior [provider delivery](../reports/engineering-261019-0549-provider-live-upgrade.md),
the frozen MDB split and saved prior candidate results without duplicate neural
benchmarks. D2–D4 must not be marked complete by a D1-only delivery.

## Process ownership

D1 evidence and limitations are recorded in the report. Three foreground runs,
the source-to-180-second-EOF run (~177.2 seconds of admitted live preview),
two-thread stress and six rapid controls finished.
At D1 no lower-latency candidate was implemented or qualified. Frozen H0 preparation
was restored through a reviewed, pinned compatibility attestation; actual Web
four-row playback and source lifecycle checks passed without neural reruns.

Private server retained: PID 38164, port 1420. Measurement contexts, stress
workers and isolated runtime port 1431 are closed. See the report for the
single failed selector trial and the failed duplicate start caused by sandbox
process visibility; the existing server was reused.

L1 controlled comparisons, both source-to-EOF repeats, stress, rapid controls
and source lifecycle checks are complete. The follow-up report retains failed
attempts, worse tails, two background clock drops per paired run and one
coalesced negative Hat renderer trace. The actual browser tab-change test stayed
visible and does not qualify hidden/minimized behavior. Full tests/type/lint/build,
six isolated package branches and actual H0 Web preservation passed. L0 remains
default; promotion/physical/resource qualification is false. Brave currently
needs the private 0.3.25 extension reload for its new detector selector.

At entry no listener was found on 1420/47635/5173/5174; the prior recorded 22144
server is gone. Restart exactly one private server on 1420 and record its
PID/command/worktree. Close isolated benchmark contexts and stress workers in
cleanup. Do not stop user browsers/apps. Keep heavy tests/builds out of timing
measurement windows. Retain the listening server only if useful for handoff.
