# Kora Phase 3 implementation and Phase 4 qualification

Phase 3 is implemented and qualified within the tested presentation scope. Available Phase 4 engineering checks are complete; production release remains blocked. This report is not a production approval.

## 1. Implementation summary

The current dirty private Lab was preserved on task branch `codex/p3-p4-qualification`, from `experiment/rust-audio-core-lab` at HEAD `a28d8519754b02afec8ad9f3bfea6aa575a3abfd`. No stash/reset, detector replacement, acoustic tuning, capture change, Rust algorithm change, deployment, installer publication or installed Companion update occurred. The baseline inventory, original presentation files and protected hashes are in [admission.json](../../scratch/p3-p4-261026-1706/admission.json).

Existing functionality reused: Event Engine, Scheduler, EventTrack/cache priority, the accepted `visualAttacks` projection, legacy Wave/Ripple/Pop/Splash and special shapes, selected Opal materials, four default rows/optional Lead, row/telemetry/presentation diagnostics, private Companion packaging and actual capture qualification harness.

Changes owned by this task:

| Files | Reason |
|---|---|
| `src/features/music/BeatPattern.tsx`, `SemanticBeatPattern.tsx` | Consume each accepted attack identity; source/view lifecycle guards; explicit exclusive shape entry/exit and suppression; existing geometry remains decorative. |
| `use-presentation-attacks.ts`, `projected-beat-flash.tsx` | Bounded per-identity lifetimes, original deadlines, future gating, accepted cached Lead-state traces, independent row overlays, commit/CSS-start/positive-opacity observations. Legacy-to-projection handoff consumes each Lead ID once. |
| `beat-heartbeat.tsx` | Finite continuous-motion breath from existing released structural ticks, with no competing beat clock or instrument generation. |
| `semantic-motion-pattern.tsx`, `semantic-motion.ts` | Preserve a fresh atomic owner-transition attack; consume inactive arrivals; retire old trace/ownership attributes on animated and reduced retriggers/reset. Existing materials/envelopes are retained. |
| `useMusicBeatSync.ts` | Diagnostics only: a latest-row summary replacement is not a dropped event when its ID remains in the accepted projection. |
| `beat-row-diagnostics.ts`, `beat-presentation-diagnostics.ts`, `src/components/focus/floatingFocus.css` | Separate frame/commit observations, expose pattern ownership, support Heartbeat/reduced/future visibility. |
| Presentation/Heartbeat/motion/controller tests, `BeatPattern.integration.test.tsx`, `MusicPlayer.test.tsx`, `event-track.integration.test.tsx`, Companion `beat-telemetry.integration.test.js` | Add regressions and update semantic-overlay/active-view assertions for the intentional presentation contract. |
| `scripts/fixtures/p3-p4-presentation.tsx`, `verify-p3-p4-presentation.mjs` | Same immutable relative events and AudioContext clock, saved baseline comparison, actual owned Chrome execution, bounded existing diagnostic receipts. |
| `scripts/prepare-p3-p4-runtime.mjs`, `serve-p3-p4-runtime.mjs` | Separately receipted immutable local builds, exact source byte ranges and a retained CC0 control for a real-time soak; no release resources replaced. |
| `verify-companion-hybrid-live.mjs`, `analyze-companion-hybrid-live.mjs` | Extend the existing harness with optional real-time endurance, bounded GC tracing and startup/cancellation cleanup; parameterize analysis output root and acknowledged duration. |
| `scripts/verify-p3-p4-preservation.mjs`, `summarize-p3-p4-qualification.mjs` | Verify protected hashes and aggregate existing diagnostic receipts without generating or altering events. |

Exact test files changed under `src/features/music/`: `BeatPattern.integration.test.tsx`, `beat-presentation.integration.test.tsx`, `beat-heartbeat.test.tsx`, `semantic-motion.test.tsx`, `useMusicBeatSync.test.ts`, `MusicPlayer.test.tsx` and `event-track.integration.test.tsx`. The other changed test is `extensions/kanban-music/beat-telemetry.integration.test.js`. New and edited project records are this report, the task plan, four named P3 deliverables, the reproduction guide, and the appended owning section in `docs/private-acoustic-visual-lab.md`. Existing unrelated dirty files are not part of this task's change inventory.

The [architecture audit](../261026-1706-p3-p4-qualification/p3-existing-architecture-audit.md), [implementation](../261026-1706-p3-p4-qualification/p3-kinetic-grid-implementation.md), [visual results](../261026-1706-p3-p4-qualification/p3-visual-fidelity-results.md) and [P3 checkpoint decision](../261026-1706-p3-p4-qualification/p3-final-decision.md) were recorded before P4 execution. Final review fixes have their own failing/passing receipts and requalification.

