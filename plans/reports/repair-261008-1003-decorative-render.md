# Decorative fallback rendering repair

The confirmed cross-row contamination is repaired locally. Generic degraded
tempo no longer enters `.onset` or any semantic instrument animation. It uses a
subtle border pulse with `semantic:false`, `origin:tempo-fallback` and
`presentation:decorative-global`. The five instrument rows remain neutral when
there are no accepted semantic events. Existing random shapes and their separate
animation path are preserved. Decorative creation uses a queue observation,
not an `EVENT_DETECTED` record.

The changes are limited to the renderer, its CSS, bounded diagnostic coordinates
and regression tests. Global observations have null row/cell coordinates;
semantic hits retain their original row mapping, IDs and timestamps. Detectors,
models, scheduler, merger and cache behavior were not changed by this repair.
The failed PrimaryMelodyTracker candidate and earlier diagnostics remain intact.

## Playback evidence

The same Nujabes 30-second input and existing server-generated EventTrack were
replayed with Companion **0.3.14** loaded into isolated Edge. One controller and
real media clock fed simultaneous normal and semantic-only renderers.

| Row | Normal | Semantic-only |
|---|---:|---:|
| Kick | 26 | 26 |
| Snare | 24 | 24 |
| Hat | 94 | 94 |
| Bass | 73 | 73 |
| Melody | 23 | 23 |

All 240 event IDs and target timestamps match both the previous baseline and
the semantic-only stream. There are zero type/row mismatches. Pairwise ±50 ms
coincidence remains identical to the baseline; it is descriptive, not an
accuracy measure.

On explicit cache miss with unavailable local analysis, both renderers have
zero semantic events. Normal mode records **120 global decorative commits and
120 animation starts**, all without instrument coordinates. Semantic-only
records zero decoration. Decorative five-row fan-out falls from **95 origin
groups to zero**. No trace overflow or page errors occurred.

An additional ordinary playback check used the actual `/beat-grid` route,
`FloatingFocus`, `useBrowserMusic`, automatic Companion discovery and the
unintercepted application gateway. A separate tab played the supplied WAV.
During 30 seconds, all 30 UI samples had zero semantic-looking fallback hits;
120 global commits and 119 animation starts were recorded. All five semantic
counters stayed zero, with no page errors. The final animation can fall beyond
the bounded wall-time recording window.

This ordinary check used existing **local demo authentication** and unavailable
browser tab capture. It verifies the normal application render/fallback path;
it does not certify production authentication/cache availability, the user's
installed native app, provider capture or detector accuracy. The cached A/B
check used the same private API fixture as the original investigation.

Private artifacts preserve the old traces and export semantic/decorative times,
origins, counts, presentation states and fan-out:
[row export](../../src-tauri/target/semantic-row-check/render-repair/row-timestamps.json),
[cache trace](../../src-tauri/target/semantic-row-check/render-repair/cache-trace.json),
[degraded trace](../../src-tauri/target/semantic-row-check/render-repair/degraded-trace.json),
[ordinary trace](../../src-tauri/target/semantic-row-check/render-repair/ordinary-trace.json),
[ordinary screenshot](../../src-tauri/target/semantic-row-check/render-repair/ordinary-live.png).

## Verification and stop

The failure was first reproduced by a regression assertion: a tempo-only tick
entered semantic styling on 13 cells. After repair, 40 focused tests and the full
96-file / **712-test** Vitest suite pass. TypeScript, scoped lint and production
build pass. Whole-tree lint has zero errors and 23 existing warnings; existing
Vite extensionless-import and chunk-size warnings remain.

Scoped review found no model/scheduler/merger changes, semantic identity loss,
unbounded recorder growth or decorative reuse of semantic CSS. Shape and
semantic coexistence, simultaneous typed cache attacks, pause cleanup and
diagnostic mode isolation are covered by tests.

All **21 existing Edge UI regressions pass**. The owned browser contexts and
development/test servers were closed; ports 5173 and 1420 have no remaining
listener. Scoped whitespace validation also passes.
No commit, publication or database change was made. Stop after this repair;
Melody listening and Phase 5 remain paused.

## User browser preview

At the user's request, a new local preview was started on October 8 for their
existing Edge music session. Open `http://127.0.0.1:5173/beat-grid?musicDebug=1`
and sign in normally. The page returned HTTP 200 and its served renderer contains
the repaired decorative border path. Companion 0.3.14 already permits this
localhost origin. The hosted website was not changed.

The server is intentionally left running for this manual check: command
`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort`,
process-only `VITE_AUTH_MODE=supabase`, PID 3132, tool session 95540, project root
checkout. Stop this owned server after the user finishes testing. Direct Edge
inspection remains unavailable because browser-client import fails with an
EPERM file-access error; no alternate control of the user's browser was used.
