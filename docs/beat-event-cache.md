# Beat EventTrack delivery

An enabled, visible Beat Grid prefers validated server-cache events for a fresh
active media clock. Cache misses never block playback: local analysis continues
where capture is available; clock-only sessions use explicit non-semantic
Tempo/decorative timing. Paused, stale and confirmed-silent playback stays dark.
The grid remains five rows by eight cells with intentional visual randomness.
When semantic analysis is unavailable, generic tempo timing pulses a subtle
grid border rather than any instrument row. Its separate decorative render
path never uses semantic hit styling or increments instrument counters.
Existing shapes remain decorative and can coexist with typed row attacks.

## Sparse production cache

`GET /api/beat-events?provider=<provider>&id=<asset>&start=<seconds>&end=<seconds>`
returns schema-two sparse coverage. Add `analysisVersion`, `chunk` and immutable
`revision` to retrieve a ready chunk. Netlify and the Vite development gateway
use the same handler. Desktop requests the fixed HTTPS application endpoint.
The API never accepts arbitrary audio/download URLs.

The authoritative range contracts and limits are in
[event-track-ranges.ts](../src/features/music/event-track-ranges.ts).
Manifests bind asset, timeline, analysis version, duration, requested range,
30-second chunk revisions and `dominant-monophonic` Melody policy. Missing
intervals are valid: a two-hour asset can contain only minutes 34–39 and 83–88.
Ready empty chunks represent analyzed silence rather than incomplete work.
The server exposes bounded event JSON and allowlisted job state, never private
Storage object paths, credentials, stems or waveforms.

Production uses [the private sparse schema](../supabase/migrations/20261007080000_sparse_beat_cache.sql)
and [the thin handler](../server/sparse-beat-cache.ts). Asset/version locking
reuses overlapping ready/live work. Immutable objects upload before atomic
range publication. See [server deployment](server-beat-analysis.md) for compute,
credentials, audio-input availability and operational limits.

## Demand and asynchronous admission

Only visible Beat Grid with fresh advancing, unmuted playback submits semantic
analysis demand. Ordinary playback with Beat Grid disabled starts no Modal job.
An authenticated schema-two POST supplies `operation: demand`, a session UUID,
media duration and `requestedRange`; the fixed gateway verifies Supabase Auth.
`operation: end` deletes only that authenticated user's demand.
Anonymous/local-mode sessions keep fallback and cannot submit analysis jobs.

Output windows are at most five minutes with 30-second chunks. Demand heartbeats
renew the current window; new windows begin only near its end. Seek requests the
new destination directly without filling skipped audio. Pause, source change,
disposal and stale playback release demand. A rotated session identity and
ordered release prevent a late admission response from reviving ended demand.
Server TTL also bounds demand when a client disappears without cleanup.

Missed coverage is polled at most once per 15 seconds. HTTP 202 means admitted,
not completed. Failed/unknown dispatch retains expiring ownership, allowing
subsequent live demand to recover. `input_unavailable` explicitly means no
supported authorized audio input; it must not imply a pending model download.
No worker automatically analyzes whole assets after demand ends.