## 2. Phase 3 scorecard

| Requirement | Before | After | Evidence | Decision |
|---|---|---|---|---|
| Kinetic Grid | Existing legacy geometry and private Opal renderer | Reused both; semantic identity is independent of decorative geometry | Two 44-case matrices plus final targeted Opal matrices | PASS |
| Heartbeat | Structural ticks/shape pulses, no separate continuous layer | Finite frame breath from released verified structural ticks; no instrument counts | Heartbeat tests, degraded/silence browser cases | PASS |
| Pattern Exclusive | Held masks allowed ordinary overlay interference | Explicit NORMAL / EXCLUSIVE_ACTIVE / EXCLUSIVE_EXIT; owner-scoped suppression, fresh-only recovery | Four-event browser case: three suppressed, one fresh observed | PASS |
| Semantic identity | Latest-row trace/counter hid batched same-row IDs | Every projected accepted ID gets a decision and independent presentation lifetime | Batch: baseline 1/3 versus current 3/3 in both modes | PASS |
| Rapid-event presentation | Decorative coalescence could conceal accepted attacks | 20/30/60/125 ms identity-preserving fixtures; sub-frame contributions reported separately | Same immutable inputs at two software pacing rates | PASS |
| Reduced motion | CSS/Opal marker support; stale moved-cell trace fields | Static contributions or a steady marker; future gating and complete old-ID cleanup | Failing/passing reduced regression; final six-case Opal runs | PASS |
| Visual lifecycle | Mixed legacy/new owner handling | Pause/seek/buffering/source/capture/epoch/view resets; atomic fresh owner event retained; old exclusive timers retired | Browser lifecycle, unit visibility, empty-session and owner-transition regressions | PASS |

Final edge repairs cover the empty-session Opal allocation, rejection of the existing zero-confidence 120 BPM degraded fallback as a verified Heartbeat, cached Lead-state presentation beside percussion, the split-task legacy-to-projection Lead handoff, and exclusive exit-timer cancellation on atomic capture replacement. Failing receipts and passing regressions are retained. These repairs do not change acoustic admission, capture, EventTrack or scheduling.

## 3. Phase 4 scorecard

The current brief owns A–F definitions. Recovered historical criteria remain: independent per-class percussion precision ≥90% and recall ≥85%, physical absolute A/V p95 ≤50 ms, and ≥30 consecutive real minutes per target platform. See the [Whiplash acceptance](../261014-2221-whiplash-stress-test/plan.md), [browser-first rubric](../261015-0916-browser-first-beat-candidate/plan.md) and [switching/reliability plan](../261013-1920-beat-grid-flash-and-switching/phase-02-persistent-and-switching-lag.md). Natural per-class F1 must be measured from complete labels; no missing original numeric F1 threshold was invented or substituted with browser correctness.

| Gate | Evidence | Metric | Status | Blocker |
|---|---|---|---|---|
| A — runtime/package/capture/event delivery | Actual local H-LIVE/170 ms, actual YouTube L0/0 ms, real worker recovery/source changes, deterministic contracts, native units, isolated builds | Local smoke: complete 30 s, 3,200 A frames, 2,756 CNN frames, zero recorded issues; 20 native tests pass | PARTIAL | Full native/owner Brave/signed-distribution execution unavailable; zero-delay experimental video can receive events after their visual lifetime. |
| B — acoustic classification | Frozen P2 finalization/scorecard; unchanged model and configuration identities | ADTOF A/CNN B0 retained; Bass remains limited DSP and Lead cache-only/experimental | BLOCKED | Complete independent natural class labels/F1 and current acoustic qualification remain incomplete. |
| C — physical synchronization | Stage-level software traces, original deadlines, fixed 170 ms local route | Local source-to-handler p95 about 241.9 ms Kick, 241.4 ms Clap, 152.9 ms Hat; no optical measurement | BLOCKED | Calibrated physical output/photodiode/audio equipment and display uncertainty unavailable. Software scheduler timing is not physical A/V. |
| D — long reliability | Real-time browser-tab soak passes; worker/lifecycle/load run passes | 1,800.973 s, 172 health samples, 216,005 RAF intervals, no flat renderer-count interval or worker failure | PARTIAL | The soak is a generated-control/v2 artifact test, not 30-minute natural YouTube/Spotify/native or final-source release qualification. YouTube continuous-source startup stalled; Spotify account/policy and owner/native environments remain unavailable. |
| E — performance/resources | Actual owned Windows Chrome process groups, JS/worker timing and normal/stress fixtures | Ryzen 7 8845H, 16 logical processors; local smoke about 1.26 CPU-core equivalents and RSS 1,211.8→1,390.7 MiB | PARTIAL | No approved product CPU/RSS budget, weaker device, GPU/isolated Worker/WASM allocation or audible-glitch measurement. |
| F — release/licensing/artifacts | Local production-mode build, manifest/CSP/model provenance and notice audit; no publication | Private package: 67 files, frozen hashes; 45-asset private app; separate production-mode build succeeds | BLOCKED | Model/checkpoint/data, AGPL/SoXR redistribution notices and final signed/native release evidence remain unresolved. No release authorization. |

