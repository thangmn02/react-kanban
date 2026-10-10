# Lead Pulse v1 product beta integration

## Outcome

Normal Web/Tauri development now enables the frozen Lead Beta, with a truthful
readiness message and no model/stem selector or fixture player. Release UI,
private cache access and audio processing have independent gates. Public rollout
and heavy processing remain disabled. This is an internal integration, not a
claim that arbitrary uncached provider music works end to end.

The user’s approximate 7/10 listening acceptance and known missed/extra attacks
are preserved. No new detector policy, model training or threshold tuning.
Frozen v1 source/fixture identities remain unchanged. Rows 1–4, EventTrack schema,
semantic merger, scheduling decisions, renderer and animation duration are unchanged.

## Exact product changes

- `src/features/music/lead-feature.ts`: development/private/public audience and
  separate processing gates; explicit permanent access-denial status.
- `src/features/music/MusicPlayer.tsx`: normal five-row UI shows Lead Beta readiness.
- `src/features/music/useBrowserMusic.ts`: do not create the native Lead upload
  buffer from UI activation alone; retain ordinary local monitoring.
- `src/features/music/event-track-client.ts`: authenticated private cache reads,
  versioned chunk requests, processing opt-in, captured `trackId` pending admission,
  and typed HTTP failures. A failed request is not a successful empty track.
- `src/features/music/beat-event-engine.ts`: observe retryable service failures
  separately from access denial, with bounded existing retries and no automatic
  retry of permanently denied lookup/admission until the playback owner resets.
- `src/features/music/useMusicBeatSync.ts`: preserve readiness through paused
  lease expiry only for the same source; no event scheduling changes.
- `server/beat-event-cache.ts`: private Supabase-token/allowlist gates for Lead
  manifests/chunks; independent processing gate; reject conflicting query/body
  versions or operations before admission; no legacy whole-track Lead fallback.
- `server/playback-audio-input.ts`: claim captured ranges with the validated
  analysis version instead of the old constant; export its existing WAV limit.
- `server/vite-beat-cache-plugin.ts`: development gate wiring and bounded WAV
  forwarding through the same admission handler; JSON retains its 2KiB limit.
- `netlify/functions/beat-event-cache.mts`: server-only audience/processing wiring.
- `.env.example` and `docs/server-beat-analysis.md`: defaults, migration from old
  flags, cache-only beta setup and public clearance requirements.

Tests updated: `lead-events.test.ts`, `live-player-diagnostics.test.tsx`,
`event-track-client.test.ts`, `beat-event-engine.test.ts`,
`event-track.integration.test.tsx`, `useMusicBeatSync.test.ts`,
`server/beat-event-cache.test.ts`, `server/sparse-beat-cache.test.ts`,
`server/playback-audio-input.test.ts`. Added `server/vite-beat-cache-plugin.test.ts`.
Legacy tests explicitly select their legacy version rather than inheriting the
new development default. No tests were removed or expectations weakened.

## Normal-product browser evidence

Actual signed-in Kora, Playwright MCP, `/beat-grid?view=app`, existing port 5173.
Used actual H.S.K.T. original saved audio and its 95-event precomputed track via
real local HTTP manifest/chunk requests (200). A temporary, removed Companion
transport adapter bound the normal application to that HTMLAudioElement clock.
No events or timer-generated music were fabricated; this is not live-provider
or native-IPC validation. The private asset alias was not mapped to a provider ID.

Five rows / 40 cells, no research selectors or fixture controls. The two page
comboboxes were workspace and focus-task selection. Normal Pause was clicked;
pause and buffering cleared active Lead flashes. Forward seek to 12s, backward
seek to 1s, replay, resume and 2× rate followed the same source clock. Changing
source removed the old flashes/readiness. Paused readiness persisted beyond lease
expiry without carrying into the next source. No JavaScript page exceptions.

Lifecycle sample: 25 semantic Lead commits, 72 animated cells. Cell-animation
absolute timing difference from the HTML audio clock: median **30.6ms**, p95
**63.6ms**. Multiple cells are not additional notes. These are rendering-clock
measurements, not speaker latency or musical accuracy. Sparse source-event data
do not become decorative Lead flashes. Existing Rows 1–4 visuals remain intact.
Expected uncached-provider HTTP 503 resource errors remain observable.

