# Beat EventTrack delivery

The app prefers validated precomputed events for the currently playing asset.
While a cache is missing or unreachable, existing local capture continues.
Without usable capture, Music reports decorative timing instead of instrument
detections. Explicit detected silence and paused/stale clocks remain dark.
Cache delivery itself requires a fresh authoritative media clock.

## Private browser-first candidate

Model evaluation must establish novelty from learned weights and detection
architecture, not an inference format or provider. Before benchmarking a candidate,
compare its model/weight hashes and provenance, preprocessing, class mapping and
complete pipeline against prior Kora runs. Conversions and repackaging do not create
an independent detector; an ADTOF-dependent pipeline remains labeled as such.
Reuse valid matching evidence and skip duplicate experiments. Unknown weight
equivalence stays unresolved instead of being called new technology. The bounded
[V2 sprint](../plans/261016-1459-beat-grid-v2-sprint/plan.md) records the bounded matrix.
Its [completed decision](../plans/reports/engineering-261016-1459-beat-grid-v2-sprint.md)
is NO-GO for replacement: no evaluated candidate qualifies on natural public-row
accuracy. Keep the current baseline/fallback and do not admit a new adapter merely
because native inference is fast or cached model predictions are available.

The [private acoustic and visual listening lab](private-acoustic-visual-lab.md)
replays three frozen prediction tracks against one exact local audio clock,
supports blind provisional annotation and separates acoustic, live-pipeline and
renderer evidence. It does not change the replacement decision or qualify a track.

The private candidate uses [one capability decision](../extensions/kanban-music/beat-mode.js)
for provider restrictions, capture/output ownership, media facts, clock health,
detector qualification and intentional-delay consent. Its source flag is off in
ordinary packages. `node scripts/package-music-extension.mjs --private` writes an
isolated package and listening guide under ignored `scratch/browser-first-candidate/`.
It does not update release downloads or the desktop bundle. The standalone
[private listening harness](../scripts/verify-private-companion.mjs) serves the
production bridge, event engine, scheduler, controller and renderer on local
ports 5173/5174. Its `--serve` mode has no automated consent. Authorized local
audio selected in the review tab stays in that browser.

| Source/mode | Private behavior | Classification |
| --- | --- | --- |
| Exact source with independently verified EventTrack, matching recording bytes/version and fresh clock | Predictive verified cache; no model-cache promotion | Experimental contract; no verified natural track provisioned |
| Captured source with independently qualified trained detector and measured end-to-end p95 ≤50 ms | Live semantic events | Supported only after qualification; current detector fails this gate |
| One audio-only browser source, no video/frames, active audio-only tab capture, replaced original output, fresh rate-1 clock, calibrated bounded delay and explicit consent | Immediate analysis plus intentionally delayed output; optional unverified typed preview | Experimental |
| YouTube video or another supported, owned captured tab with one identified active media source | Zero intentional audio delay; explicit opt-in can enable unverified, potentially late instrument predictions | Private `experimental-live`; accuracy and semantic synchronization unqualified |
| Unknown media/output ownership, multiple active media sources, embedded frames or native monitoring | Buffer denied; no qualified typed claim | Unsupported buffering |
| Spotify | New private capture/analysis/buffering denied; frontend submits no Spotify cloud-analysis request | Policy-blocked pending permission/scope review |
| Protected source | Capture/analysis/buffering denied in the private path | Unsupported |

Private live preview is separate from the calibrated audio-only buffer. Keep
the source playing, invoke Companion on that tab, select it in the grid, then
complete the Live preview authorization, audible-output and late-prediction
checks. Enable **live preview (no audio delay)** while playback continues.
Calibration is not required. The explicit `live` configuration keeps the
output buffer at zero and preserves the existing undelayed audio graph,
including failed activation cleanup. The current detector remains unqualified;
original event timestamps and the existing stale-event rejection remain intact.
Pause, seek, source/generation/rate changes, or lost capture/clock/ownership
proof revoke the preview. Re-enable it explicitly while playing. Video never
becomes eligible for the audio buffer. Spotify and protected-source restrictions
remain in force. See the [live configuration and eligibility contracts](../extensions/kanban-music/beat-mode.js)
and [private UI](../src/features/music/experimental-live-preview-control.tsx).

The private ADTOF refinement remains noncausal and unqualified. It preserves two
accepted activation impulses separated by a deep valley at 20 ms without
splitting a broad plateau, but does not establish acoustic accuracy. An optional
manifest `verification` binds independently reviewed annotations to exact source
identity/version/content SHA-256 and the manifest revision; the private engine
requires the separately bound source fingerprint. Model-generated cache chunks
cannot pass that check. Ordinary provider route IDs alone do not prove recording
bytes, and no verified natural EventTrack is bundled.

The Companion obtains capture through the browser's toolbar invocation and
checks active `getCapturedTabs()` ownership. The private graph requests audio
only: stopping an unnecessary video track was observed to mark Chrome capture
stopped while its audio remained live. The source connects independently to
analysis and one output branch. Model failure cannot close the output branch.
Configure delay only while paused after calibration (at least 32 events); size
is observed p99 plus 40 ms headroom, rounded to 10 ms and bounded to 80–500 ms.
Freeze that calibration for the enabled experiment. Later worker stalls do not
increase output delay. Output changes use a short fade with no simultaneous
full-gain bypass. Pause empties queued events and replaces the DelayNode;
seek/source/generation/rate/unsafe-source changes revoke the experiment. A
replacement capture awaits release of the old output graph. Native capture
never enables this branch.

