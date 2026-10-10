# Shared Lead Pulse — development integration and listening handoff

Date: 2026-10-09. Status: mechanically verified development candidate; musical
generalization and public release remain unproven. No deployment, database
migration, production model switch, commit or new research cycle was performed.

## 1. Source-selection and detection policy

One frozen `lead-pulse-v1` policy analyzes the existing, aligned melodic stems
automatically. Vocals, piano, guitar and other compete on two-second passages;
drums and bass cannot own Row 5. Evidence combines measured activity, relative
energy and pitched coverage; vocals additionally have persistent body and
articulation evidence. Dynamic programming includes abstention and a switching
cost. This is a measured source-role approximation, not proof that the loudest
source is the perceptual lead.

Instrumental events require the existing conservative MELODIA positive-voiced
contour and PitchContourSegmentation. Vocal events can use that path, or
meaningful articulation without F0/MIDI: spectral novelty is a proposal, then
persistent mid-band vocal body, envelope change, noisy/short transient rejection
and coincident drum-bleed evidence constrain it. There is no ASR, consonant
transcription, energy-only instrumental fallback, manually selected stem,
genre/language rule or fixed vocals-first priority.

Only the selected source's proposals can become events. Spacing, overlap
truncation, deduplication and sustain retention produce one Lead stream rather
than a union of all detectors. Each event retains its exact audio time, selected
source, detector, pitched/articulation kind, decoded-source hash, policy version
and optional MIDI. Confidence is uncalibrated evidence strength.

Frozen source hash:
`a9e78c0256fd54367a3377b115ae0f0274701db98f3c18fb15d9b101ad6de07b`.
The initial run accidentally treated MELODIA confidence as a class probability,
which removed all pitched events. That invalid run is preserved privately;
the unsupported probability floor was removed to match the existing accepted
positive-voicing baseline. Ownership/articulation settings were not retuned
after holdout results. Existing v3, seven accepted manual-piano stem events and
all original MELODIA/Fusion outputs remain independently preserved.

## 2. Generalization strategy and limitations

Four saved excerpts are regressions only. Eight additional 15-second ranges
were locked before evaluation. Several recording families were used earlier;
these are unused-range holdouts, not a claim of fully independent songs or
population-level accuracy. No post-holdout tuning was performed.

Automatic selection can still follow accompaniment, separation bleed or
spurious pitch. MELODIA remains vulnerable to octave errors, polyphony and
poorly pitched vocals. Vocal articulation may miss soft/fast attacks or admit
breaths/percussive residue. Sustained/quiet music can still produce too many
pitched proposals. Independent bounded server cores may disagree on source
ownership at a boundary. Event counts, source stability and tests do not settle
these perceptual questions. The human quality gate is **PENDING**, not passed.

## 3. Shared interfaces and product integration

- Server: [Lead policy](../../server/audio-analysis/lead-pulse.py), existing
  [analysis adapter](../../server/audio-analysis/analyze.py) and
  [range exporter](../../scripts/export-beat-range.mjs).
- Shared wire contract: [lead-events.ts](../../src/features/music/lead-events.ts),
  optional provenance on the existing `melody` row, and the isolated analysis
  version `server-lead-pulse-range-v1`. Rows 1–4 cannot carry Lead provenance.
  Legacy versions remain compatible; versioned Lead data requires provenance.
- Web and Tauri use the same existing client, sparse cache, media clock,
  event controller and scheduler. Metadata reaches scheduled `melody.state`
  and `LEAD_EVENT` telemetry; its lease expires with the held state.
- Flags are off by default: `VITE_LEAD_PULSE_ENABLED` in the client,
  `BEAT_LEAD_PIPELINE` in gateway/worker. `musicLead=1` is a development-only
  client opt-in. Native release requests retain the HTTPS gateway; flagged
  native development requests use the same-origin Vite gateway.
- The existing private Demo adds **Lead Pulse · shared cache (experimental)**.
  It uses one original recording clock, the product HTTP cache path and the
  existing `SemanticBeatPattern`/5×8 grid, counters, markers and trace export.
  Basic Pitch/MELODIA/Fusion controls remain private; release builds omit the
  diagnostic module. No second platform implementation or renderer was added.

This private cache contains Row 5 only. Rows 1–4 are dark because no fixture
events were supplied to this comparison. Their accepted live processing and
the server's existing ADTOF/Bass analysis are unchanged.

## 4. Regression and holdout results

The following are descriptive outputs, **not precision/recall or listening
acceptance**. Pitched and articulation proposals are deduplicated into the
single emitted stream. Times refer to the original recording; playback in the
comparison starts at excerpt time zero.

