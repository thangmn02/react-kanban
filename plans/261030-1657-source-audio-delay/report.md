# Optional source audio delay: completion report (October 31)

**Decision: KEEP EXPERIMENTAL.** The software work is finished and tested. The owner's real Windows listening test (Phase E) has not been run. Promotion still needs that test plus separate release authorization. Production, the installed 0.3.25 research Companion and the public package are unchanged.

## 1. What the previous agent had implemented (verified)

The following were verified by reading the code and re-running the tests, not just taken from the handoff:

- A separate Companion 0.3.29 package transform (`scripts/source-audio-delay-package.mjs`). It hash-locks its inputs and keeps the model and private-research files frozen.
- A Rust build gate (`KORA_ENABLE_SOURCE_AUDIO_DELAY=1` plus a known app identity) with exact-version Companion admission.
- A Vite gate (`VITE_ENABLE_SOURCE_AUDIO_DELAY`, false in `.env.example`).
- Serialized, fenced beat subscriptions in `nativeMusic.ts`, with a retired-subscription set and per-source intent epochs.
- A paused-only preparation step and a consent contract checked by the Companion (`sourceDelayConfiguration`).
- Baseline before any changes:
  - 0.3.29 package tests 3/3 pass.
  - Native and control tests 47/47 pass.
  - Lockfiles are unchanged; the pnpm drift was already reverted.
  - The previous candidate (`scratch/source-audio-delay-261030/candidate-1`) hashes `da1f98eb…`.

## 2. What was unfinished

- **No real status.** The UI never showed Preparing, Active or Turning off, and "Active" was never tied to confirmed buffering.
- **OFF was ignored during an in-flight ON.** The `busy` early return swallowed it.
- **Late completions could overwrite newer state.** No request token guarded the route state.
- **Two consent steps.** The user had to prepare the route and then separately enable a 170 ms compensation, with a second checkbox and a second pause.
- **Every route change clicked.** The output graph hard-cut the gain on OFF, on a delay change and on capture stop. Measured at 21.6× the normal sample slope.
- **Video could be delayed.** Compensation eligibility (`liveSource`) admitted video sources, so a visible video's sound could trail its picture.

## 3. Code changes completed

| File | Change |
|---|---|
| `extensions/kanban-music/source-delay-audio-output.js` (new, candidate-only) | Route changes fade the old branch out over 12 ms before an undelayed successor fades in, so the two never overlap (no echo). A delayed successor starts immediately because its empty delay line is silent. `stop()` fades, then disconnects every node exactly once and resolves. Muted or suspended routes release immediately. |
| `scripts/source-audio-delay-package.mjs` | In 0.3.29 only: use the smooth module, and wait for the fade before stopping tracks and closing the AudioContext. `media-observer.js` now reports `hidden` (tab hidden and not picture-in-picture). Compensation requires audio-only media or a hidden video. |
| `scripts/package-music-extension.mjs` | Adds the new module to the 0.3.29 package only. The public file list is unchanged. |
| `src/features/music/use-source-audio-delay.ts` (new) | The ON/OFF state machine (described in section 4). |
| `src/features/music/useBrowserMusic.ts` | Replaces the inline delay logic with the hook. |
| `src/features/music/source-audio-delay-control.tsx` | "Enhanced Beat Sync": the line "Audio may play slightly later to match Beat Grid", one source-bound consent, a status line, and Turn off available without consent. |
| Tests | `source-delay-audio-output.test.js` (10), `use-source-audio-delay.test.ts` (7), control test rewritten (6), and 2 new package tests. |

## 4. Final audio graph and state transitions

```
tab audio ─ tabCapture ─ source ─┬─ analyser / detector       (always undelayed)
                                 └─ [DelayNode] ─ gain ─ destination   (one audible branch)
```

**Tab audio.** Chrome mutes the original tab output while capture is active and restores it when the capture tracks stop.

**Kora states** (all derived):

- **Off.**
- **Preparing**: ON requested, or the route is on but buffering isn't confirmed.
- **Active**: the Companion reports `bufferMs > 0` and `outputOwned`.
- **Turning off**: an OFF is in flight, or the previous source is still being restored.
- **Error.**

**ON** (paused only):

1. Version check plus a local intent.
2. The route moves to Companion capture.
3. The user plays once, so capture starts and output ownership is proven.
4. On the next pause, Kora applies 170 ms once for that capture.
5. On resume, the empty delay line refills (about 170 ms of silence), then delayed audio plays.

**OFF** (any time, no consent needed):

