# Shared Lead development integration

The existing General-Purpose Lead pipeline now reaches the private Demo Grid and
the normal Web/Desktop renderer behind the existing default-off flag. Cached
playback is mechanically verified. Arbitrary uncached playback, broad musical
acceptance and public deployment remain open gates. No model tuning, deployment,
database change or new research cycle was performed.

## Policy and shared interfaces

The frozen `lead-pulse-v1` policy automatically selects vocals, piano, guitar or
other over two-second passages with switching cost and ambiguity abstention.
Drums and bass cannot own Lead. Conservative positive-voiced MELODIA supplies
pitched notes; persistent vocal-body, envelope and flux evidence can supply
unpitched articulations. Novelty alone is not instrumental identity. This is an
experimental acoustic role approximation, not proven perceptual lead selection.

The analysis version remains `server-lead-pulse-range-v1`; the compatible wire
row remains `melody`. Events retain media timestamps, source, detector, kind,
policy version, input hash and optional MIDI. The policy hash still matches the
locked evaluation. Existing v3, MELODIA, Basic Pitch and Fusion fixtures remain.
Both platforms use the same EventTrack client, controller, scheduler and grid.

## Completion changes

- `lead-feature.ts`, `beat-event-engine.ts` and `useMusicBeatSync.ts` observe
  checking, pending, unavailable, failed, ready and validated-empty ranges.
  Cached chunk contents take precedence over admission availability. Missing
  chunks are never called successful empty analysis. Old async admissions and
  failures cannot replace current-generation status.
- `beatVisuals.ts` labels Row 5 **Lead**. `MusicPlayer.tsx` exposes truthful
  flagged product status without adding normal-product detector selectors.
- `diagnostics/lead-cache-clock.ts` carries real cached activation metadata into
  the existing normal renderer. The private demo adds **General-Purpose Lead**
  and an optional normal-renderer preview with the same original audio clock.
  Export retains semantic flashes in both modes and deduplicates per-cell hits.
  Review also found and corrected recorded-mode export evidence after switching
  detectors; a focused regression exercises that exact interaction.
- Existing focused tests cover empty/unavailable recovery, stale responses,
  unpitched events, pause/seek/buffering/rate resets and native HTTPS delivery.
  Rows 1–4, ADTOF, Bass, scheduler, merger and `BeatPattern.tsx` were not edited
  during this completion pass. The accepted percussion repair remains intact.

## Actual browser and native evidence

Playwright MCP operated the signed-in application on the existing port 5173.
No replacement app root, renderer or server was created. The original fixture
audio was the only comparison clock.

| Saved input/path | Distinct commits / animations | Median / p95 commit delay |
| --- | --- | --- |
| H.S.K.T., semantic grid | 95 / 95 | 17.4 / 35.0 ms |
| Rap holdout, semantic grid | 55 / 55 | 13.3 / 28.2 ms |
| Piano holdout, semantic grid | 13 / 13 | 10.0 / 18.4 ms |
| H.S.K.T. 16–21 s, normal preview | 17 / 17 | 21.4 / 37.5 ms |

The normal preview produced 52 cell commits and 52 animations for those 17
events. All fixture flashes were semantic Row 5 hits. H.S.K.T. and rap included
27 and 29 unpitched events respectively. These are delivery measurements, not
musical accuracy. Pause, replay, forward/backward seeks, rate changes and mode
changes flushed stale flashes; mode switches preserved playback position.
Legacy A/B retained one audio clock and the original seven piano-stem events.

The flagged normal route rendered 40 cells, Row 5 labeled Lead, no research
selector and no fixture audio player. Actual live playback continued with an
explicit **analysis unavailable** status. Browser console errors were observed
HTTP 404 cache misses and 503 unavailable admissions, not a clean service gate.
A final redundant replay click failed because the page had returned to the live
grid; the completed piano trace had already been exported successfully.

The current native integration test passes an unpitched target at 1.1 s through
the native controller and versioned HTTPS client into only Row 5, then clears it
on pause. Earlier preserved native/Web comparison matched 213 event timestamps,
sources and pitches. That evidence used an isolated native component; a fresh
signed-in native GUI listening run was not performed in this completion pass.