| Input | Original range | Split | Lead events | Pitched / articulation | Selected sources | Lead analysis seconds |
|---|---|---|---:|---:|---|---:|
| Gymnopédie | 0–30 s | Regression | 38 | 38 / 0 | piano, other | 5.32 |
| H.S.K.T. | 0–30 s | Regression | 95 | 68 / 27 | vocals | 5.14 |
| Nujabes | 0–30 s | Regression | 121 | 90 / 31 | vocals | 4.75 |
| Levels | 0–30 s | Regression | 75 | 42 / 33 | guitar, vocals | 4.99 |
| Praise the Lord | 105–120 s | Holdout | 55 | 26 / 29 | vocals | 2.57 |
| XO Tour Llif3 | 120–135 s | Holdout | 43 | 28 / 15 | vocals | 1.99 |
| Yellow | 150–165 s | Holdout | 28 | 22 / 6 | guitar, vocals | 3.12 |
| Take Five | 180–195 s | Holdout | 50 | 50 / 0 | other | 2.73 |
| Weightless | 120–135 s | Holdout | 22 | 22 / 0 | piano, other | 1.69 |
| No More Goodbye remix | 180–195 s | Holdout | 25 | 19 / 6 | other, vocals | 3.16 |
| Gymnopédie | 60–75 s | Holdout | 13 | 13 / 0 | other, piano | 2.77 |
| 爱人错过 | 150–165 s | Holdout | 42 | 22 / 20 | vocals | 2.48 |

Mechanical validation:

- Full JavaScript suite: **110 files / 786 tests passed**.
- Python server suite: **28 tests passed**. Unit controls cover silence,
  unpitched vocal articulation/noisy transients, automatic instrumental
  handoff, input hashing and one-stream/sustain constraints.
- TypeScript build, touched TypeScript ESLint, Vite build, Tauri `cargo check`
  and debug `cargo build`: passed. Netlify `.mts` is outside the repository's
  ESLint matching configuration; no false claim that it was linted.
- Real Edge cache → scheduler → DOM → animation: four excerpts, **213/213**
  events committed and animated, all Row 5, no duplicate commit identities.
  Tests also cover pause/resume, forward/backward seeking, playback-rate
  changes, mode/source changes, cleanup, buffering, missing/empty cache and
  optional MIDI. Missing data never invents Lead flashes.
- **202 protected baseline hashes** matched: original detectors/models/output
  artifacts and accepted renderer/scheduler remain byte-preserved. The older
  broad preservation script includes intentionally extended contract files;
  it therefore rejects those metadata edits. The scoped check excludes those
  contract changes explicitly, not detector/render algorithm changes.
- Review repaired the unsupported MELODIA probability assumption, the optional
  worker's Python-wheel incompatibility, matching metadata lease expiry, and
  a new test's mistaken RPC parameter name. No old tests were weakened.

No automated listening verdict is asserted. The new candidate does not inherit
human approval from the older fixtures or previous model comparisons.

## 5. Playback timing and Web/Desktop parity

The same cache timestamps and provenance are parsed for Web and native routes;
release-native endpoint/version behavior is regression-tested separately.
Actual Edge playback yielded these media-clock-relative delays:

| Excerpt | Events / DOM / animation | Median DOM ms | p95 DOM ms | Median animation ms | p95 animation ms |
|---|---:|---:|---:|---:|---:|
| H.S.K.T. | 95 / 95 / 95 | 8.55 | 17.18 | 19.30 | 28.41 |
| Rap holdout | 55 / 55 / 55 | 11.38 | 18.97 | 21.28 | 29.62 |
| Jazz holdout | 50 / 50 / 50 | 8.45 | 17.24 | 18.15 | 28.10 |
| Piano holdout | 13 / 13 / 13 | 6.65 | 12.89 | 15.76 | 27.69 |

Telemetry retains cache/source detection, target playback time, scheduling,
state commit, DOM commit, animation and observable late/drop stages. These
delays are relative to `HTMLMediaElement.currentTime`, not measurements of
speaker-output latency. Isolated component tests do not certify the signed-in
shell, browser capture or hardware loopback.

The same four excerpts also ran inside the actual compiled **Tauri WebView**,
with `isNativeWidget() === true`: **213/213 DOM commits and animations**, no
duplicates. Target timestamps, selected source and optional MIDI match Web
exports **exactly for all 213 events**. This is native component playback,
but does not certify signed-in shell or live capture.

| Native excerpt | Median DOM ms | p95 DOM ms | Median animation ms | p95 animation ms |
|---|---:|---:|---:|---:|
| H.S.K.T. | 6.44 | 13.05 | 17.69 | 26.76 |
| Rap holdout | 6.77 | 13.67 | 18.09 | 25.81 |
| Jazz holdout | 6.53 | 11.34 | 14.87 | 25.41 |
| Piano holdout | 6.51 | 16.84 | 14.72 | 30.95 |

Both paths passed position-preserving mode changes, pause/resume, seek in both
directions, rate changes, source switching and private-player disposal. The
temporary desktop-test processes were stopped after validation. The interrupted
run ended the original port-5173 server; it was restored for the user's listening
review. A test-only DOM mount could outlive a browser disconnect, making the
standalone grid visible without the app shell. The script now restores the page
in `finally`. A fresh page was verified to show the normal app root and no
diagnostic mount; an already-stale tab needs a refresh. No Home/layout source
changes were made for that test.