1. The intent is disabled and the source's subscriptions are retired first, so renewals can't re-enable it.
2. The stop is acknowledged.
3. Fade, then the capture is released, and Chrome restores the original tab output.
4. Normal Windows capture resumes.

**Failure handling:**

- If the stop is not acknowledged, the route stays on and shows "Error" with a retry.
- A source change (new session, generation or asset) triggers OFF once.
- A Companion lease expiry (6 s), for example when Kora quits, stops capture. This restores sound without Kora.

## 5. ON/OFF failure scenarios

**Automated (pass):**

- Failed ON.
- Failed OFF, then a successful retry.
- OFF during an in-flight ON: the late completion retires its own intent.
- A source switch while Active turns OFF exactly once.
- Rapid ON/OFF: 50 route replacements; every retired branch releases once.
- Each of the following resets the delay or refuses it at the Companion:
  - stale generation
  - foreign owner
  - research modes
  - protected media and Spotify
  - seek
  - a video becoming visible while playing
- Pause/resume flush.
- ON while playing is refused even if the button is bypassed.

**Covered by existing design but not exercised here:** Companion reload or disconnect, tab close or navigation, Kora exit, and Windows sleep. These rely on the 6 s lease and Chrome restoring the tab when capture ends.

**Not tested:** an output-device change in a real browser (its code path stops capture), AudioContext suspend in a real browser, and Windows sleep/resume.

## 6. Transition measurements (Chromium OfflineAudioContext, two-tone signal)

| | Hard cut (old) | Smooth (new) |
|---|---|---|
| OFF while playing, 170→0 ms | 21.6× max sample jump | 1.0× (no click), peak 1.0 (no echo) |
| Delay change, 170→200 ms | 21.6× | 1.0× |
| Capture stop | 21.6× | 1.0× |
| ON, 0→170 ms | no click | no click, about 158 ms of silence while the delay line refills |

**What a listener will notice:**

- Turning OFF while playing skips about 170 ms of music. That is unavoidable without time-stretching, which was rejected as too heavy for this purpose.
- Turning ON adds about 170 ms of silence.
- Switching is not sample-continuous.
- Chrome's own delay in restoring the tab after capture ends is not measured; only the owner's listening test can judge it.

## 7. Actual Windows listening evidence

**None yet.** This requires the owner, the real Kora app, a supported browser with the 0.3.29 candidate, and real music. Steps:

1. Play a familiar audio-only song (or a hidden video tab) with Enhanced Beat Sync Off. Observe the grid.
2. Pause, tick the consent box, then turn on Enhanced Beat Sync. Status should show Preparing.
3. Play briefly so capture connects, then pause. Status should become Active.
4. Resume. Judge whether the grid is better aligned.
5. Turn off during playback. Listen for clicks, echo, a duplicated passage, a stuck mute, and how large the jump is.
6. Repeat with pause/resume, a seek and a source switch. Bring the video tab to the front and confirm the delay drops.
7. Confirm Focus, Tasks and floating Notes still work.

## 8. Companion candidate

| | |
|---|---|
| Version | 0.3.29, "Kora Music Companion Release Candidate" |
| Location | `scratch/source-audio-delay-261031/candidate-2` |
| ZIP SHA-256 | `20a4b5496053d21b34c0d1b64b8cb9a40ef56b2f3f72c43e4e23fd2341a801ed` |
| Reproducibility | Two clean builds gave the same hash |
| Contents | 52 extension files, 61 packaged entries |

- Excluded: research recorder, early classifier, hybrid and SoXR assets. `privateBeatCandidate` is false.
- The earlier `candidate-1` is now superseded.

## 9. Regression results

| Check | Result |
|---|---|
| Vitest | 160 files, 1,293 tests pass |
| Rust | 30 tests pass |
| `tsc -b` | Clean |
| ESLint, changed areas | 0 errors |
| Script tests | 83 pass, 6 fail; the same 6 fail at clean HEAD `45b35a6` (offline research replays and a hosted snapshot) |

CPU, memory and capture stability with a live browser were **not measured**. The affected P3/P4 release checks have not been re-run against this candidate.

## 10. Remaining risks

- Physical A/V timing is uncalibrated; 170 ms is the owner-accepted preset. The owner has also mentioned 150 ms, and that choice is still open.
- Chrome's tab-restore gap on OFF is unmeasured.
- Two pauses are needed to reach Active, because of the paused-before-enable contract.
- A YouTube video only qualifies when its tab is hidden. Chrome's occlusion detection decides `hidden`, so a partly visible window may stay ineligible.
- If the Companion disconnects while Active, the UI shows Preparing or a retryable Error rather than a dedicated message.
- The work is uncommitted on `codex/final-completion-wave`.
