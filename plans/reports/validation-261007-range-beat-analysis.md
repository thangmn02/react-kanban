# Demand-driven Beat analysis: execution and remaining quality gate

Baseline: `819a627`. Status: implementation and cloud validation completed;
five-row perceptual exit gate remains open. No completed-phase commit, application
release or production frontend publication. Do not start production closure.

## Implemented contracts

- Visible Beat Grid plus fresh active playback owns semantic demand. Disabled
  Beat Grid submits no analysis. Pause, stale clock, disposal and source changes
  release demand. UUID rotation and ordered release prevent an in-flight admission
  from resurrecting an ended session.
- Five-minute output windows roll only near their end; seeks request the new
  region directly. Storage contains immutable 30-second chunks and sparse ranges.
  Existing cache/in-flight work is shared across users. A transactional asset lock
  prevents duplicate compatible analysis. Output publication is atomic after every
  chunk validates; ready empty silence is legitimate cached coverage.
- Netlify is a thin authenticated gateway. Supabase Auth verifies admission;
  service-role-only RPCs own demand, jobs and private storage. The fixed Modal
  gateway starts asynchronous jobs; no browser Modal credential or heavy client
  model exists. Model/image resources remain outside application packaging.
- Actual server ADTOF, source separation, Basic Pitch and the accepted deterministic
  lead selector replace prototype output. One lead publishes; no song/artist rules
  or per-track thresholds were introduced. The source selector and audio resolver
  remain replaceable interfaces, with optional ambiguity resolution.
- Bass extracts from the existing separated bass stem instead of the full mix.
  Low-energy/retrigger boundaries produce measured holds. Client holds survive
  other percussion and clear on pause/ownership changes. This changes cache
  analysis version to `server-colab-range-v2`.
- Existing media scheduler, priority merger, bounded memory, telemetry and random
  visual effects remain. Actual onsets, envelope/lifecycle metadata, tempo and
  decorative events retain separate provenance. Legacy Spleeter/client downloads
  and delayed playback are completely retired; the browser Focus Dock is restored.

## Operational evidence

Before schema application, the backup at
`C:\Users\thang\KoraBackups\2026-10-07-154717-lthlvntvjgnornrdxnms`
completed an encrypted 51-table restore comparison. Only
`20261007080000_sparse_beat_cache.sql` and its migration-history entry were applied;
unrelated baseline history was not repaired. Private credentials use Windows
DPAPI outside Git and named Modal/Netlify server secrets.

Modal app `kora-beat-analysis` is deployed with two CPU cores, 8 GiB, one concurrent
heavy job, no GPU and scale to zero. The Netlify gateway was deployed as a draft:
`https://6ac6194b4657c247a8af9b64--kanthangboard.netlify.app`.
The production website and signed Kora update feed were not published.

A disposable Supabase account authenticated through the deployed Netlify API:

- cached range: HTTP 202, one ready chunk, `completed`; no new model job;
- unavailable-input range: HTTP 202 in 4.87 seconds including function/network
  startup, followed by `input_unavailable` and zero ready chunks;
- demands released and disposable account deleted in final cleanup.

This is actual authentication/admission/Modal/cache status, not an API mock.
Private operator output is in ignored `src-tauri/target/live-gateway-validation.json`.

## Real analyzer holdouts

Ten actual 30-second excerpts ran through the deployed CPU worker and private
Supabase cache. They span electronic, pop, hip-hop/R&B, rock, jazz, Vietnamese,
sparse piano and ambient music. Every repeated request produced zero new jobs.
Counts below establish data paths, not listening acceptance.

| Excerpt | Kick | Snare | Hat | Bass | Melody |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nujabes | 26 | 24 | 94 | 58 | 23 |
| Hysteria | 65 | 41 | 91 | 63 | 45 |
| Yellow | 43 | 22 | 89 | 14 | 66 |
| Redbone | 44 | 17 | 66 | 61 | 5 |
| Take Five | 31 | 54 | 115 | 52 | 25 |
| Levels | 0 | 0 | 9 | 36 | 41 |
| Gymnopédie | 0 | 0 | 0 | 0 | 35 |
| H.S.K.T. | 42 | 19 | 106 | 55 | 40 |
| Vietnamese excerpt | 0 | 0 | 0 | 4 | 42 |
| Ambient excerpt | 0 | 1 | 1 | 74 | 37 |

The piano example no longer emits full-mix Bass claims. Ambient Bass density and
the small Redbone Melody count need listening scrutiny; neither establishes a
proven false-positive/miss without audio-aligned review. The saved 37/22 lead
reference attacks still survive their unchanged selector/import regression.
New model output is not forced to match those counts or fixed stem choices.

