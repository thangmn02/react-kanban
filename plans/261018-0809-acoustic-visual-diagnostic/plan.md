# Private acoustic and visual diagnostic

Status: implementation and automated verification complete; ready for user
listening review. Decision D for XO causal attribution. Base
`36e723b8d2c4181fcc173c7dc2fe1d4b9408b77c`, branch
`codex/beat-grid-quality-recovery`. Timebox: two working days of implementation and
automated verification, then user listening review. The completed model-selection
NO-GO remains in force.

## Outcome and boundaries

Deliver a private lab where the user hears one exact authorized recording, switches
saved ADTOF / frame-CNN / corrected separated-OAF predictions without restarting
audio, marks attacks blind on a zoomable waveform, and inspects per-event evidence
through the actual renderer. Keep acoustic errors, live delivery errors and visual
fusion distinct. Unknown or incomplete evidence never becomes accuracy or a causal
percentage. No production deployment, detector/threshold change, model search,
training, benchmark rerun, permission expansion or provider bypass.

## Acceptance

1. Verify the old sprint with its verify-only command; bind immutable artifacts and
   original revision. Reuse raw predictions without neural repetition.
2. Offer XO 45–57 s first, Whiplash W1/W2/W3, MONO and existing Snare/Hat controls.
   Show source and canonical PCM hashes, measured padding/source-time mapping and
   one owned audio clock. No candidate-specific time shifts.
3. Blind annotation comes before prediction disclosure. Record source/version,
   reviewer origin, instrument, timestamp uncertainty, audibility, overlap and
   ambiguity. Save/import/export locally. Score only explicitly frozen, complete,
   sufficiently timed reviewed subsets, with strict one-to-one matching.
4. Preserve individual prediction IDs and raw classes, including OAF's coarse
   HH/Tambourine/Maracas group and distinct Cymbal output. Show timestamp markers,
   existing semantic grid, stage traces and a navigable per-hit comparison.
5. Live baseline mode remains the existing Companion route, with bounded diagnostics
   and stable existing trace IDs. Record absent stages as unavailable, never infer
   transport loss from missing log records.
6. Measure 20/30/50/80/125/200 ms renderer repeats, separately counting known hits,
   detector outputs, controller acceptance and frame-level attack proxies. Human
   perceptibility and physical speaker/display timing remain unmeasured. Prototype
   at most one private retrigger alternative only after fusion is demonstrated;
   preserve the original renderer and reduced-motion behavior.
7. Focused tests, app regression, private build/type checks, normal packaging guard,
   browser UI review, final read-only review, commit and source/evidence receipt.
   Finish with an actionable blind XO listening task and supported causal counts;
   decision D if human or live evidence remains incomplete.

## Execution surfaces

Private scripts and entrypoints under `scripts/`; derived private audio, data and
receipts under ignored `scratch/acoustic-visual-lab/`. Use ports 5173/5174, checking
owners before startup. Preserve the normal production runtime and package inventory.
The existing Private Grid links to the lab; the lab links to live trace mode.
Final report: `plans/reports/engineering-261018-0809-acoustic-visual-diagnostic.md`.

## Progress

- Previous verify-only command passed: 357 result records, 606 eligible views,
  54 unscored listening records, 15 Python tests. No neural inference.
- Previous listening server was absent. One owned diagnostic server now serves
  ports 5173/5174; its PID/command/worktree are tracked in the private process receipt.
- Existing telemetry already spans worker/detector, transport, engine, scheduler,
  controller and renderer, with bounded buffers. Existing renderer experiments
  provide reusable evidence; their acoustic and physical limitations must remain.
- Delivered eleven exact clips, one owned audio clock, A/B/C saved tracks,
  blind annotation with persistent exposure/coverage guards, strict reviewed
  subset matching, per-hit/raw/frame evidence and separate live baseline trace.
- Final focused checks, 24 renderer cases, seven API checks, actual generated
  Companion capture, 912 app tests, 33 research tests, typechecks, lint, production
  build and bundle budget passed. Independent read-only review has no remaining
  material blocker. Original renderer remains default; one private prototype is
  unqualified. No production detector/runtime changes or neural benchmark rerun.
- Human acceptance remains pending: complete blind XO review and accurate onset
  timing, audible/prediction/flash alignment and captured natural live trace.
  No official XO metrics or causal percentages. See the
  [final report](../reports/engineering-261018-0809-acoustic-visual-diagnostic.md)
  and [operator guide](../../docs/private-acoustic-visual-lab.md).
