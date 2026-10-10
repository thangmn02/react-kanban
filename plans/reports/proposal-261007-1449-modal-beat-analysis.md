# Proposed demand-driven, range-based Modal Beat analysis

Status: revised design for review, not implemented or deployed. The user's
2026-10-07 correction supersedes the earlier full-asset proposal. Modal supplies
scale-to-zero compute, Netlify is a thin authenticated gateway, and Supabase
persists sparse EventTrack coverage. Phase 4 remains open. This pass changes
records only: no database, cloud resource, credentials or runtime code.

## Demand and session lifecycle

Playing music alone creates no analysis demand. Never enabling Beat Grid means
no cache-analysis requests, no Modal jobs, no EventTrack generation and zero
server analyzer cost for that playback. Music controls/source discovery remain
independent. Hidden mounted grid components do not establish demand.

A visible Beat Grid consumer or an explicitly enabled active Grid surface
begins a session. Disable, leave/hide/minimize the surface, close, source change
or expiry ends its demand. A main window and pop-out use consumer references:
closing one does not cancel the other's active demand. Default demand is off;
source discovery must not implicitly restore it.

Suggested policy: heartbeat every 15 seconds, server TTL 45 seconds. The
authenticated session binds user, source/timeline, generation and current wanted
ranges; never store a growing listening history. Heartbeat alone starts no
analysis. Admission requires eligible fresh playback and missing wanted data.
The server clamps TTL, ranges and quotas. Seek updates replace wanted ranges.

Send an end request best-effort on close/unmount/disable; missing delivery
expires by TTL. Instant close detection cannot be guaranteed after network loss.
Pause/buffering suspend new requests and prune unstarted forecasts, preserving
UI intent for resume. Stale clocks do not request work. Source changes end the
old session; new generations reject old client responses/scheduled flashes.

## Rolling output ranges and shared chunk claims

Use a maximum 300-second output window, 30-second stored chunks and five seconds
of input context on each side. For VOD position p, output begins at
floor(p / 30) * 30 and ends at start + 300, clamped to known duration.

At 34:20 in a two-hour mix, output is [2040,2340), or 34:00–39:00. Consume at
most [2035,2345), or 33:55–39:05. Publish ten chunks in absolute media time.
Do not analyze skipped audio or the rest of the asset. Full-media duration is
metadata, not a requirement to fetch or process the entire asset.

Allow one current and one next logical window per session. Initially request
the next missing window within 120 wall-clock seconds of the current coverage
end, converted by playbackRate and capped to one next window. A pending/slow
current range remains fallback; it does not trigger an unbounded chain of
future jobs. Seeking requests the destination directly. Rate changes move
the request horizon, not MusicEvent timestamps.

Netlify checks ready/pending chunk descriptors first. Ready chunks need no
Modal invocation. Attach live demand to pending chunks rather than duplicating
work. Atomically claim only missing chunks, keyed by stable asset/timeline,
analysis version and chunk index. Coalesce newly claimed contiguous chunks
into jobs of at most five minutes; do not include cached/pending gaps as core.

Overlapping request 34:30–39:30 shares a pending 34:00–39:00 intersection and
adds only 39:00–39:30. Five-second context may consume adjacent audio again,
but never regenerate or overwrite those already-ready core chunks. Global
pending capacity, admission quotas and retries remain bounded.

A cache miss returns promptly and local/degraded analysis continues. CPU
analysis can be slower than playback on the first visit; this proposal does
not guarantee continuous first-pass server coverage or hide that delay.

## Modal functions, cancellation and recovery

