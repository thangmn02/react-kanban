# Beat EventTrack delivery

The app prefers validated precomputed events for the currently playing asset.
While a cache is missing or unreachable, existing local capture continues.
Without usable capture, Music reports decorative timing instead of instrument
detections. Explicit detected silence and paused/stale clocks remain dark.
Cache delivery itself requires a fresh authoritative media clock.

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
A 40 ms row/time merge tolerance and bounded delivered ledger prevent duplicate
flashes when a cache arrives immediately after a local event. Outside cached
ranges, local analysis retains its existing normalization and detectors.
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
