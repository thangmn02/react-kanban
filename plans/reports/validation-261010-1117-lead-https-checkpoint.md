# Lead HTTPS source and security checkpoint

Status: **BLOCKED before deployment**, following the user's explicit Netlify-plan
stop condition. No HTTPS URL exists, no site/audio was uploaded, and no worker
was deployed or invoked. No Row 5 cache/replay success is claimed.

## Hosting evidence and smallest alternative

Authenticated Netlify API: team `thangmn02`, Owner, legacy Free
(`free-is-free`, existing site plan `nf_team_dev`). `credit_features`,
`secure_site`, `secure_site_context`, `sso_secure_site` and
`global_access_controls` are all excluded. Existing Kora site `kanthangboard`
was inspected read-only. No production site, team defaults, build or environment
settings were changed.

Current [Netlify project-visibility documentation](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/)
limits private projects to credit-based plans; legacy plans lack that setting.
[Built-in Basic Auth](https://docs.netlify.com/manage/security/secure-access-to-sites/basic-authentication-with-custom-http-headers/)
requires Pro/Enterprise. A non-public URL or noindex header is not access control.

Proposed minimum alternative, **not implemented or deployed**: one isolated
test project with a fail-closed Edge authentication gate for every page/asset
request, one server-only access secret, no backend analysis functions.
The account includes Edge Functions; their documented request chain can gate
[static content](https://docs.netlify.com/build/edge-functions/api/).
Verify missing/wrong credentials deny page, direct WAV, Range requests and all
deployment aliases; test authorized browser playback before approving the source.
Never log credentials or place them in HTML, URLs, Git or reports. This expands
the original static-only scope and requires authorization before implementation.

## Prepared source and compatibility

Existing generator: `scripts/prepare-lead-capture-test.mjs`.
Ignored output: `src-tauri/target/lead-cache-replay/https-source`.
Original 60-second stereo 44.1 kHz PCM WAV, 10,584,044 bytes, CC0; meaningful
pitched lead, accompaniment and rests. One original-audio HTML5 player.

Exact asset:
`kora-development:a9b07c497c1ea5b7b0515d26223b5a0acf1a697da066640a237658d7752bb4ee`.
Audio path:
`/kora-lead-test/a9b07c497c1ea5b7b0515d26223b5a0acf1a697da066640a237658d7752bb4ee.wav`.
Duration 60 seconds; analysis `server-lead-pulse-range-v1`; 30-second output cores
with bounded historical context. Identity derives from the actual WAV hash.

The prepared adapter requires exact HTTPS player source, content hash, expiring
development scope, local Kora origin and real Companion capture permission. It
rechecks selected media after asynchronous reads. Ordinary provider parsing and
production admission remain restricted. Unit compatibility passed; protected
HTTPS browser playback and real Companion capture remain **unverified**, because
the hosting stop condition was reached. Local-file playback is not this gate.

## Final security verification

All checks targeted dev `auywnzmyfdslvgghqflk`; production link remains
`lthlvntvjgnornrdxnms`. Development credentials are DPAPI-encrypted outside Git;
the ignored lead-dev environment has all processing/rights/authorization flags off.

- Final affected authorization regression: **98 tests / 9 files passed**, 5.56 s.
- Hosted database: four Beat tables have RLS enabled, no anon/authenticated
  SELECT/INSERT access; service access present.
- Five admission/execution/publication RPCs: anon/authenticated execute denied,
  service execute allowed; SECURITY DEFINER uses fixed `public,pg_temp` search path.
- `beat-audio-inputs` and `beat-event-tracks`: private, configured byte limits,
  no Storage object policies permitting browser roles.
- Source ownership guards and the 64-hex development asset constraint present.
- HTTP: four table reads and two admission RPCs, both without bearer and with
  an anonymous bearer, all **401**: 12/12 denied. No audio was submitted.
- Database contained zero tracks, demands, jobs and chunks during the audit.

An initial HTTP test selected an absent `id` column on chunks and returned 400;
the test query was corrected to valid columns, then all checks denied with 401.
This was an audit-query error, not a permission repair. No database policies were
changed during this checkpoint. Actual cross-user authenticated replay remains
an E2E gate, not established by ACL inspection. Full application RLS tests need
the full application schema; this isolated database contains only the necessary
cache/input schema. Earlier database health samples had stable rollback counters;
dashboard Postgres logs were not inspected.

Raw status/permission evidence stays under ignored `src-tauri/target/lead-cache-replay`.
No large generated report or secrets are added to tracked documentation.

## Worker status, configuration and cost

Read-only Modal CLI lists `kora-beat-analysis` as deployed, zero running tasks,
created 2026-10-07. This is the existing app, **not an isolated Lead dev deployment**;
its deployed image/Lead enablement was not verified. Existing optional Lead image
definition in `modal_kora_jobs.py` has not been built for this test.

Source image: existing Python 3.10/Torch CPU container; optional isolated Python
3.14.4 environment with pinned Essentia/NumPy for frozen Lead v1. Resources:
2 physical CPU cores, 8 GiB RAM, 900-second timeout, max one analysis container,
min zero, no GPU, 60-second scale-down. Build/startup, weights and dependency
availability still require an isolated cloud validation after approval.

Required **new isolated** configuration (no values in reports):

| Owner | Configuration |
| --- | --- |
| Worker secret | Dev `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Worker image | `BEAT_LEAD_PIPELINE=true`, `BEAT_LEAD_PYTHON=/opt/lead-venv/bin/python` |
| Worker gateway secret | Dedicated `BEAT_ANALYSIS_KEY`, matching dev orchestration |
| Local gateway | Dev URL/anon/service keys, `BEAT_EVENT_CACHE_BACKEND=supabase`, `BEAT_ANALYSIS_URL` set to the verified new enqueue endpoint, matching key |
| Scoped admission | Exact `BEAT_LEAD_AUDIO_TEST_ASSET`; processing, rights and input authorization enabled only after their separate gates pass |
| Development client | Exact `VITE_LEAD_AUDIO_TEST_ASSET`; processing flag and real authenticated dev session |

No isolated endpoint exists yet. The enqueue contract is HTTPS POST with bearer
gateway key and `{schemaVersion:2,jobId:<UUID>}`; 202 starts asynchronous work.
Do not reuse the existing app/secrets or production configuration scripts.

[Modal prices](https://modal.com/pricing): requested resources yield a base
$0.00004396/container-second, approximately $0.00264/minute. A hypothetical
5-minute run plus 60-second idle is about $0.0158; 15 minutes plus idle about
$0.0422. These are conditional resource estimates, not measured test costs or
upper bounds. Initialization/build, gateway execution, actual higher usage,
storage/network, region multipliers and retries may add charges. The 30-second
audio duration does not determine analysis runtime; free-credit eligibility is
not verified. No billable run was authorized or started.

## Remaining sequence

1. Authorize the proposed isolated Edge authentication alternative (or choose a
   hosting account/plan with native private-site protection).
2. Deploy only protected test player/audio and required access gate; verify
   anonymous denial, authorized browser audio and actual Companion capture.
3. Separately authorize a dev-only worker/image/secret deployment and one bounded
   test. Isolate app, credentials and write paths before building or invoking it.
4. Establish a real dev Auth session and verify the normal Kora shell's database
   requirements; do not copy production users or silently migrate the full app.
5. Enable exact-asset admission only after protection and rights checks, capture
   an actual 30-second core, run frozen Lead v1, publish private sparse chunks.
6. Observe same-source normal Focus Dock replay; replay again and prove cache
   reuse without inference. Check pause/seek/source cleanup and Row 5 timing.

No detector, UI, scheduling or production behavior was changed in this checkpoint.
