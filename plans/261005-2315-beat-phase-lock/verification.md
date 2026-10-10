# Verification — 2026-10-05

Eight focused regressions failed before implementation: six phase-feedback cases
and two missing Melody-flash cases. After implementation, focused extension,
shared grid, lease and native event checks passed. Added a short-breakdown
four-kick recovery check, then reran the full suite: 71 files / 523 tests passed.
TypeScript and scoped lint passed. The final native build and production web
build passed, with main JS 605.3 KiB against a 976.6 KiB budget.

Ten-minute synthetic full-estimator comparison, using timestamp jitter and an
initial 0.5% tempo bias:

| BPM | No feedback max error | Feedback max error | Corrections | Mean correction |
| --- | --- | --- | --- | --- |
| 90 | 34.56 ms | 10.78 ms | 610 | 0.30 ms |
| 128 | 116.30 ms | 11.37 ms | 1,280 | 2.08 ms |
| 150 | 34.56 ms | 10.42 ms | 984 | 0.20 ms |

Errors are relative to detected synthetic kick timestamps, excluding capture
and transport latency. No monotonic tick regression. Four kicks reduced accepted
positive/negative 70 ms offsets below 11 ms. The gate intentionally ignores
greater than 0.35 eighth-note errors and does not identify all syncopation.

Controller review covered the entire touched implementation/tests/version/docs
diff against base/web checklists. A flash-expiry cancellation issue found during
implementation was fixed with an independent expiry effect and transition
coverage. No unresolved introduced code issue found. Existing low-confidence
relock behavior remains a specification boundary of the requested two-line PLL.

Rendering proof uses actual BeatPattern/CSS in an isolated Playwright browser:
opacity 0.72 and scale 1.12 at peak; reduced motion has no animation/transform;
raw hats retrigger; silence clears; zero page errors. Screenshot:
[synthetic rendering](../../scratch/beat-grid-flash-proof.png). This is not live
music evidence. Removed all temporary fixture code and stopped the owned Vite
server PID 6092 on 1420; the port is no longer listening.

Kora 0.1.10 installer SHA-256:
`88020900c2ed6948eeaeb9fba898aa012b8d7ccb0539e4ec0412f3fc993fc769`.
Signature verified with the existing public key; altered bytes rejected.
No private configuration value occurs in built JS or release source. Runtime
companion is 0.3.10; no permissions added.

Still unverified: five-minute real EDM/pop/lo-fi and ten-minute playlist visual
acceptance. Actual silence still stops capture after 2.5 seconds and confidence
loss unlocks after four seconds; no claim of jump-free long-breakdown recovery
or correction of arbitrary bad initial phase. Those claims are not established
by the proposed bounded kick correction.

Published after explicit user approval: commit
`396fbcd822d347ed9312661e37f3b40dd6a64cb1`, Netlify deploy
`6ac3ca629a8a3d0008c0342c`. The public 0.1.10 installer hash matches the
validated local artifact; both public Companion ZIP aliases match the local
0.3.10 package byte-for-byte. The live update feed matches and is no-store.
GitHub CI run 37337860442 and Windows widget run 37337860466 both passed.
Prior Netlify deploy for rollback: `6ac3c4835bcb870007264658`.
