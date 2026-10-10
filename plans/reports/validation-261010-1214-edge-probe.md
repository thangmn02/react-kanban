# Edge packaging probe checkpoint

Status: **BLOCKED / stopped**. One harmless deployment attempted and removed.
No WAV/player, Modal, Supabase, production, detection or UI changes.

## Reproduced cause and local repair

Actual Netlify CLI **27.12.0** initialization selected the old nested TOML but
resolved its build base to the repository workspace root. Publish resolved to
the root `public`; no Edge source directory was discovered. The previous explicit
publish override uploaded static assets without establishing an Edge gate.

Probe preparation now declares an absolute isolated `[build].base`, explicit
`edge_functions = "netlify/edge-functions"`, separate `publish = "public"`, and
an empty serverless-functions directory. Sources/imports stay outside publish.
Only index.html, probe.txt, a 1 KiB non-sensitive probe.bin and _headers are allowed.

Reliable offline build: `python scripts/lead-edge-probe.py build`, invoking
`netlify-cli@27.12.0 build --offline --context production --cwd <probe-package>`.
Pre-upload checks require an intact compiled eszip2, exact `/*` route, no
exclusions/post-cache routes, `on_error: fail`, and unchanged source/manifest
hashes. Authentication tests cover site binding, environment failure and caching.

Pre-upload artifact: 6,214-byte eszip; SHA-256
`70271fbff8c45c9d2a85c9c55e71c5f83575fbb756c9488fce0ccc74bf970a75`.
Manifest SHA-256:
`118d42de143b87ad2eef7480df967766c0556f12d2fdd5f25f902f484e500619`.
Raw reproduction, bundles and proof are ignored under src-tauri/target/lead-cache-replay.

## Actual deployment result

Fresh site: `d510ea2e-9731-4662-a494-b96b0caaa49b`; deploy: `6ac9cd9b215a532771a84bc5`.
Fresh DPAPI credential and site-specific server verifier were configured.
CLI `deploy --no-build --prod --json --cwd <package> --dir <package>/public`
reported upload success. This publishes only the isolated site.

However, the compiled directory disappeared during this command. Post-upload
validation raised **“Compiled Edge artifacts and successful build proof required”**.
The safety handler immediately deleted the site before HTTP gate checks ran.
CLI source confirms `--no-build` still runs Edge rebundling when discovered;
that core step clears its dist directory. Why this upload left no manifest is
not yet established. Offline reproduction of the isolated bundling step succeeds.
Do not describe the remaining problem as proven authentication failure or success.

| Known alias (all deleted) | Root / TXT / BIN | Protection result |
| --- | --- | --- |
| https://kora-edge-probe-thangmn02.netlify.app | 404 / 404 / 404 | Not verified |
| https://6ac9cd9b215a532771a84bc5--kora-edge-probe-thangmn02.netlify.app | 404 / 404 / 404 | Not verified |
| https://d510ea2e-9731-4662-a494-b96b0caaa49b.netlify.app | 404 / 404 / 404 | Not verified |

No sentinel content returned. Site API and retained-deploy lookup return 404.
These results prove deletion only, not authentication. Runtime Edge execution,
missing/wrong/correct authorization, Range, HEAD, encoded paths, method rejection,
error handling, cache isolation and authorized browser access remain **BLOCKED**.

## Regressions and next gate

Gate tests: **10/10**. Packaging rejection tests: **6/6**. Lifecycle review passed:
failures after creation remove the isolated site; a recorded upload attempt
cannot silently retry. Production metadata fingerprint unchanged before/after
upload and after deletion. No credentials or large traces appear in tracked files.

Preserve the consumed attempt and fresh credential records. Do not redeploy or
publish audio. The next bounded action is to repair/prove the exact deploy-stage
rebundling path locally, then obtain separate authorization for a new probe attempt.

References: [Netlify Edge discovery](https://docs.netlify.com/build/edge-functions/get-started/),
[configuration](https://docs.netlify.com/build/edge-functions/optional-configuration/),
[CLI deployment](https://cli.netlify.com/commands/deploy/).