Private evidence: [Web report](../../src-tauri/target/lead-pulse/browser-check.json),
[fixture manifest](../../src-tauri/target/lead-pulse/fixtures.json),
[native report](../../src-tauri/target/lead-pulse/desktop-browser-check.json),
[exact platform parity](../../src-tauri/target/lead-pulse/platform-parity.json),
[locked evaluation](../../src-tauri/target/lead-pulse/locked-evaluation.json),
[preparation report](../../src-tauri/target/lead-pulse/report.json).
These ignored local artifacts/audio are not public release assets.

## 6. Performance, preprocessing and cache

Existing CPU/two-thread HTDemucs preparation for a 15-second holdout took
23.4–27.5 seconds on this machine; subsequent Lead analysis took 1.69–3.16
seconds. Regression stems were reused. These are measured local times, not
Modal cold-start, cost or weak-hardware estimates. Separation is heavy and
stays server-side. All compared stems preserve the original sample count,
44.1 kHz rate and zero relative offset.

In a ten-second isolated Edge debug playback window, renderer task time was
1.79 seconds (17.9% of one renderer thread), JS heap used 42.6 MiB / allocated
91.8 MiB. This includes private diagnostics and excludes audio decoding/OS
CPU. Actual Tauri debug WebView measured 2.26 seconds of renderer task time
(22.6%) and 33.4 MiB used / 89.8 MiB allocated JS heap in an equivalent
ten-second window. Neither is Celeron/i3 certification or normal-product
profiling; debug refresh and provenance display are included.

The private sparse cache is about 406 KiB across 72 files for all 12 examples.
Clients load existing bounded time-range chunks; private trace detail storage
is capped at 4096 events. Demanded misses preserve the existing rolling-range
async service and fallback. Versioned cache hits reuse prior analysis; an
empty validated track remains a legitimate result. No whole-song cache state
or per-client inference was introduced.

The tested Essentia wheel is CPython 3.14-only. The optional Modal image prepares
a Python 3.14.4 / NumPy 2.5.3 isolated runner while keeping existing Torch on
Python 3.10. Direct and isolated runner outputs match exactly (55 rap events
and identical ownership). That optional cloud image has **not** been built,
deployed or connected to an admitted provider job in this task.

## 7. Licensing and audio rights before deployment

Essentia uses AGPLv3 and offers commercial licensing; its dependency obligations
must be resolved for the intended server deployment. This uses MELODIA's
algorithm, not Essentia's separate pretrained ML models. See the project's
[licensing information](https://essentia.upf.edu/licensing_information.html).

Demucs code is [MIT licensed](https://github.com/facebookresearch/demucs/blob/main/LICENSE);
that alone does not establish the rights for every downloaded pretrained weight
artifact. Verify the installed HTDemucs weight grant and applicable notices.
The existing ADTOF repository's
[license](https://github.com/MZehren/ADTOF/blob/master/LICENSE) is
Attribution-NonCommercial-ShareAlike 4.0; converted weights/port obligations
remain an existing production-percussion blocker, not resolved by Row 5.
No experimental teacher/student weights were made public.

User-provided local recordings were used only for private analysis/listening.
That is not proof of rights to upload, analyze or distribute arbitrary provider
audio commercially. Browser/desktop capture consent, provider terms, authorized
input acquisition, retention/deletion and distribution rights still require
the existing end-to-end input gate. No bypass, new provider scraping or public
audio redistribution was added.

## 8. Remaining release blockers and immediate review

1. Broad human Lead listening: wrong accompaniment ownership, missed meaningful
   attacks, false vocal/quiet flashes and sustained/rest behavior remain
   unmeasured. Do not call this production-ready.
2. Approved real provider input → asynchronous Modal job → atomic Supabase
   coverage → active-session delivery must pass with this version; the private
   saved-input cache does not close that gate.
3. Validate the optional cloud image/runtime, cold starts, bounded job demand,
   source handoffs at range boundaries and real native/browser output timing.
4. Resolve model/software/audio rights and low-end client/long-playback gates.

Open the existing [development Beat Grid](http://127.0.0.1:5173/beat-grid?musicDebug=1),
click **Use saved Melody demo**, then choose an automatic **Lead** input. This
selects the new mode. For a manageable first review, listen to H.S.K.T., rap,
polyphonic piano, jazz, quiet and dense-electronic inputs: about 105 seconds
total. Judge recognizable lead, meaningful attacks, unwanted accompaniment,
rests and natural handoffs. Use **Missed note / Extra note / Incorrect timing /
Incorrect pitch**, then **Export row trace** if something fails. The original
audio is the only clock; unrelated live YouTube playback is not used by this
saved comparison. The normal live grid has not been publicly upgraded.

Development setup: [server/cache instructions](../../docs/server-beat-analysis.md#shared-lead-pulse-development-pipeline).
Stop for this listening review; do not auto-tune failures or start Phase 5.
