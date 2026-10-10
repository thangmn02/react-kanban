# Isolated Lead HTTPS source — protection failed; deployment removed

## Checkpoint

**FAIL / stopped. No operational protected player URL.** The approved Edge
authentication source passed unit tests, but the actual static deployment did
not include an executing gate. No browser playback, capture, audio admission,
Modal invocation or cache publication was attempted after that failure.

One separate Netlify project was created:
`kora-lead-audio-test-thangmn02`, ID `89a41bec-2f61-4725-b438-6175faaa8c18`.
Its server-side verifier secret was configured successfully. The first live
anonymous request to the immutable deployment URL returned **200**, with no
`X-Kora-Test-Gate` header. Static `no-store` headers are not authentication.
The original CC0 test content was briefly published without a working gate.

The entire new site was deleted (API 204). These three aliases are **removed**:

- `https://kora-lead-audio-test-thangmn02.netlify.app`
- `https://6ac9c5ac7084104837a69975--kora-lead-audio-test-thangmn02.netlify.app`
- `https://89a41bec-2f61-4725-b438-6175faaa8c18.netlify.app`

Root and direct WAV requests, both ordinary and Range, now return **404** on all
three aliases: 12/12 containment checks. There were no Git-linked previews,
branch deployments, custom aliases or active split tests. This confirms removal,
**not successful authentication**. Authorized 206 playback, wrong-password
denial and shared-cache isolation on a working deployment remain unverified.

## Changes and cause

- Isolated `lead-test-edge-auth.mjs`: all-path Basic authentication using a
  server-only verifier, site-ID binding, fail-closed errors, GET/HEAD only and
  private/no-store responses. No password in the published player or gate source.
- `prepare-lead-test-site.mjs`: original HTML/WAV only, isolated configuration,
  no application backend, CSP and no-store origin headers.
- `deploy-lead-audio-test.py`: site/account/production/hash guards; DPAPI access
  storage; explicit-context Netlify secret; credential-safe diagnostics.
- `verify-lead-audio-test.py`: aliases, split-test exclusion, denied paths,
  authenticated Range/hash and post-warming anonymous checks.
- Deployment failure: the upload shipped static files without the compiled
  Edge gate. CLI code only bundles discovered configured Edge directories;
  the isolated package had no generated `.netlify/edge-functions-dist` manifest.
  Configuration/directory discovery remains to be validated offline. It is not
  established that `--no-build` inherently prevents all Edge deployments.
- The helper now refuses this removed state and audio uploads without compiled
  Edge bundles; its isolated configuration is explicit. No second deployment.

## Identity and regressions

Unchanged source identity:
`kora-development:a9b07c497c1ea5b7b0515d26223b5a0acf1a697da066640a237658d7752bb4ee`.
Original procedural CC0 audio: 60 seconds, stereo 44.1 kHz, 10,584,044-byte WAV.
Analysis contract: `server-lead-pulse-range-v1`, 30-second core ranges.

- Post-hardening shared authorization regressions: **98/98**, nine files, 5.41 s.
- Edge gate tests: **10/10**, including malformed/missing/wrong credentials,
  Range, HEAD, wrong-site binding, server failures and downstream exceptions.
- Dev Supabase anonymous table/admission HTTP checks: **12/12 denied with 401**.
- Database audit: four cache tables RLS-enabled, five service-only RPCs with
  fixed search paths; both buckets private, no object policies granting access.
  No test jobs, demands, chunks or tracks were created.
- Dev rollback counter stable during the health sample; deadlocks/checksum
  failures zero. No claim that historical Postgres logs were audited.
- Read-only production metadata fingerprint still matches `kanthangboard`.
  Production Supabase, Netlify environment and configuration were not written.

Raw sanitized checks remain ignored under `src-tauri/target/lead-cache-replay`.
Access material remains DPAPI-encrypted outside Git and was not reported.

## Remaining setup

First establish the Edge build/configuration locally, then verify an **audio-free
protected probe** across every deployment alias before publishing the WAV. Stop
on any anonymous bypass; real authenticated browser playback and Companion
capture still need verification. Do not reuse the removed site's credential.

No isolated Modal worker/image/endpoint is deployed. After separate approval,
create a dev-only app and dedicated gateway key; supply only dev Supabase URL and
service key, frozen Lead-enabled image and matching authenticated enqueue
endpoint. Planned resources: two CPU cores, 8 GiB, max one container, min zero,
900-second timeout, no GPU, 60-second scale-down. Cloud Lead dependencies, actual
runtime/cost and publication are unverified; a 30-second input is not a runtime
estimate. Existing local 30-second inference measured 66.97 seconds.

Protected source verification, a real independent dev Auth session, exact-asset
authorization and separately approved worker deployment remain required before
capture → analysis → cache → same-source replay. No Row 5 E2E success is claimed.
