# Server Beat analysis baseline: implementation and open gate

Baseline `819a627`; all work remains in the five-row quality scope. The user
explicitly authorized server-side cache-miss analysis. No production hosting
destination has been selected, no phase-completion commit/release was made,
and production closure has not started.

## Behavior

[The worker](../../server/audio-analysis/service.py) implements the existing
authenticated/idempotent asynchronous service interface, with one subprocess,
eight pending/running jobs, durable filesystem state, interrupted-job recovery,
bounded retries/timeouts and public completed-event JSON only. No database or
distributed queue was introduced. Heavy dependencies stay server-only.

[The analyzer](../../server/audio-analysis/analyze.py) uses the accepted research
family: pinned ADTOF percussion, HTDemucs piano/guitar/other candidates, Basic
Pitch ONNX, accepted retrigger/sustain/monophonic selection and normalized
EventTrack output. One candidate controls Melody for an asset, chosen from
audio evidence; no song/artist/genre/provider-stem mapping. Existing local
low-pulse logic supplies Bass; no experimental Bass DSP was added. Sixty-second
segments include one-second context and publish core-region attacks. Cache
directories publish atomically after all chunks pass the real schema checks.

The fixed downloader handles public YouTube/SoundCloud identities, with no
cookies or client PCM upload. Other providers require authorized complete WAV
media; previews are never mislabeled as full-song analysis. Unavailable sources
retain local/decorative fallback. The configured host and actual public-source
resolution still require deployment validation. Setup and limits are owned by
[the server deployment document](../../docs/server-beat-analysis.md).

API/model interfaces were checked against primary sources:
[ADTOF PyTorch](https://github.com/xavriley/ADTOF-pytorch),
[Basic Pitch](https://github.com/spotify/basic-pitch), and
[Demucs](https://github.com/facebookresearch/demucs).
The pinned server environment actually ran inference; no client model was
reintroduced and no broad model search was performed.

## Reference and holdout evidence

The complete saved lead export reproduces 37 Gymnopédie and 22 H.S.K.T. attacks
(time/pitch/amplitude), with zero mismatches. Eleven/one overlapping raw tails
are clipped at the next selected attack, leaving one active line. The .22 gap
is an explicit regression input for the saved layered example, not a production
song preset; the general baseline retains .28. These examples are not universal
ground truth.

Actual server inference, authenticated HTTP admission, persisted jobs, cache
GETs, subsequent idempotency and nonoverlapping Melody holds passed on eight
private 30-second excerpts. No selector parameter was tuned against these
tracks. Six are holdouts beyond the two saved lead references:

| Excerpt | Kick | Snare | Hat | Bass | Melody |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nujabes | 26 | 24 | 94 | 73 | 23 |
| Hysteria | 65 | 41 | 91 | 91 | 45 |
| Yellow | 43 | 22 | 89 | 49 | 66 |
| Redbone | 44 | 17 | 66 | 69 | 5 |
| Take Five | 31 | 54 | 115 | 74 | 25 |
| Levels | 0 | 0 | 9 | 47 | 41 |
| Gymnopédie | 0 | 0 | 0 | 35 | 35 |
| H.S.K.T. | 42 | 19 | 106 | 77 | 40 |

Admission took 0–16 ms; inference took 40.42–41.19 seconds per excerpt on this
CPU environment. A three-second zero-audio fixture produced zero events in
every row. A 61-second repeated-audio boundary fixture published three valid
chunks with a monophonic lead. These establish structural/data-path behavior,
not perceptual accuracy or weak-device client performance. The newly separated
stem predictions differ from the saved lead inputs, so inference counts need
not equal saved-reference attack counts.

Reproduce with [validate-server-analysis.py](../../scripts/validate-server-analysis.py)
and a private `{label,audio}` case manifest. Private audio, arrays, fixture
identities, cache files, model weights and environment keys are excluded from
Git/public releases. Aggregate validation results remain locally under ignored
`src-tauri/target/server-validation-results.json` and
`server-structural-results.json`.

## Delivery, browser and regressions

The added integration case covers a miss followed by a ready manifest during
the active session: past Melody attacks are skipped, the upcoming attack reaches
scheduler/controller/DOM/animation traces, and pause removes its flash. Existing
priority/dedupe, seek, buffering, rate and lease recovery remain covered.

A task-owned Edge page played real supplied audio against the actual generated
cache through the production HTTP cache handler, engine, controller and renderer.
It used a fixture adapter solely for the real HTMLMediaElement clock, not fake
semantic events. Forty cells/five rows remained intact. One full run accepted
and DOM-committed all 240 cached events; inspected commits were about 4–15 ms
after target wall-clock deadlines. Seek and 2x playback rebuilt the queue.
The installed Companion answered the real sessions request, but had no supported
playing music session. This is not a fresh extension detector-to-render proof.

Native animation starts were observed for only a subset of DOM commits in that
browser session. Do not infer physical display/audio alignment or claim every
flash was painted from the DOM counters. A foreground installed-browser
perceptual run remains an explicit gate; no random-visual redesign was applied
to mask this validation limit. Temporary public cache fixtures were removed,
the validation tab closed, and its Vite server stopped.

- Full existing suite: **87 files / 641 tests passed**.
- Python service tests: **7 passed**, including auth/identity, nonblocking
  admission, bounded backlog/idempotency, restart, timeout/retry and partial/
  complete cache visibility.
- Isolated Edge suite: **16 passed**; earlier unchanged native suite: **14 passed**.
- Typecheck/build/bundle budget passed. Lint: zero errors, 23 existing warnings.
- Companion packaging still contains 26 runtime files and no retired heavy
  model/WASM payload. No signed installer/release was published.
- Scoped backend review found and fixed provider-type validation, non-ASCII
  auth comparison, container SIGTERM shutdown, buffered subprocess logging,
  explicit analysis provenance and private Docker build-context exclusion.

Initial inference failed because a transitive library needs `pkg_resources`;
pinning server-only setuptools 80.9.0 repaired it. Windows sandbox blocked
loopback HTTP and test-runner temporary renames; authorized tests ran with
normal host access. One structural test initially used the wrong supplied WAV
filename and was corrected before successful validation. Docker CLI is present
but its daemon is not running: image tags were verified against Docker Hub,
but the container build/run is **not verified**.

## Remaining gate

Choose/activate a persistent analysis host and configure the existing HTTPS
submission/cache routes. Verify public media resolution, active-session cache
handoff and later cache hit on the installed browser. Complete representative
perceptual five-row checks, especially Bass/tonal overlap, cymbal misses and
dominant-lead selection. The general source score is an initial replaceable
baseline, not a claim of globally calibrated lead quality. Phase 4 stays open;
do not label it complete or start Phase 5.
