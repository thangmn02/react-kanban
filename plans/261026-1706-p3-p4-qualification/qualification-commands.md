# Local reproduction commands

Run from the repository root. Existing private source fixtures and admission copies must remain available; the public main branch alone cannot reproduce this private Lab. Commands use the installed Node entry points because the sandbox initially blocked pnpm/Vite temporary-path access. Run browser/native checks with ordinary local process permissions.

```powershell
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b --pretty false
node node_modules/typescript/bin/tsc -p scripts/tsconfig.acoustic-lab.json --pretty false
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml
node scripts/verify-p3-p4-presentation.mjs
node scripts/verify-p3-p4-presentation.mjs --120
node scripts/verify-p3-p4-preservation.mjs
```

Browser matrices own port1436 and close their browser/server in `finally`. They build the actual components and the saved entry baseline, preserving old runs in timestamped task evidence directories. Nominal pacing flags do not certify physical refresh.

Build a fresh isolated private artifact; never use the public packager for this task:

```powershell
node scripts/package-music-extension.mjs --private --hybrid-live --diagnostic-capture --output-root=scratch/p3-p4-261026-1706/companion-recheck
node scripts/prepare-p3-p4-runtime.mjs --name=runtime-app-recheck
node scripts/serve-p3-p4-runtime.mjs --receipt=runtime-app-recheck-receipt.json
```

Check port1420 ownership before starting the last command. A build name must be new; the helper refuses to overwrite the prior app. Keep the server in its owning terminal and stop it with Ctrl+C after closing owned test contexts. No installed Companion, updater channel, public downloads or signed installer is changed.

In a second terminal, a bounded actual H-LIVE run is:

```powershell
node scripts/verify-companion-hybrid-live.mjs --output-root=scratch/p3-p4-261026-1706/recheck --extension-path=scratch/p3-p4-261026-1706/companion-recheck/extension --source=7d0d14b2da7ac6e1fbf48d70e66c1083182b07f6cc7a820b5effd52a39db9f8c --mode=H-LIVE --delay=170 --silent-test --local-assets-only --motion-style=focus --profile-gc
node scripts/analyze-companion-hybrid-live.mjs --output-root=scratch/p3-p4-261026-1706/recheck
```

Use `--capture-cnn-input --extended-lifecycle --lifecycle --ui-load` for the existing actual worker/source fault checks. These retain bounded private input diagnostics and do not qualify acoustics or physical timing. `--youtube=aqz-KE-bpKQ --mode=L0 --delay=0` selects the tested video-safe route; service accessibility may change. Spotify analysis remains blocked by existing policy.

The 30-minute run used the existing CC0 control, repeated into one continuous 1,900-second source byte stream. Its exact virtual WAV SHA and original control identity are in `scratch/p3-p4-261026-1706/endurance-source.json`. Its `live/sources/<sha>/source.json` maps the local URL for the harness. Pass that SHA with `--output-root=scratch/p3-p4-261026-1706/live --endurance-seconds=1800` and otherwise the same H-LIVE/170 ms options. The test uses real wall-clock time; accelerated unit tests do not substitute for it.

Private recordings, source bytes, automation profiles and receipts remain local. P4 release gates require independent acoustic, calibrated physical, platform/device and licensing evidence beyond these commands.
