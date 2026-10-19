# Matched-track offline/live quality gap

Status: D1/D2 evidence complete within stated bounds; D3 synthesized. Architecture
approval and a fresh user YouTube listening trial remain open. No implementation
of the proposed next architecture is authorized by this plan.
Branch: `codex/beat-grid-quality-recovery`.
Starting HEAD: `774982a6541c120c0945e1c10f4bd029d8e81bd1`; clean on entry.

## Outcome and boundaries

Explain the user's rejected live L1 experience relative to preferred offline H0
on the same musical recording. Separate model/event differences, structural
delay, numerical streaming divergence, transport/controller loss and visual
fusion. Preserve the frozen models/results, thresholds, H0, Bass/Lead, providers,
source permissions, normal detector, scheduler and renderer. No training, new
streaming CNN, provider download, buffering, offset correction or deployment.
Stop after evidence synthesis and listening review for architecture approval.

The user confirmed the exact recent Lab upload is the Downloads copy of
“Don Toliver - Private Landing (feat. Justin Bieber & Future) [Official Audio].mp3”.
Bind original bytes and canonical decoded PCM rather than title or slot label.
The user selected a start at 20 seconds and reported missing/delayed Hat flashes.
The bounded engineering interval is [20,50); its end was not supplied by the user.
The current unrelated paused YouTube session is not the comparison recording
and is not evidence of which detector ran during the user's previous listening.

## Checkpoints and acceptance

1. Freeze source/PCM/WAV, saved A/B/H identities, model/frontend and timing
   provenance. Independently hash Downloads and the retained original. Reuse
   validated activations and frozen MDB receipts; do not rerun model benchmarks.
2. Replay L0/L1 decisions on saved ADTOF activations; compare against canonical
   H0 routing. Export class/event IDs, source timestamps, spacing, rapid and
   overlapping sequences, exact and tolerant associations, coverage and a
   provisional acoustic-review queue. Detector disagreement is not accuracy.
3. Use the real Companion/worklet/worker/controller/grid with the same authorized
   canonical local audio. Retain diagnostic feature/activation/timing records.
   Compare captured features and inference to offline results only after explicit
   source-clock alignment; locate the first known divergence and retain unknowns.
4. Account for predicted/emitted/transported/accepted/committed/frame-observed
   events. Reuse valid rapid controls and test relevant rapid event sequences
   through the actual Kora controller. No duration change or fake semantic hits.
5. Inspect actual Brave provider state without changing unrelated playback or
   checking human hearing/rights on the user's behalf. Record installed/active
   runtime separately from a dropdown. Supply a short Vietnamese guide, precise
   review passages and a browser checklist; collect provisional feedback.
6. Report hypothesis attribution, failed attempts, missing evidence, GO/NO-GO
   for proposed changes and the smallest justified architecture decision. Human
   accuracy and physical speaker/pixel synchronization cannot pass by software
   traces or subjective preference alone.

Private artifacts: `scratch/matched-track-quality-gap/`.
Report: `plans/reports/engineering-261019-1753-matched-track-quality-gap.md`.

## Process ownership

Initial private Kora PID 38164 on 1420 held a stale catalog; it was stopped and
replaced by owned PID 30668, `node scripts/serve-hybrid-beta.mjs`, this worktree,
port 1420. Retain it for the user's listening handoff. Existing Lab PID 27544 owns 5173/5174;
it was not started by this investigation and must not be stopped. No listener
on 1431 on entry. Isolated benchmark browser contexts close in finally blocks.
Record any diagnostic-only extension copy and exact instrumentation delta.
Do not edit watched source or run builds/tests during timing measurement.

## Delivery state

- [x] P1 source, canonical PCM, A/B/raw hashes and H0 identity frozen and rechecked.
- [x] P2 exact saved L0/L1/H0 proposals compared without another neural benchmark.
  Separate true-instrument and Hat/Cymbal display-row associations; provisional
  review queue corrected and original preserved.
- [x] P3 real Companion controlled local audio, exact captured-input frontend and
  CPU/WASM parity, source association and distinct clean-package timing controls.
  Captured PCM is unequal to canonical PCM; parity is conditional, not a claim
  that the provider recording is sample-identical.
- [x] P4 per-ID stages, stale-input/deadline failure, clean L1 delivery, actual
  product H0 replay and positive viewport observations. Missing natural spacing
  bins, physical visibility and perceptual separation stay unknown.
- [x] P5 Brave inspected; source-bound subjective feedback saved. Existing Lab
  prepared paused at 20.000 seconds; [Vietnamese guide](listening-guide-vi.md)
  delivered. Exact provider runtime/PCM and new live listening remain unverified.
- [x] D3 [report](../reports/engineering-261019-1753-matched-track-quality-gap.md)
  recommends no promotion and presents the bounded next architecture decision.
- [ ] Architecture approval for any causal Hat/deadline implementation.
- [ ] Independently verified reference subset, official accuracy gate and
  physical speaker/pixel synchronization qualification.

Final diagnostic validation/review receipts and reproduction commands are kept
under the private artifact directory. Product/provider/model code is unchanged.
