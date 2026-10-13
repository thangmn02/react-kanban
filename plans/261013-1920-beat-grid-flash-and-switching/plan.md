# Beat Grid flash accuracy, timing, and switching

Status: implemented, reviewed, published and verified for user testing; live acceptance pending.
Date: 2026-10-13, Asia/Saigon. Baseline: `main` at `2ae6703`, rollback `6d46be3`.

## Outcome and boundaries

Correct and timely Kick, Snare/Clap, Hi-Hat/Cymbal, and Bass/Low pulse flashes
come first. Then eliminate persistent lag within songs and across track,
platform, source, browser-window, and Kora-view transitions. The user reports
that changing songs can clear existing lag; that recovery is part of the baseline.

Keep the normal grid 4×8, Bass holds, accepted shapes/effects, Focus Dock/PiP,
shared Web/Desktop behavior, and one capture owner. Preserve the current model
while establishing the cause. No model-training project, new cloud processing,
fifth product row, speculative DSP drum fallback, unrelated redesign, or release
was included in the original planning delivery. Existing cache/local paths remain distinct.
The user subsequently authorized implementation and publication for their own
installed-browser listening test on 2026-10-13. That authorization replaces the
original release-request gate; live listening acceptance remains explicitly pending.

## Execution order

| Phase | Status | Dependency | Exit criteria |
| --- | --- | --- | --- |
| [1: Wrong and slow flashes](phase-01-flash-correctness-and-timing.md) | Implemented; listening/accuracy acceptance pending | Artifact/runtime baseline | Confirmed delivery defects repaired; bounded same-song recovery and semantic flashes tested; real production PCM/model timing measured. Independent per-row accuracy remains a listening/scoring gate. |
| [2: Persistent and switching lag](phase-02-persistent-and-switching-lag.md) | Implemented; endurance and draft release checks passed | Phase 1 repairs | Thirty handoffs and stale-owner cleanup tested; 30-minute real PCM inference/render run passed. Actual affected-browser/platform listening and weak-device coverage remain pending. |

Phase 1 includes worker recovery because a dead/stalled detector directly affects
flashes. Phase 2 addresses handoff performance and broader browser/UI behavior.
Do not declare Phase 1 passed solely because all four rows flash.

Acceptance requires comparable before/after evidence from the actual affected
browser and Desktop where applicable, plus focused regressions. Numerical targets
in the phase files are proposed engineering gates, not current measurements or
previous user decisions. Freeze the measurement conditions before comparing.

Evidence and limitations: [investigation report](../reports/diagnosis-261013-1920-beat-grid-flash-and-switching.md).
Delivery evidence: [release validation](../reports/validation-261013-1920-beat-grid-release.md).
Release readiness requires separately verified packaged runtime, public artifact
parity and clear reporting of installed-app listening limits. Publication for the
user's own test is authorized; it must not be described as completed listening acceptance.