Screenshot and detailed evidence are ignored under
`src-tauri/target/lead-product-beta/`; no generated JSON report is tracked.
The test transport/audio were removed. Port 5173 belongs to the pre-existing
server; the E2E-owned 5183 server exited normally.

## Checks and limitations

Affected selector chose conservative full regression for unknown Netlify impact.
Full JavaScript suite: **818 passed / 112 files** before the final small routing
and paused-status additions; final touched lifecycle/access checks **67 passed**,
then final development-gateway/input checks **11 passed** and source-owned
readiness hook checks **11 passed**. Typecheck, full ESLint (existing warnings),
Vite build and bundle budget pass. Selector invariants: **15 pass**.
Python **28 pass**, native binary tests **14 pass**, Playwright journey suite
**22 pass**. Windows sandbox temp-cleanup failures were rerun successfully with
the required access; no test was skipped to conceal a failure.

Web/native client tests parse identical Lead versions/timestamps; release native
uses the authenticated HTTPS gateway. No fresh native GUI run: this session has
no callable desktop-control tool. Shared contract/native tests are not a substitute
for that GUI release gate. No fresh low-end-device benchmark is claimed.
Database/RLS checks remain mandatory in CI; not run locally because the Docker
Linux daemon is unavailable. No migration or database configuration changed.

## Availability, setup and public blockers

Normal Web entry: `http://127.0.0.1:5173/beat-grid?view=app`.
Desktop development: `npm run tauri -- dev`, existing native Vite port 1420,
then open **Beat grid**. Do not start duplicate servers. These entries consume
existing cached provider ranges; they do not create an uncached Lead track when
processing is closed. Saved listening remains at the existing private debug route.

All flags and internal cache-only beta instructions live in
[the owning setup documentation](../../docs/server-beat-analysis.md#product-rollout-and-processing-gates).
Private release UI: `VITE_LEAD_PULSE_BETA_ENABLED=true`; gateway opt-in plus
server-only Supabase user allowlist are independently required. Public controls
and client/server processing controls remain false. Flags are not audio rights.

Current local configuration has no `BEAT_EVENT_CACHE_BACKEND`, cache origin,
analysis URL/key, service-role key or server Lead opt-in (presence checked without
printing values). That explains local live-provider 503s. The optional Lead Modal
image is implemented but not built/deployed/validated. Hosted captured-input
migration/permissions and authorized provider input remain unverified here.
No credentials were exposed and no provider audio was uploaded in this task.

| Dependency | Verified evidence / unresolved permission |
| --- | --- |
| Essentia `2.1b6.dev1438` | [AGPL/commercial licensing and dependency conditions](https://essentia.upf.edu/licensing_information.html). MELODIA here has no separate Essentia pretrained weight. Chosen product licensing route remains uncleared. |
| ADTOF PyTorch pin `85c192e78f716ea0b111cc8a5ee4a8f6a3a4f8a9` | [Pinned port documents conversion and bundled official weights](https://raw.githubusercontent.com/xavriley/ADTOF-pytorch/85c192e78f716ea0b111cc8a5ee4a8f6a3a4f8a9/README.md). [Original license is CC BY-NC-SA 4.0](https://github.com/MZehren/ADTOF/blob/master/LICENSE). Exact converted-weight/port commercial grant has not been established. |
| Demucs `4.0.1`, `htdemucs_6s` / weight `5c90dfd2` | [Source MIT license](https://github.com/facebookresearch/demucs/blob/v4.0.1/LICENSE); [weight identity](https://raw.githubusercontent.com/facebookresearch/demucs/main/demucs/remote/htdemucs_6s.yaml). Exact pretrained-weight permission remains unresolved; code MIT alone does not settle it. |

Shortest public-beta checklist: clear dependencies/weights and input authorization;
configure and validate the Lead-enabled worker/private sparse gateway; verify
authorized uncached input → pending → published cache → playback; perform fresh
native GUI and low-end/long-session validation. Public activation remains blocked
until those gates pass. No deployment, installer publication or Phase 5.