Actual YouTube capture is verified; timely semantic visibility is not inferred from capture success. In its 30-second zero-delay example, three emitted percussion IDs are accepted: two have explicit `expired` decisions at about 189–191 ms of age, and one Kick commits at 161.95 ms. This is the existing unqualified detector-context/zero-delay limitation, not unexplained renderer identity loss. It is not repaired by re-timestamping, changing compensation or fabricating hits.

Spotify was actually opened in a separate unauthenticated automation profile: login/sign-up and no playing media were observed. Existing source policy blocks analysis. The separate continuous YouTube music stream stalled in the initial media-play promise; its exact owned page was closed through Playwright, letting the harness save failure evidence and close the context. The harness now bounds startup and handles cancellation through `context.close()`. No personal browser or unknown process was stopped.

## 4. Before/after technical metrics

The final 50-case presentation matrices use an actively advancing silent AudioContext clock. The nominal60Hz matrix accounts for 446 current accepted IDs as 427 positive software observations, three intentional pattern suppressions and 16 steady reduced-motion decisions, with zero unexplained misses, duplicate event commits or unexpected visible IDs. The second pacing matrix independently passes the same fixtures. Baseline/current three-event same-row batches retain 1/3→3/3 identities in both modes. Two additional contributions share one sampled frame and cannot establish separately perceived physical flashes. Multiple cells illuminated by one legacy attack are additional cell commits, not duplicate acoustic events.

Nominal compositor flags are not panel certification: measured RAF medians are approximately 17.6 ms and 9.6 ms. Full per-case p50/p95/p99/max, long tasks, task CPU and heap are retained in the browser `result.json` receipts. Normal CSS animation starts and Opal positive-opacity RAF observations have different meanings; the latter are not measured animation-start photons. Reduced Opal records steady activity decisions rather than claiming each rapid hit was visible.

Real normal H-LIVE common-window percussion delivery:

| Row | Emitted / committed / software observed | Source→handler p50 / p95 / p99 / max (ms) | Commit offset p50 / p95 / p99 / max (ms) |
|---|---|---|---|
| Kick | 9 / 9 / 9 | 222.54 / 241.86 / 241.86 / 241.86 | 8.28 / 28.55 / 28.55 / 28.55 |
| Snare/Clap | 9 / 9 / 9 | 220.73 / 241.36 / 241.36 / 241.36 | 10.18 / 28.85 / 28.85 / 28.85 |
| Hat | 17 / 17 / 17 | 134.51 / 152.93 / 152.93 / 152.93 | 5.76 / 10.36 / 10.36 / 10.36 |

CNN execution p50/p95/p99/max is 0.70/0.90/1.10/7.20 ms; queue wait is 1.00/2.10/2.60/8.30 ms; queue depth p95/max is 3/3. Required input age is 127.71/145.12/150.93/150.93 ms. These are stage software measurements from the same source-fenced window, not physical alignment or isolated model CPU. Small negative cross-realm transport values reflect timer/clock uncertainty and are not negative physical latency.

The UI-load actual run preserves 10/10 Kick, 8/8 Clap and 18/18 Hat commits/observations. CNN worker cancellation recovers in the same capture, with a running context, 170 ms, zero queued/dropped semantic events and zero recorded worker failures at the recovery check. Pause/resume retains the mode; seek/rapid scrub revoke compensation; capture restart changes identity; source replacement/end leave no retained active cells. Actual headless hidden-tab transition was unsupported and is not marked PASS.

