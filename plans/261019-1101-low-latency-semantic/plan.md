# Low-latency semantic detection recovery

Status: D1 complete; awaiting the explicitly required architecture review before D2.
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

## D1 acceptance and evidence

Preserve source/model/frontend/classifier hashes, raw per-event timings, IDs,
renderer records and resource scope. Reproduction uses the existing actual
Companion harness and deterministic CC0 source. Synthetic sample onsets establish
controlled timing only. Provisional song references remain provisional and are
not official acoustic labels. Software callbacks cannot qualify physical sync.

Private evidence: `scratch/low-latency-semantic/`.
Report: [D1](../reports/engineering-261019-1101-low-latency-semantic.md).
Reuse prior [provider delivery](../reports/engineering-261019-0549-provider-live-upgrade.md),
the frozen MDB split and saved prior candidate results without duplicate neural
benchmarks. D2–D4 must not be marked complete by a D1-only delivery.

## Process ownership

D1 evidence and limitations are recorded in the report. Three foreground runs,
the source-to-180-second-EOF run (~177.2 seconds of admitted live preview),
two-thread stress and six rapid controls finished.
No lower-latency candidate was implemented or qualified. Frozen H0 preparation
was restored through a reviewed, pinned compatibility attestation; actual Web
four-row playback and source lifecycle checks passed without neural reruns.

Private server retained: PID 38164, port 1420. Measurement contexts, stress
workers and isolated runtime port 1431 are closed. See the report for the
single failed selector trial and the failed duplicate start caused by sandbox
process visibility; the existing server was reused.

At entry no listener was found on 1420/47635/5173/5174; the prior recorded 22144
server is gone. Restart exactly one private server on 1420 and record its
PID/command/worktree. Close isolated benchmark contexts and stress workers in
cleanup. Do not stop user browsers/apps. Keep heavy tests/builds out of timing
measurement windows. Retain the listening server only if useful for handoff.
