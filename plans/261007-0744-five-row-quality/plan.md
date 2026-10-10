# Five-row quality and legacy analysis retirement

Current state, 2026-10-07: the later authorized demand/range execution supersedes
the historical deployment hold and stop-after-Phase-4 wording below. Modal and
the Supabase sparse cache are deployed, with a Netlify validation draft. Installed
Edge clock/cache rendering and full regressions pass. Melody perceptual acceptance
and ordinary-provider authorized audio input remain open; no completed-phase
commit or Phase 5 work. See [current plan](../261007-1526-beat-grid-closure/plan.md)
and [range report](../reports/validation-261007-range-beat-analysis.md).

Baseline: `819a627`. Complete only the five-row quality phase and the explicitly
requested browser Dock restoration and full legacy Spleeter retirement. Keep
five rows/eight cells, one dominant Melody lead, established media scheduling,
recovery, cache/local/degraded routing, bounded queues and telemetry.

Browser cause: the inline Focus Dock is hidden when no task is pinned; only
native mode opts into its existing empty-task timer. Restore browser access to
the timer/pop-out without inventing a task or changing controller ownership.

Retire old model code, downloads, worker/WASM packaging, controls and audio
delay. Do not replace the rejected chroma approach with another misleading
full-mix Melody detector. Preserve cached lead events and explicit fallback.

Quality work investigates per-row refractory timing, dense hits, attack evidence,
confidence/dedupe and bass/kick overlap. Tune against representative local real
music and available Colab reference outputs; no hard-coded songs/genre presets,
new heavy client models or broad research. The user's saved music is local
benchmark input only and must not enter Git or public assets.

- [x] Restore and verify an empty browser Dock and shared timer/pop-out.
- [x] Remove the complete legacy AI feature while retaining cached Melody.
- [x] Preserve dense semantic delivery and immediate actual-onset flashes within held shapes.
- [ ] Improve local detection quality; rejected refractory/density trials were reverted.
- [x] Benchmark 19 paired local audio/drum-MIDI excerpts against the baseline.
- [x] Validate accepted lead attacks against complete saved Colab note arrays.
- [x] Run full unit/native suites, isolated Edge browser tests, build, scoped review and report.
- [ ] Check the freshly reloaded installed Companion with real playing music.
- [ ] Commit the phase separately and stop; do not start production closure.

Exit gate: five semantic rows are perceptually coherent on real music. Report
unverified lead/corpus/hardware limits honestly; counts alone do not establish
accuracy. The user subsequently supplied the complete lead-note export;
37/22 accepted attacks survive selection/import exactly, with transcription
tails clipped to one line. Detector quality and broader perceptual main-lead
verification remain unresolved.

Status: in progress; exit gate open. See the
[technical report](../reports/diagnosis-261007-1024-five-row-quality.md).

## Authorized server baseline

The user supplied complete lead references and explicitly extended this phase
to include server-side asynchronous analysis. The references are regression
examples, never universal ground truth, song rules or fixed source mappings.
The unchanged selector reproduces their 37/22 attacks exactly. Parameter
changes require a separate representative holdout before global use.

Implement one bounded worker behind the existing analysis-service interface,
with filesystem job persistence/idempotency and EventTrack output. Heavy
separation/Basic Pitch stay server-only. Analyze source candidates from audio
instead of titles; keep one selected lead line. Reuse the accepted drum model
and existing low-pulse detector for the remaining rows. Keep playback on local
or degraded delivery during cache misses, failures and provider restrictions.
Publish validated cache data when ready and retain it for later sessions.
Do not introduce a distributed queue or broad model research.

- [x] Implement and test durable asynchronous admission/retry/restart and cache serving.
- [x] Implement the replaceable server audio analysis baseline and bounded media resolver.
- [x] Validate unchanged selector/reference preservation and holdout data/structure.
- [x] Verify real inference/cache hits and regression-test active-session Melody handoff.
- [ ] Validate perceptual five-row quality and freshly reloaded installed-Companion playback.
- [ ] Document deployment requirements and activate an available authorized analysis route.

Server baseline and current gate evidence:
[technical report](../reports/diagnosis-261007-1421-server-beat-analysis.md).
Eight real 30-second excerpts analyzed successfully without per-track rules;
silence and segment-boundary contracts also passed. Modal hosting is selected;
adapter implementation/deployment, public media resolution and perceptual closure
remain pending. The local Docker build is not verified. No phase-completion
commit or release yet.

The user subsequently selected Modal scale-to-zero compute with Netlify as the
thin authenticated gateway and Supabase as the persistent EventTrack cache.
Deployment is held until the structure, variables, costs, audio input and
publication design are shown. See the
[Modal proposal](../reports/proposal-261007-1449-modal-beat-analysis.md).
The persistent-host route above describes the tested local baseline; production
requires the proposed Modal/Supabase adapters. No cloud/database changes yet.

The user corrected production scope to demand-driven, range-based analysis.
Only an enabled active Beat Grid may submit; use at most five-minute output
windows, 30-second shared chunks, small context overlap and sparse atomic cache
coverage. Seek targets the new region directly. Expiring demand controls queued
work/retries, with no autonomous full-asset completion. The Modal proposal now
supersedes its earlier per-song/full-asset assumptions and models unique
uncached audio minutes. This is a design revision only; range/demand contracts
and clients still require implementation. Deployment/database changes are held.

Rollback: revert the focused implementation commit. No database or security
policy changes; previous model downloads are left inert, not silently deleted
from user profiles. No publication until the phase's evidence is established.