The real-time soak records continuous source playback and a running H-LIVE context at 170 ms throughout 1,800.973 seconds. Renderer commit counts advance from 33 to 5,404 with zero flat 10-second intervals, sampled queue depth remains 0, and worker failures remain 0. Six pre-admission startup/configuration rejections are already present at the first sample and remain 6 at the last; no additional such rejection occurs during the sampled soak. RAF p50/p95/p99/maximum is 8.30/8.50/8.50/16.60 ms across 216,005 intervals. Sampled JS heap ranges from 12.85 to 20.09 MiB and owned-process RSS snapshots are 1,208.14 and 1,364.90 MiB. Root DOM queries do not traverse the dock's Shadow DOM, so they are not used as an exhaustive visual-node/ownership proof. Full 30-minute per-ID retention, audible glitches and physical pixels are not claimed.

The final actual capture and GC run passes on the v3 build with a complete 30-second export and zero recorded issues. Its 19 source-window Hat proposals include one explicit existing controller `debounce` rejection before acceptance; all 18 accepted Hats commit and are observed. This is not a missing accepted renderer event, and the debounce policy was retained. The first broad Chrome profile exceeded its 64 MB evidence cap and is retained as a failed profiling attempt. GC-only tracing then succeeded at 10.38 MB, with 21,091 nested GC slices: p50/p95/p99/maximum 0.006/0.390/1.288/6.043 ms. These slices overlap and do not equal independent GC collections or isolated Worker utilization.

Validation: the initial 162 tests pass; the relevant suite passes 724 tests; the delivery suite passes 1,141 tests across 134 files; and all 20 native tests pass. TypeScript and the Local/Rust Lab import graph pass, and separate local production-mode builds succeed. The initial full-suite failure and later edge-regression failures remain preserved. Final scoped lint has zero errors and two bounded synchronous layout-reconciliation warnings: accepted-event reconciliation and exclusive-owner reset. These deliberately settle ownership before paint; no per-frame React update is introduced. The cold empty-session preview passes in an actual browser with four idle rows and zero active cells. Final Lead and exclusive cancellation refinements have focused unit/browser requalification; the 30-minute run is accurately retained against its earlier immutable v2 artifact rather than relabeled as a final-release soak.

Primary receipts: [machine summary](../../scratch/p3-p4-261026-1706/qualification-summary.json), [preservation](../../scratch/p3-p4-261026-1706/preservation.json), [full delivery tests](../../scratch/p3-p4-261026-1706/final-tests.txt), and [reproduction commands](../261026-1706-p3-p4-qualification/qualification-commands.md). Initial sandbox restrictions, development navigation failures, sleeping empty test-clock behavior, continuous YouTube startup cancellation and the bounded profiling overflow remain visible in the task evidence. The clock fixture now keeps a real silent source active; no instrument events are generated by that source.

Cleanup is verified in [cleanup.json](../../scratch/p3-p4-261026-1706/cleanup.json): no owned browser/server process remains, and seven closed temporary automation profiles were removed only after path, reparse-point, command-line, creation-time and child-ownership checks. Reports, packages, traces and source evidence remain. No personal browser was stopped. Final owning-component checks pass 56 tests after the last dependency cleanup; TypeScript, whitespace checks and the sealed production-mode build pass.

## 5. Remaining blockers

- Frozen P2: natural per-class accuracy/F1, attenuated/dense percussion, Bass instrument specificity and first-pass Lead remain unqualified. No detector research is proposed or performed.
- P3 engineering: no known unresolved defect remains in the tested scope. The inherited64-entry accepted projection/10-second retention window and bounded diagnostics are not an unbounded event archive. Untimed legacy input cannot establish normalized per-event fidelity.
- P4 platforms: continuous YouTube startup, Spotify account/policy, real Brave/native desktop, signed installation and an available weaker device.
- Physical timing: calibrated audio-to-display alignment, scanout and actual physical refresh remain unmeasured.
- Release/licensing: the included ADTOF notice retains unresolved noncommercial/share-alike rights; CNN source notice retains AGPL and checkpoint/data restrictions; SoXR redistribution obligations remain unresolved. A repository code license is not checkpoint/data redistribution clearance. The [upstream ADTOF port](https://github.com/xavriley/ADTOF-pytorch) also describes conversion of the original released weights; that does not establish a new grant for Kora distribution.

## 6. Final decision

**P3:** PASS

**P4 ENGINEERING:** PARTIAL

**PRODUCTION RELEASE:** BLOCKED

The smallest remaining closure work is target-platform30-minute evidence on a stable authorized YouTube source, supported authenticated/authorized Spotify coverage under the existing policy, isolated native/owner-browser execution, a weaker supported device and approved performance baselines, calibrated physical A/V measurements, and the existing acoustic/rights/release evidence. No new detector research is proposed as part of this assignment. No publication or installation is authorized or performed.
