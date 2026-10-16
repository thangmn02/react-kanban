# Beat Grid V2: one coordinated technology evaluation

Status: coordinated evaluation complete; architecture decision **NO-GO** for
replacement. All 357 results across 65 frozen inputs validated, including the
corrected OAF output contract and 32 separated full mixes. No runnable replacement
passes the independent natural Snare/Hat gates; no new detector is integrated.
Provisional human references remain unscored. Final review passed; the delivery
revision and check hashes are recorded in the private `final-revision.json` receipt.
The requested baseline listening server stays on ports 5173/5174.

Completed: novelty/reuse inventory, acquisition and blockers, inference, raw/PCM/
reference guards, dependency fingerprint migration without neural repeats, strict
scoring, 208-case provisional ledger, matched runtime comparison, one architecture
decision, 912 app tests, 22 Node tests, 15 Python tests, lint, typecheck, build and
bundle guard. Original C4 batch-eight identities and actual parity-probe execution
fingerprint remain preserved. See the [final report](../reports/engineering-261016-1459-beat-grid-v2-sprint.md).
Frozen base: `c93046ad262db21577792eed0ee61c3452525328` on
`codex/beat-grid-quality-recovery`. Timebox: five working days, finishing sooner
where feasible. No deployment, new training, broad threshold search or repeated
candidate approval loops. Preserve the current ADTOF baseline and all ownership,
clock, source-generation, cache, rights, fallback and provider protections.

## Required outcome

Evaluate every technically eligible requested lane in one coordinated round,
then decide GO STREAMING, GO OFFLINE ONLY, RESEARCH CHAMPION NO RELEASE or NO-GO.
Only integrate a qualified leader for its appropriate mode. A release winner
requires independently supported natural accuracy, rights, operational readiness
and the separate timing gates. More events and synthetic-only results cannot win.

## Novelty and reuse gate: user requirement

Technology novelty is evaluated at the model and detection-architecture level,
never by inference format. Before benchmarking, compare checkpoint/weight identity,
architecture, training provenance, preprocessing, class mapping and full pipeline
against Kora's previous experiments. A TensorFlow/PyTorch/ONNX conversion, execution
provider switch or repackaging is not a new semantic detector. Hash inequality alone
does not establish new weights. Unknown equivalence must remain unknown.

Freeze a historical fingerprint/evidence inventory. Reuse valid existing runs when
audio, preprocessing, weights, postprocessing and relevant runtime conditions match.
Skip exact duplicate experiments. Distinguish a new pipeline around the same model
from an independent detector; measure only genuinely new stages or changed contracts.
Record invalidated evidence and the reason before repeating it.

## Execution and acceptance

1. Inventory local model/config/weights hashes and prior evidence; resolve current
   official sources for BASE and C1–C7. Pin code/checkpoint revisions, sizes, licenses,
   input domain/classes, context and dependencies. Bound environment setup and record
   actual minimal inference success/failure. Isolate third-party code and safe loads.
2. Freeze one source-hashed controlled/natural-reference/listening corpus with a
   development/locked holdout split. Reuse existing authorized recordings. Acquire
   legitimate independent references where accessible; provisional user marks are
   never official truth. Compare direct-mix, drum-stem and multistage lanes separately.
3. Run every runnable, nonduplicate pipeline against this corpus in the same round.
   Preserve raw classes/results, one-to-one strict onset scores where eligible,
   false-Hat controls and Snare/Hat/Kick tradeoffs. No test-specific tuning.
4. Measure actual hardware load/memory/cost/context and complete-pipeline RTF. Claim
   LIVE-CAPABLE only from the actual sustainable browser route, not offline RTF.
   Necessary future context aims at ≤30 ms; physical ≤50 ms p95 remains independent.
5. Select a supported architecture once. Integrate only a qualified leader privately,
   with exact-source versioned model-predicted EventTracks for offline mode if apt.
   Otherwise retain fallback and deliver the bounded negative decision.
6. Review, focused/full regressions, exact revision receipts and one concise report:
   `plans/reports/engineering-261016-1459-beat-grid-v2-sprint.md`. Preserve acquisition
   matrices, manifests, environment scripts, raw/normalized results and case ledgers
   privately. Stop owned test processes; retain only explicitly needed review service.

## Lanes and exclusions

BASE unchanged ADTOF; C1 published frame-level CNN; C2 OAF Drums; C3 full separator
→ DrumSep → class onsets; C4 ADT_STR released tau-0.8 configuration; C5 released
Separate-and-Detect plus VAE/vocoder; C6 complete drum2midi ADTOF-dependent pipeline;
C7 YODO only with accessible supported weights/inference. No unrelated VAD, beat
tracker, DJ engine, unshipped model or retraining lane is admitted.

## Initial verified state

Baseline ONNX SHA-256 is
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
Prior ADTOF candidate B remains rejected. Previous R was visualization-only and is
not a new detector. Existing natural listening annotations remain provisional.
Local CPU is Ryzen 7 8845H (8 cores/16 logical); Radeon 780M is reported, with no
NVIDIA device established. Resource and dependency gates are still being inspected.

Execution details: [acquisition checkpoint](acquisition.md). It records pinned
sources, actual setup failures, reusable evidence and remaining benchmark work.