Remote 30-second jobs took approximately 30–67 seconds, including one first-model
load. Private reports: `modal-holdout-validation-v2.json` and preceding baseline
under ignored `src-tauri/target`. Private audio/model artifacts are not tracked.

## Long-form bounded execution and cost

A declared simulated one-hour asset repeats an authorized excerpt. Analysis
requested only 34:00–39:00, consumed 33:55–39:05 and published chunks 68–77:

- 300 unique uncached core seconds; 310 context seconds;
- 1,159 normalized events across ten ready chunks;
- 280.29 seconds analysis runtime; 281.13 seconds measured wall time;
- 606.46 process/child CPU seconds;
- 2,655.57 MiB container process memory high-water mark;
- repeated cached claim created no new job.

This proves bounded mid-asset processing; it is not a natural five-minute
perceptual corpus or a long-duration browser performance test. Memory high-water
mark belongs to the container process and is not an independently reset job peak.

At [Modal's published pricing](https://modal.com/pricing), checked 2026-10-07,
CPU is $0.0000131/core-second and memory $0.00000222/GiB-second; billing uses
requested resources or actual consumption, whichever is higher. Using measured
CPU and the requested 8 GiB gives about $0.013 for this five-minute inference,
or $2.60 per 1,000 unique uncached audio minutes before startup, idle timeout,
retries, storage and gateway costs. A separate 60-second idle tail per isolated
five-minute job adds approximately $0.53/1,000 minutes. This is an estimate,
not an invoice or guaranteed universal processing rate; monthly included credit
is shared with other workspace compute.

## Installed Companion and rendering evidence

The reloaded project Companion manifest is `0.3.14`. Edge ran actual supplied
audio and actual installed Companion media-clock messages against real cached
events, using an explicitly declared private test asset identity. No injected
clock or synthetic onset source was used in that harness.

Playback, backward seek/replay and 2x rate delivered actual cache attacks through
detector/cache trace → transport/controller → DOM commit → native animation.
Recent sample offsets were approximately 2–9 ms at DOM commit and 10–29 ms at
animation start. A final event beyond the last clock sample was observably reset
at end-of-playback instead of becoming a stale flash. Thousands of cumulative
animation records demonstrate live rendering, not five-row perceptual accuracy
or physical speaker/display latency. Earlier setup had sparse delivery before
reload. A final fresh-page connection began with paused playback and delivered
all 224 scheduled attacks to controller and DOM commits, with 683 native
animation starts. The earlier sparse setup was not reproduced by this clean
start; it remains recorded rather than claimed to be a diagnosed production bug.

## Regression checks

- Full Vitest: **90 files / 656 tests passed**.
- Python service/input/demand checks: **11 passed**.
- Isolated Edge application regression suite: **16 passed**.
- Existing native suite: **14 passed** before the range-only changes; Rust source
  has not changed since that run.
- Full typecheck, frontend build, bundle budget and diff whitespace checks passed.
  Build retains its existing chunk-size warning. Scoped lint has no errors;
  Python/Netlify files outside its config emitted ignored-file warnings.
- Packaged Companion contains 26 runtime files and excludes legacy model/WASM
  resources. This is not a new signed-installer or published extension version.

## Gate decision and exact remaining blockers

**Do not declare the quality phase complete or enter production closure.**

1. Perceptually coherent Melody across representative holdouts has not passed.
   The user reports that Melody still misses many notes in the currently installed
   app. The new server draft is not that published app, so this report cannot yet
   identify a new server-selector failure. A listening/timestamp comparison of
   the new output is still required; successful inference and counts cannot
   substitute for that gate.
2. Ordinary provider playback lacks a configured authorized server-audio input
   ingestion route. The resolver supports private fixtures and backend-registered
   signed segments, but the latter bucket/registration route is not provisioned.
   Such sessions correctly report `input_unavailable` and continue fallback;
   they cannot currently promise real uncached server Melody output.
3. The full installed-browser lifecycle/perceptual matrix has not been completed.
   A clean start and successful seek/rate samples are narrower evidence than a
   full-song listening acceptance. Chrome/Brave/Cốc Cốc and weak-client tests remain
   unclaimed and belong to closure only after the quality gate passes.

Implementation remains reviewable in the working tree. No completion commit or
production publication is claimed. Keep all private validation fixtures outside
Git. Stop here under the user's explicit failed-gate instruction.