Diagnostics expose the detector/version, actual intentional delay, calibration,
source/output proof flags, capture/clock health and withheld prediction count.
Optional local trace snapshots are bounded and contain no PCM, URLs or media
metadata. Speaker/pixel timing, glitches and listening acceptance remain separate
physical checks. Software DOM timing and passing unit tests cannot close them.
Provisional human annotations remain investigation-only; the scorer refuses
official metrics until independent timing, completeness and identity checks pass.

## Serving real precomputed data

`GET /api/beat-events?provider=youtube&id=<video-id>` reads a manifest;
add `&chunk=<index>` to read a fixed 30-second range. Netlify routes this to
`beat-event-cache`; Vite serves the same handler during development. The
desktop uses the HTTPS production endpoint, with cookie-free CORS support.
No cache catalog is included: valid misses are HTTP 404, unavailable services
are 503. Both retain fallback playback.

Deploy immutable JSON under `public/beat-tracks/<cache-key>/manifest.json` and
`<index>.json`, or set server-only `BEAT_EVENT_CACHE_ORIGIN` to an HTTPS base
directory containing the same structure. The key is SHA-256 of
`1:<provider>:<id>`; use the owning `cacheKey` implementation in
[the cache handler](../server/beat-event-cache.ts). The endpoint never accepts
an arbitrary media/download URL. Publish chunks before their manifest.
Do not include audio, credentials or private account data in this public cache.

The authoritative version-one contracts and limits are in
[event-track.ts](../src/features/music/event-track.ts). A manifest binds asset,
revision, analysis version, duration, chunk size and `dominant-monophonic`
Melody policy. A chunk binds revision/index and sorted events with unique IDs,
song timestamps, one of the five semantic rows, confidence and optional
duration. Melody cannot contain simultaneous independent leads. Adjacent
loaded chunks also reject overlapping lead intervals. Parsing rejects a
mismatched identity, unsupported schema, implausible media-duration mismatch,
out-of-range events and responses over 512 KiB or 4,096 events per chunk.

Provider identities come from content routes and player-owned now-playing
links, never track titles or signed stream URLs. YouTube ads, ambiguous players,
providers without an authoritative track link, and older Companions without
identity use local/degraded delivery. SoundCloud slug identity follows its
public track route; renamed tracks will miss until their cache is republished.

## Asynchronous cache-miss analysis boundary

Optionally configure HTTPS `BEAT_ANALYSIS_URL` and server-only
`BEAT_ANALYSIS_KEY`, plus the existing Supabase URL/anon key. The browser sends
`POST` to the cache endpoint using its current Supabase access token. The
handler verifies it via Supabase Auth before contacting the fixed worker URL.
Anonymous/local-mode sessions continue fallback without submitting a job.

The worker receives a bearer service key, `Idempotency-Key: <cache-key>` and
JSON `{version:1, asset, cacheKey, chunkSeconds:30,
melodyPolicy:"dominant-monophonic"}`. It must return HTTP 202 with a bounded
`jobId` only after actually accepting work, then publish validated cache data.
The app polls a missed manifest at most once per 15 seconds. It requests
analysis once per selected engine lifetime; worker idempotency must handle
repeated sessions. In-process admission allows five distinct assets per user
per minute, one submission per user/asset/minute and 1,000 active admission
keys. These are instance-local bounds, not a distributed quota; the configured
worker owns durable idempotency and cross-instance abuse protection.

This repository supplies the submission abstraction, not a hosted inference
worker. An unset worker returns explicit `unavailable`, never a pretend job.
No new model, dependency, audio upload or database migration is required.

## Scheduling, merging and diagnostics

The per-source engine retains at most three chunks and two range requests.
Only current/next ranges are fetched, with four seconds of real-time look-ahead
(maximum 30 song seconds); the existing scheduler remains bounded at 2,048
events and eight seconds. Seek/source disposal aborts old requests and targets.
Pause/buffering, clock generations, rate changes and stale-clock recovery keep
the synchronization contract. Capture loss cancels local work while independent
cached events can continue against the fresh media clock.

Within cached ranges, complete cached data is authoritative, including empty
quiet ranges. Before release, cached events replace lower-priority local events.
A 40 ms row/time merge tolerance reconciles independently produced cache and
local views of an attack. Events from the same source use a 1 ms quantized-onset
tolerance so nearby independent attacks survive; local retransmissions are
rejected by sequence, and repeated cached events by event ID. The delivered
ledger remains bounded. Outside cached ranges, local analysis retains its
existing normalization and detectors.
The controller separately retains a 20 ms same-row local-event floor, using
media targets for percussion and arrival times for legacy events/Bass. Its
comparison allows arithmetic roundoff at the exact 20 ms boundary so a valid
boundary hit is not discarded. Cached events keep their existing bypass.
Browser output-clock-capable capture, estimated native monitoring and
clock-only playback are explicit capability tiers; permission/live feed still
requires actual capture proof. Legacy untimed local events keep their arrival
path without manufacturing a media clock.

`eventSource` distinguishes `cache`, `local` and `degraded`; onset, tempo,
metadata/lifecycle and random visual provenance remain separate. Cache/path
changes use `CACHE_HIT`, `CACHE_MISS`, `ANALYSIS_REQUESTED`, `EVENT_PATH` and
`EVENT_REPLACED`. Existing event IDs, target timestamps, late/drop records,
controller commits, DOM commits and animation records are preserved. Music
shows the current path; debug output includes the path and provider, not asset
URLs, access tokens or audio. Degraded flashes use generic decorative traces,
not semantic instrument counters. The normal five-by-eight visuals are intact.
