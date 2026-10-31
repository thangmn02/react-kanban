# Enhanced Beat Sync: owner listening test (Kora Local, Windows)

This environment is ready for your acceptance test. **No listening result has been recorded or claimed.** You judge audio continuity and Beat Grid sync yourself.

## What is running (prepared October 31, 02:21 local time)

| Part | Details | Receipt |
|---|---|---|
| Kora Owner Preview app | Debug `kora.exe`, identity `app.kanthangboard.ownerpreview` (its local data is separate from your installed Kora), window titled "…Enhanced Beat Sync 0.3.29 (local)". PID 2816, SHA-256 `EAB21137…5293`. Delay gate compiled in (verified "admitted"). | `scratch/source-delay-owner-261031/native-process.json` |
| Frontend | Kora Local on `http://127.0.0.1:1420`, mock data. No Supabase or database involved. | `…/local-server-3/server-process.json` (redeployed: Preparing hint, YouTube media swaps, interface sound clips) |
| Test Chrome | Fresh profile in `…/browser/profile`, with Companion **0.3.29** (package `20a4b549…01ed`) opened on SoundCloud. Brave and its 0.3.25 research Companion are untouched. | `…/browser/browser-process.json` |
| Diagnostics | Read-only telemetry and flash metadata from the Kora window, capped at 45 minutes. No audio, credentials or URLs are recorded, and playback is never controlled. | `…/observation-3/` (1 and 2 hold earlier attempts) |

Enhanced Beat Sync is **OFF** by default. Kora also lists sessions from your Brave Companions (0.3.25). That is expected; just pick the test Chrome source.

## Test steps

1. In **test Chrome**, open an audio-only song you know well on SoundCloud. (A YouTube song also works if its tab is hidden behind another tab.) Play it.
2. In **Kora**, open Focus or the music dock and select that source. If several sources are listed, pick the one with the SoundCloud title. Observe the Beat Grid and audio with Delay **Off**. Status should read **Off**.
3. **Pause** the song. Tick "I may analyze this song…", then press **Turn on Enhanced Beat Sync**. Status should read **Preparing**.
4. **Play**, then click the **Kora Music Companion** icon in the test Chrome toolbar while on the song's tab. Chrome only allows capture after that click. You should hear the song once, with no echo. If it is a YouTube video, switch the browser to another tab. Then **pause**. Kora applies 170 ms automatically, and status should become **Active**.
5. **Resume**. Expect roughly 170 ms of silence, then delayed audio. Judge whether the grid now lines up better.
6. Press **Turn off** during playback, with no consent prompt. Listen for clicks, echo, a repeated passage, stuck silence, and how noticeable the skip of about 170 ms is.
7. Repeat with pause/resume and with a seek. A seek turns the delay OFF by design. Then switch to a different song or source and confirm it does not turn itself back on.
8. **Eligibility checks:**
   - Try a visible YouTube video: the delay should not activate. If it is already active and you bring the video tab to the front, it should drop.
   - Try a Brave (0.3.25) source: turning on should show an Error saying Companion 0.3.29 is required.
9. Confirm that Focus, Tasks and floating Notes keep working while the test runs.

## Relaunch commands (PowerShell, from the worktree)

```powershell
cd C:\Users\thang\.codex\worktrees\kora-release-check\react-kanban
```
**Frontend.** Each run needs a new `--output` folder:
```powershell
node scripts/serve-source-delay-local.mjs --output=scratch/source-delay-owner-261031/local-server-2
```
**App.** It must be built with the gate. Then start it with the loopback debug port:
```powershell
$env:TAURI_CONFIG = Get-Content -Raw scratch/source-delay-owner-261031/native.config.json; $env:KORA_ENABLE_SOURCE_AUDIO_DELAY = '1'; cargo build --manifest-path src-tauri/Cargo.toml; Remove-Item Env:TAURI_CONFIG, Env:KORA_ENABLE_SOURCE_AUDIO_DELAY
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223 --remote-debugging-address=127.0.0.1'; Start-Process src-tauri\target\debug\kora.exe -WorkingDirectory src-tauri; Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
```
**Test Chrome:**
```powershell
node scripts/prepare-source-delay-browser.mjs --package=scratch/source-audio-delay-261031/candidate-2 --output=scratch/source-delay-owner-261031/browser-2
```
**Diagnostics.** First write a new `native-process.json` for the new PID, saved as UTF-8 without a BOM:
```powershell
node scripts/observe-owner-beat-session.mjs --native-owner=scratch/source-delay-owner-261031/native-process.json --output=scratch/source-delay-owner-261031/observation-2
```

## Stopping (graceful)

Create each stop file, then quit Kora from its own menu or tray:

```powershell
New-Item scratch/source-delay-owner-261031/observation-3/stop-observation
New-Item scratch/source-delay-owner-261031/browser/stop-browser
New-Item scratch/source-delay-owner-261031/local-server-3/stop-server
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Kora shows no Enhanced Beat Sync section | Select the music source first. The section only appears for the selected session in the build with the gate. |
| "Needs Companion 0.3.29" error | The selected source is from Brave (0.3.25). Pick the test Chrome source. |
| Stuck on **Preparing** | Click the Companion toolbar icon on the song's tab (capture needs it). A visible video never becomes Active: switch tabs, or use audio-only music. |
| YouTube "Something went wrong" | Refresh the YouTube tab. The cause is unconfirmed: it may be YouTube rejecting a test-controlled browser, or the earlier repeated route switches. Report it if it recurs after the fix. |
| Turn on is greyed out | The song must be paused, the consent box ticked, and the source supported (YouTube or SoundCloud, not Spotify or protected). |
| "Turning off is not confirmed" | Press **Turn off** again. If it still fails, close the test Chrome tab: Chrome restores the tab's normal sound when capture ends, and the Companion lease also expires within about 6 s if Kora quits. |
| No sound after OFF | Pause and play the tab again. If still silent, reload the tab. Report it, because this is a failure. |
| Port 1420 or 47635 already in use | Another Kora (for example your installed 0.1.31) or a previous server is running. Close it before relaunching; don't kill unknown processes. |
| Grid shows nothing | Check the test Chrome tab is unmuted, at volume > 0, and actually playing. |

## Report back (separately)

Please report these outcomes separately:

- Audio integrity
- ON/OFF experience
- Source isolation
- Perceived grid sync
- Event delivery
- Performance
- Native/Companion compatibility

Software timestamps and listening are not calibrated physical A/V timing.