Retain a small protected CPU admission/control function and a separate heavy
range worker behind the replaceable AnalysisService interface. Admission uses
Modal spawn and returns HTTP 202 with the application job ID after accepted
dispatch. Save the Modal call ID. Supabase owns application state; Modal's native
queue executes work. No Redis, separate queue product or always-on poller.
[Modal job processing](https://modal.com/docs/guide/job-queue) documents this.

Start with two CPU cores/eight GiB, one input per container, max_containers=1,
min_containers=0, no warm buffer and a short idle window. No always-on GPU.
Use a small admission image independent of model imports; persist only model
weights in a Modal Volume. Benchmark range runtime/memory before guarantees.
Use [autoscaling controls](https://modal.com/docs/guide/scale) and protected
[Proxy Tokens](https://modal.com/docs/guide/webhook-proxy-auth).

When no live demand wants queued output, invalidate its claim and cancel the
Modal call best-effort. If some output is still wanted, prune/replan unstarted
work to those contiguous ranges; do not cancel another user's useful job.
Before model imports, audio fetch or inference, workers atomically recheck
ownership and unexpired eligible demand. Retries and preemption recovery use
the same gate. Expired work must not enter heavy analysis merely because a
persisted record or Modal queue entry exists.

Running workers check demand between existing bounded processing segments.
Stop when demand disappears, except the final segment or validated upload stage
may finish the current bounded range. Do not start another segment/window
solely to complete abandoned work. Already-ready coverage survives cancellation.
Lightweight stale queue invocations may incur small startup cost; never-enabled
playback creates no invocation.

Job leases, heartbeats, attempt tokens and compare-and-set publication reject
late/superseded workers. Recovery occurs only with renewed live demand; restart
must not blindly requeue all old jobs. Modal
[cancellation](https://modal.com/docs/sdk/py/latest/FunctionCall#cancel) complements
these application gates; cancellation delivery alone is not the guarantee.

## Sparse EventTrack contract and Supabase publication

Introduce an explicit v2 range/demand contract. Current v1 assumes one revision
for a complete asset; it cannot silently stand for sparse coverage.

A sparse manifest view binds asset, stable timeline ID, analysis version,
duration, 30-second chunk size, dominant-monophonic policy and per-ready-chunk
revisions. Return ready/pending/missing intervals only for the requested view.
There is no required whole-track complete state. Independently ready examples:
[0,300), [2040,2640), [4980,5280); every other interval remains missing.
Half-open intervals assign boundary attacks to exactly one chunk. A validated
empty ready chunk means silence; an absent chunk means fallback.

Proposed tables and private Storage bucket:

- beat_event_tracks: stable asset/timeline metadata and analysis version.
- beat_event_chunks: chunk state, output coverage, immutable revision/object
  pointer and pending claim ownership.
- beat_analysis_jobs: bounded input/output ranges, claimed indices, attempt
  token, Modal call ID, state, lease and sanitized failure classification.
- beat_grid_demands: expiring consumer session/generation and wanted ranges.
- beat-event-tracks bucket: immutable objects under
  <assetKey>/<timelineId>/<analysisVersion>/<chunkIndex>/<revision>.json.

Validate sorted absolute-time events, unique IDs, bounded size/density and one
nonoverlapping Melody line. Upload all objects of a publication batch first,
then atomically mark its descriptors ready, conditioned on current ownership.
Incomplete uploads never become cache hits. Coverage is the union of ready
chunks; unrelated ranges are not prerequisites. Sealed validated batches may
publish before remaining job work if lead/boundary checks are satisfied.
Provisional events are never ready; failed replacements retain older coverage.

Netlify returns sparse metadata and requested chunks only. Bound a manifest
view to 600 seconds/20 descriptors and 512 KiB; paginate historical coverage.
Keep three loaded chunks, two range fetches and the existing bounded scheduler.
An unrelated range publication must not invalidate current chunk revisions
or flush useful events. Cache wins only within ready coverage; holes keep
local/degraded delivery and existing priority/dedupe behavior.

Support v1 offline imports through an explicit read compatibility adapter.
Old v1 submissions must not start full-asset production jobs. New clients send
bounded v2 demand/range requests. Preserve all five rows/eight cells, media
clocks, targetPlaybackTime, late/drop diagnostics, recovery and visual randomness.

## Bounded audio retrieval and lead continuity

Pass validated provider/media identity plus output range, not arbitrary URLs,
cookies or raw browser PCM. Resolve metadata, then fetch/decode only core and
context using provider segment/time/byte-range access. Enforce byte/time limits
and verify actual decoder PTS against media time. yt-dlp documents time-range
section downloads with ffmpeg in
[its official options](https://github.com/yt-dlp/yt-dlp#download-options).
That setting alone does not prove skipped audio was not transferred:
instrument actual download bytes and decode intervals before enabling adapters.

Do not silently fetch/decode a whole asset when bounded access fails. Return
range_unavailable and retain fallback. Authorized private media needs a
range-capable adapter too. Protected providers still need available authorized
input; a track ID alone is insufficient. Temporary clips/stems are removed.

Live/DVR needs a stable timeline epoch, available segments and verified timestamp
mapping. Never record indefinitely or reuse restarted/sliding live timelines
under one VOD cache identity. Without that capability use explicit local/degraded
mode. Long mixes/podcasts do not require full-asset allocations.

Normalize clip detections using verified input start/PTS to absolute media
seconds. Publish attacks only inside claimed core. Context supplies boundary
evidence without duplicate attacks. Clip/seal holds and reconcile adjacent lead
tails. Boundary carry metadata must not manufacture a new note attack.

The accepted lead selector must use bounded evidence instead of selecting from
the entire asset. Reuse note/merge behavior and adjacent cached lead continuity
as evidence, not a fixed per-asset stem mapping. A distant seek uses its own
context without traversing skipped audio. One dominant lead controls each
instant; validate adjacent-window continuity and source changes on broader
holdouts. No song rules, broad model research, heavy client models or new Bass
DSP are introduced.

## Configuration and replaceability

Proposed file boundaries remain modal-app.py for admission/control/dispatch,
supabase-cache.py for ownership/publication, the existing Netlify handler for
cache reads, and a focused migration. Another compute provider can implement
the same range/demand AnalysisService contract.

| Location | Variables |
| --- | --- |
| Netlify only | BEAT_ANALYSIS_URL, BEAT_ANALYSIS_KEY (Modal proxy credential), BEAT_EVENT_CACHE_BACKEND=supabase |
| Netlify and Modal Secret | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| Backend policy | BEAT_CACHE_BUCKET=beat-event-tracks, new pinned BEAT_ANALYSIS_VERSION for range semantics |
| Modal configuration | BEAT_ANALYSIS_THREADS=2, TORCH_HOME=/models |
| Developer/CI only | MODAL_TOKEN_ID, MODAL_TOKEN_SECRET for deployment |
| Shared bounded policy | BEAT_ANALYSIS_WINDOW_SECONDS=300, BEAT_ANALYSIS_CONTEXT_SECONDS=5, BEAT_DEMAND_TTL_SECONDS=45 |

Keep existing public Supabase auth configuration. No privileged VITE_ variable,
browser/extension credential, secret in image layers or source control. Use
trusted server secret settings and service-only writes/private Storage access.
No production values or DNS changes are introduced in this proposal.

## Cost per unique uncached audio minute

U is the union of newly analyzed output seconds divided by 60, across asset,
timeline and analysis version, shared by all users. Plays/accounts do not
multiply U. Ready-range reuse has zero additional heavy inference cost.
Never-enabled playback contributes U=0 and starts no worker.

Report U separately from actual input-context minutes, retries, abandoned work
and billable compute seconds. Those overheads cost money and cannot be hidden
behind a claim that every billed second represents unique audio.

Current [Modal pricing](https://modal.com/pricing) makes two cores/eight GiB
approximately $0.00004396/second; Starter includes $30/month compute. Estimate:

    cost = rate * (60 * U * r + contextSeconds * r +
                   startupAndIdleSeconds + retryAndAbandonedComputeSeconds)
           + admissionCost

Here r is compute seconds per audio second. Local clips took 40–41 seconds per
30 seconds; Modal performance is not measured. Illustrative r=1.4–2.5 yields:

| Unique uncached output minutes/month | Core inference, before credits/overheads |
| ---: | ---: |
| 100 | $0.37–$0.66 |
| 500 | $1.85–$3.30 |
| 1,000 | $3.69–$6.59 |

Five-minute core plus ten-second context adds about 3.3% input minutes; fragmented
small cores have proportionally larger overhead. Startup, paid idle, retries,
abandoned running work and input access remain separate. Cached requests still
consume thin Netlify/Supabase traffic. These are estimates, not invoice promises.

Retain proposed $30 gross usage/$0 net spend caps subject to account settings;
[Modal budgets](https://modal.com/docs/guide/budgets) distinguish them. Existing
Netlify/Supabase subscriptions, storage and transfer quotas stay separate.
Measure EventTrack bytes per analyzed minute, not per song. No billing setting
or paid upgrade is changed.

## Implementation impact and validation gate

Current [useBrowserMusic](../../src/features/music/useBrowserMusic.ts) constructs
the engine from a selected source without UI demand.
[beat-event-engine](../../src/features/music/beat-event-engine.ts) looks up before
checking playback, requests analysis once per lifetime and stops looking up
after a manifest exists. Current request/service contracts have no ranges or
sessions, and the analyzer resolves complete audio. These must change; current
code does not yet satisfy this proposal.

Required implementation checks: zero submissions for never-enabled playback and
hidden-mounted grids; demand enable/end/TTL/shared consumers; direct 34:20 seek
in two-hour media; overlapping users/unique core claims; sparse and empty-ready
chunks; rolling/rate/pause/buffering behavior; queued cancellation before models;
bounded abandoned-running work; retry without demand; partial upload/atomic
publication/stale owners; real bounded retrieval/PTS; lead-boundary continuity;
cache/local handoff and unchanged detector-to-DOM/animation telemetry.

Before any database/schema change, back up and verify Supabase as required.
Deployment and database changes remain held for review. Do not deploy the old
full-asset worker unmodified. This revision changes design records only.

Unresolved empirical checks: Modal range runtime/memory/cost, provider-specific
bounded retrieval/live timelines, account quotas and perceptual lead continuity.
No later product phase or production deployment starts with this revision.
