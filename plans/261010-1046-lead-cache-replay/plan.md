# Lead cache-to-replay proof

Demonstrate one authorized, uncached browser source through real Companion PCM,
authenticated admission, frozen Lead v1, sparse publication and normal Focus
replay. Saved fixtures and invented provider identities cannot establish success.

- [x] Map source, clock, audio transport, admission, worker and publication owners.
- [x] Check existing private configuration and authorized source availability.
- [x] Complete independently verifiable bounded Web input transport if needed.
- [ ] Admit and analyze once only when source/configuration/rights gates permit it.
- [ ] Verify authenticated cache-hit replay and normal Row 5 timing using MCP.
- [ ] Run affected shared/native contracts; report exact external blockers and stop.

Do not change Lead v1, Rows 1–4, Focus navigation, scheduling, rendering or public
processing. The user authorized backed-up migrations only on kora-lead-dev and
one access-protected HTTPS test source. Worker deployment requires separate
approval. Raw evidence belongs under ignored src-tauri/target.

## Dependency map

1. `background.js` discovers `media.js` players and derives real provider identity
   using `media-asset.js`; a live exact-source development scope additionally
   permits the original generated test asset. `clock.js` owns the media clock.
2. `beat-sync.js` owns the single capture lease; `offscreen.js`/`capture-engine.js`
   own the existing AudioContext/source. Their current Web transport is typed
   beats and metadata plus gated bounded PCM pulls. Native exposes PCM independently.
3. `useBrowserMusic`/`useMusicBeatSync` feed the shared EventTrack engine.
   `playback-audio-segment.ts` already makes bounded 16 kHz WAV input from PCM.
4. `event-track-client.ts` authenticates requests and sends captured-input demand
   and segments; Web selects it only with development, processing and exact-asset gates.
5. Vite/Netlify call `handleBeatEventCache`; Lead flags and rights gates precede
   `sparse-beat-cache.ts` authentication, demand registration and job dispatch.
6. `playback-audio-input.ts` validates WAV/source/range/demand, stores job-owned
   private input and invokes the existing analysis service.
7. `range-analysis.py` claims the job, resolves authorized input, runs frozen
   `lead-pulse-v1`, exports `server-lead-pulse-range-v1` chunks and publishes them
   atomically through `publish_beat_range`; input cleanup follows.
8. The same authenticated sparse lookup feeds the existing EventTrack scheduler
   and normal Focus Dock renderer on replay. No alternate fixture player needed.

Source boundary: ordinary provider parsing remains unchanged. A separate exact
HTTPS/hash/expiry development scope permits `kora-development`; its SQL constraint
was applied only on the isolated development project. No provider ID is borrowed.
Private credentials are referenced by the documented Windows DPAPI route;
their existence alone does not establish worker availability or audio rights.

## Protected HTTPS checkpoint

- [x] Identify dev `auywnzmyfdslvgghqflk` separately from production
  `lthlvntvjgnornrdxnms`; verify backup restoration before the authorized migrations.
- [x] Prepare original 60-second CC0 audio and one HTML5 player, preserving its hash.
- [x] Rerun final authorization tests: 98 tests passed; hosted ACL/private bucket
  checks passed; 12 anonymous HTTP reads/admission calls denied with 401.
- [x] Inspect Netlify capabilities and Modal deployment without mutations.
- [ ] Deploy and verify protected HTTPS page/audio and real browser playback.
- [ ] Configure an independently authorized, isolated development worker.

The user authorized isolated Edge authentication. The separate test site was
created and its secret configured, but live verification failed: the immutable
deployment URL returned HTTP 200 anonymously without the Edge gate header.
The static deployment omitted the gate. The complete isolated site was removed;
all three known aliases now return 404 for page, WAV and Range requests (12 checks).
No protected source is operational or approved. Browser playback/capture and
analysis were not attempted. Production metadata is unchanged.

Stop at this failed protection checkpoint. Before any future audio deployment,
prove a compiled Edge bundle with an explicitly isolated configuration, deploy
an audio-free probe and verify all aliases. The helper now refuses a removed
site state and static uploads without a compiled Edge bundle. Do not approve a
source until anonymous page, asset and Range access is denied by the live gate.

See [the checkpoint report](../reports/validation-261010-1117-lead-https-checkpoint.md).
The authorized attempt and containment are recorded in
[the protected-source report](../reports/validation-261010-1201-lead-protected-source.md).
