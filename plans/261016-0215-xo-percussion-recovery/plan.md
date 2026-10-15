# XO Tour Llif3 Snare and Hi-Hat recovery

Status: bounded investigation delivered as NO-GO for adopting B. All 17 frozen acoustic/natural fixtures and six actual Companion A/B runs completed. The single correction improves some 50 ms constructed attacks but increases Snare-only false Hats (18→19); natural Snare improvement and independently audible Hat separation remain unverified. Passing software tests do not resolve the reported product failure. See [the focused report](../reports/engineering-261016-0215-xo-percussion-recovery.md).

Locked experiment after baseline: B changes only the Snare/Hat novelty baseline to retain local three-frame valley prominence alongside existing rolling-mean novelty. Numeric thresholds, model weights, Kick and class mappings stay fixed. Evidence: repeated acoustic Hat/Snare signals produce strong learned activation whose rolling novelty falls below threshold; no within-class grouping was observed in the selected XO baseline. Baseline Snare-only audio already emits false Hats, so any increase in that cost fails the candidate. No second corrective variant or threshold search will follow this experiment.

## Outcome and acceptance

Use the exact user Downloads recording, SHA-256 `98f15c28fc0a4641c358a9f2e728cb66f83ce74e4ebb21828a7961dfcb46ea05`, initially source seconds 45–57. Distinguish model nonresponse, peak/class suppression, transport/controller loss and indistinguishable rendering. Make at most one evidence-backed correction. Deliver a reproducible private A/B listening candidate on the same authorized audio-only source/output path, or a bounded documented NO-GO with a specific detector limitation.

Acceptance requires evidence of improved genuine Snare/Hat separation without material false-positive, Kick or timing regression, plus an actual typed-preview listening route. Natural accuracy remains BLOCKED without separately verified complete references. Human listening determines subjective improvement, not official precision/recall.

## Constraints

- Preserve the five model classes, public percussion rows, rapid merger and floating-point boundary fixes, source epochs, existing debounce, pause/seek/switch behavior, Chrome/Edge communication, audio-only buffering and video/Spotify restrictions.
- Preserve prior private implementation in a baseline commit before detector changes. Do not redesign UI, scheduler or architecture absent causal evidence.
- No unrestricted model search, fabricated tempo events, blanket threshold lowering, copyrighted audio commits/uploads, public publication or deployment.
- User annotations remain provisional-human-reference. No unmatched-prediction false-positive assertions or official natural metrics from incomplete labels.

## Steps

1. Verify source and existing excerpt/activation/trace identities. Freeze baseline A. Inspect 45–57 s with activation/class/peak/group/emission and actual Companion-to-visible-flash traces. Characterize the 9.880/9.890 s Hat pair without assuming two real attacks.
2. Generate deterministic acoustic drum fixtures with complete onset construction: Hat-only, Snare-only, alternating, simultaneous Kick/Snare/Hat, weak/strong Hats, silence and non-percussion. Cover 20/30/50/80/125/200 ms intervals with one-to-one matching tolerances below half the closest spacing. Process through production PCM features and ONNX model, not only activation impulses.
3. Compare rejection causes across XO, MONO, Whiplash, EDM, rock/pop and drum-free controls. Select one correction only if causal evidence supports it; retain an explicit no-change B if a viable correction cannot be established rather than tuning indefinitely.
4. Re-run identical acoustic/natural inputs through A/B. Record row counts, controlled matching, duplicate/false-Hat cost, timing and runtime. Natural coverage/identity/timing uncertainty remains explicit.
5. Package private A/B builds with identical rows and trace mechanisms, marked UNVERIFIED DETECTOR PREVIEW. Verify real loaded Companion delivery and actual visible flashes on the buffered local-audio path; distinguish software DOM timestamps from physical display/speaker timing.
6. Read-only review, focused and complete final regression suites, type/lint/build/package gates, focused conventional commit and one evidence report with exact source/artifact hashes, run instructions, PASS/FAIL/BLOCKED and listening questions.

## Evidence, risks and rollback

Raw audio, model activations and browser profiles stay under ignored `scratch/xo-percussion-recovery/`. Durable report: `plans/reports/engineering-261016-0215-xo-percussion-recovery.md`. Reuse the existing user review server if available; otherwise use deterministic ports after checking ownership. Track and stop owned test processes, preserving a user-needed listening server.

Model overlap can make acoustic event identity ambiguous; signal construction alone does not guarantee the model recognizes a drum. Actual browser tests can separate emission/delivery/rendering, but cannot certify listening or physical synchronization. Revert only the experimental correction or switch to packaged A to roll back; preserve the prior candidate and reference integrity guards.