## Generalization, runtime and service limits

Four regression excerpts and eight locked unused-range holdouts remain available
without post-evaluation tuning. Holdouts span rap, rhythmic singing, guitar,
jazz, quiet sustained music, electronic, polyphonic piano and language-pop.
Several recording families appeared earlier, so these are not fully independent
song-level holdouts. Broad human listening has not passed. Separation bleed,
accompaniment ownership, polyphony, octave errors and soft vocal attacks remain
plausible limitations; counts cannot establish accuracy.

Existing frozen analysis took approximately 1.7–3.2 s per 15-second holdout on
already-separated stems. That excludes separation and cloud startup. Clients
perform no heavy inference; existing three-chunk, two-fetch and 2,048-pending
bounds remain unchanged. No fresh weak-hardware or long-session benchmark is
claimed here. Cache reuse needs no new heavy analysis.

This local environment lacks `BEAT_EVENT_CACHE_BACKEND`, `BEAT_EVENT_CACHE_ORIGIN`,
`BEAT_ANALYSIS_URL`, `BEAT_ANALYSIS_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and server
`BEAT_LEAD_PIPELINE`. Public Supabase client configuration alone is insufficient.
Real private cache GETs succeed; its POST intentionally cannot start jobs.
The optional Lead Modal image is implemented but not built/deployed/validated.
Ordinary provider audio authorization/input delivery remains unresolved. Missing
analysis never blocks playback or invents Lead events.

## Checks and rights

Final JavaScript suite: **800 tests / 112 files pass**. Typecheck, scoped ESLint
and final Vite build pass. Python analysis tests: **28 pass**. Cargo check and
**14 native tests pass**. Initial Windows sandbox filesystem/socket failures
were rerun with required access; existing Vite config/chunk warnings remain.
The temporary approval-review usage block cleared on continuation. Later review
timeouts for the focused test and final build cleared on their permitted single
retries; both executed successfully. Raw traces/screenshots remain ignored under
`src-tauri/target/lead-integration/` or
`.playwright-mcp/`; this pass adds no generated JSON to tracked reports.

| Dependency/asset | Verified evidence and public release gate |
| --- | --- |
| Essentia 2.1b6.dev1438 / MELODIA algorithm | [AGPLv3 or commercial licensing](https://essentia.upf.edu/licensing_information.html); compliance, dependency obligations and the chosen distribution route require clearance. No separate Essentia pretrained model is used. |
| ADTOF teacher and converted weights | [Original CC BY-NC-SA 4.0 license](https://github.com/MZehren/ADTOF/blob/master/LICENSE). Installed `adtof-pytorch` 0.1.0 at commit `85c192e` bundles converted official weights; its own grant was not established. Production rights remain blocked. |
| HTDemucs 4.0.1 / `htdemucs_6s` | [Source MIT license](https://github.com/facebookresearch/demucs/blob/v4.0.1/LICENSE) verified. Exact `5c90dfd2` weight permissions still require confirmation; source licensing alone is insufficient evidence. |
| Basic Pitch 0.4.0 | [Apache-2.0 source and notices](https://github.com/spotify/basic-pitch/blob/v0.4.0/LICENSE); retained private diagnostic baseline, not used by the new Lead policy. |

User-authorized local listening does not establish rights to process, transfer,
retain or distribute arbitrary provider audio publicly. No restricted component
was publicly enabled.

## Listening handoff and unresolved gates

Open `/beat-grid?musicDebug=1`, expand Beat debug, click **Use saved Melody demo**
and select an **automatic Lead** input. It selects **General-Purpose Lead
(experimental)**. Use Original audio and Replay passage. Review H.S.K.T., rap,
guitar, piano, jazz and quiet first (105 seconds total). Mark missed, extra,
timing or pitch problems and export the trace. Manual stem selection is not
required. The preview checkbox optionally exercises the normal renderer.

Release remains blocked by human musical acceptance, real authorized uncached
input/service operation, software/model/audio rights, fresh native GUI listening
and weak-hardware/long-session validation. No public deployment or Phase 5.