The unshipped native capture candidate registers `inputMode: captured-segment`
without creating a model job. `operation=segment` uploads only a completed
30/60-second WAV core within that active demand. An atomic admission recheck
prevents an upload from reviving ended demand. Private job-owned input and output
cache remain separate; ready/in-flight ranges reuse existing ownership. See
[input bounds and release limits](server-beat-analysis.md#authorized-audio-input).
This route has not yet passed ordinary-playback/Modal validation or shipped.

## Scheduling, merging and telemetry

[event-track.ts](../src/features/music/event-track.ts) owns the normalized
validated chunk adapter. Events bind identity, row, playback timestamp,
confidence and optional duration. Responses are bounded at 512 KiB and 4,096
events per chunk. Melody intervals cannot represent simultaneous independent
leads. Chunk loading also checks neighboring lead overlap.

The engine retains at most three chunks and two chunk requests. It schedules
four seconds of real-time look-ahead, capped at 30 media seconds; pending and
delivered ledgers remain bounded. The existing scheduler retains its own
2,048-event/eight-second limits. Seek/source disposal aborts old requests and
targets. Pause, buffering, generations, rate changes and stale-clock recovery
preserve authoritative-media synchronization. Capture loss cancels local work
while cached events can continue against an independent fresh clock.

Within ready ranges, server data is authoritative, including empty quiet ranges.
Future cached events replace equivalent lower-priority local events. A 40 ms
row/time tolerance and delivered ledger prevent double flashes at handoff.
Outside ready ranges the local detector and capture normalization remain active.
Capabilities distinguish output-clock capture, estimated native monitoring and
clock-only playback; capture permission requires actual proof.

`eventSource` distinguishes `cache`, `local` and `degraded`. Actual onset/note,
tempo, metadata/lifecycle and random visual traces remain separate. Path/cache
updates use `CACHE_HIT`, `CACHE_MISS`, `ANALYSIS_REQUESTED`, `EVENT_PATH` and
`EVENT_REPLACED`. Target time, late/rejected events, controller/DOM commits and
native animation telemetry remain available. Diagnostics exclude credentials,
private audio URLs and personal data. Tempo/random effects do not increment
semantic instrument counters. Measured Bass holds survive other percussion;
Melody reacts to actual lead attacks rather than envelope updates.

### Temporary semantic row diagnostic

`?musicSemanticOnly=1` enables local telemetry and renders only accepted
normalized onset/note traces. Rows map strictly to Kick, Snare, Hat, Bass and
Melody, with eight cells each. Tempo, envelopes, decorative shapes, hue flow
and degraded filler cannot flash this diagnostic view. Existing cached IDs
and local detector origin travel with telemetry.
If upstream capture diagnostics are disabled, a local trace starts at receipt
of the real typed event in the normalization engine and is marked
`local-detector`; it cannot prove the upstream detector/transport timing.
Enable the Companion's existing `beatTelemetryEnabled` diagnostic setting to
trace those upstream realms as well. No detector stage is fabricated at receipt.

In the app console, `window.__koraBeatRows.semanticOnly(true)` switches the
diagnostic on; `false` restores normal rendering. Call
`window.__koraBeatRows.start(30)` during playback, then
`window.__koraBeatRows.snapshot()` after 30 seconds. The bounded recorder
retains at most 20,000 cell observations and reports overflow. For a known media
range, `start(30, playbackStart)` filters by target timestamp and permits ten
seconds of bounded buffering/startup grace; `stop()` ends the capture early.
Each observation
contains event/trace identity, type, source, target media timestamp (null when
unavailable), actual DOM-commit/animation time, row/cell, semantic flag and
detector/decorative origin and presentation state (`semantic-hit`,
`decorative-shape`, `decorative-cell` or `decorative-global`). Global decoration
has null row/cell coordinates and cannot count as an instrument event.
Inspect `data-beat-*` and `data-event-*` attributes
on a cell to correlate it with Phase 0 records. Shape retriggers also identify
their causal onset/tempo parent. Diagnostics remain local and contain no audio.

Exports deduplicate the multiple cells of an attack before reporting per-row
timestamps and directional coincidence counts within ±50 ms. Coincidence is
descriptive, not an accuracy/failure verdict. Unknown/untimed legacy signals
cannot be presented as timestamped semantic proof. In a private comparison,
explicit `semanticOnly` props allow both renderers to consume one controller's
state simultaneously; their exports can be filtered by mode.

## Identity and offline imports

Provider identity comes from content routes and player-owned now-playing links,
never titles or signed stream URLs. Ads, ambiguous/live media, providers without
an authoritative track link and older Companions without identity retain
local/degraded delivery. SoundCloud route renames require a new cache identity.

The legacy version-one static import route remains for explicitly precomputed
local data. [import-beat-analysis.mjs](../scripts/import-beat-analysis.mjs)
validates selected-stem notes/onsets and writes chunks before the manifest; it
performs no inference, audio upload or automatic source choice. Static data is
served from `public/beat-tracks` or the configured HTTPS cache origin only when
the sparse production backend is not selected.

[lead-note-selection.ts](../server/lead-note-selection.ts) follows the accepted
Colab postprocessing. References preserve their 37/22 lead attacks through
import. These are small regression examples, not universal ground truth or
track-name presets. Heavy models, old Spleeter controls, model downloads and
its delayed-audio path are absent from the client.

## Versioned experimental Lead events

The optional `server-lead-pulse-range-v1` analysis version preserves the `melody`
wire row for compatibility while its product meaning is **Lead**. Each Row 5
event requires validated `lead` provenance: policy version, selected melodic
source, detector, pitched-note/vocal-articulation kind and decoded-input SHA256.
MIDI pitch is optional, since meaningful rhythmic vocals need not be pitched.
Rows 1–4 cannot carry this provenance. Legacy EventTracks remain valid under
their original analysis version; cache identities do not mix the two versions.

The Web and Tauri clients retain the metadata through sparse chunks,
controller scheduling and telemetry (`LEAD_EVENT`). They schedule the same
`targetPlaybackTime`, rather than firing at HTTP arrival. Pause, seek,
buffering, source replacement, cache miss and lease recovery retain the
existing lifecycle. Lead metadata expires with its matching held state.

Client and server flags default off; normal product UI has no model selector.
The existing development debug route contains a private saved-audio Lead mode.
See [server setup and private comparison](server-beat-analysis.md#shared-lead-pulse-development-pipeline)
and [validation/remaining gates](../plans/reports/validation-261009-shared-lead-pulse.md).
