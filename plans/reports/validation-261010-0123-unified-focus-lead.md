# Unified Focus and Lead feasibility

Local navigation/window integration: **PASS**. Uncached provider Lead delivery:
**BLOCKED**. No deployment, database change, model tuning or new capture session.
This implements the user's later single-Focus decision, superseding the previous
three-entry restoration. The frozen Lead policy and audio/visual event contracts
are unchanged.

## Delivered behavior

- Desktop/mobile navigation retains Focus and removes only primary Music/Beat
  Grid buttons. Their internal dock tabs remain available.
- Explicit Focus opens the original dock in-page, including with no pinned tasks.
  Unrelated Home actions do not open a window or an empty compact island.
- One stable Web portal host moves to the existing Document PiP window and back.
  Timer DOM identity, selected tab and music subscriptions survive the handoff.
  There is no parallel in-page dock, player or grid while PiP owns the host.
- Minimize/restore retains the host. Shutdown opens the existing ritual dialog;
  Start/Pause/Reset, task selection and session ownership remain existing code.
- PiP uses its own document visibility for Beat demand; a hidden opener must not
  suppress the visible popup. Minimized in-page Beat demand is suspended.
- Tauri reuses the existing single-window workspace/compact-dock switch and shared
  controller. Its views mount sequentially; it does not create Chrome PiP.
- All five rows and forty cells remain present even without music. Lead readiness
  is truthful; missing analysis does not produce fake Lead flashes.

| Entry | Result |
| --- | --- |
| `/focus` | Existing dock, Tasks selected |
| `/focus?tab=music` / `?tab=beat` | Requested internal view, refresh preserves it |
| `/music` / `/beat-grid` | Redirect to corresponding Focus tab; other query/hash preserved |
| Development `musicDebug=1` links | Existing private route and tools retained |
| Unauthenticated protected entry | Existing sign-in/return destination behavior retained |
| Unsupported Document PiP | In-page dock remains; pop-out disabled |

Owning changes: `AppNavigation`, `FeatureRoute`, `FloatingFocus`,
`useAppFocusIntegration`, `useDocumentPictureInPictureWidget`, and AppLayout's
route-context/overlay wiring. Tests cover navigation, route compatibility,
empty-page ownership, PiP/reopen/visibility and the always-visible idle grid.
No detector, scheduler, merger, renderer pattern, animation duration or native
audio-processing source was edited in this task.

## Validation

- Full JavaScript: **116 files / 846 tests pass** (26.91 s).
- Chromium regression E2E: **22 pass** (28.2 s). Auth E2E: **14 pass** (42.5 s),
  with the existing test-owned auth API and servers; not live Supabase evidence.
- Typecheck and production build pass. ESLint: zero errors, 25 warning-level
  diagnostics. Main entry 697.2 KiB, within 976.6 KiB budget; 31 JS chunks.
- Initial E2E expected an automatically visible empty Home island. That obsolete
  assertion was updated to the requested explicit Focus workflow; the complete
  final suite passed. Initial sandbox runs failed before tests/build could run
  on temporary-file permissions; approved unsandboxed reruns passed.
- Playwright MCP on the actual signed-in `127.0.0.1:5173` app verified all three
  tabs, five rows/forty cells, compatible deep links, query persistence,
  minimize/restore, close/reopen and the original shutdown-dialog opening.
- Real Document PiP: one dock in popup, zero in opener; closing/returning restores
  one dock. Timer DOM identity and tab survive. No automatic PiP after refresh.
- UI had no runtime console exceptions. One existing theme-injection warning;
  the deliberate unavailable-gateway probe also records its expected HTTP 503.
- Native surface contract tests pass (9). No running Kora native GUI was available;
  native window/audio execution is **NOT VERIFIED**. No new native installer built.
- No current active Companion capture/music source during final checks. Live
  percussion, source switching and newly analyzed Lead rendering were not claimed
  from idle UI or mocked E2E.

Screenshot and raw logs remain ignored under `src-tauri/target/`; final screenshot
is `focus-unified-final.png`. No generated multi-thousand-line trace added to
tracked reports. Existing unrelated working-tree changes were preserved.

The task-owned Vite server (`npx vite --host 127.0.0.1 --port 5173 --strictPort`,
PID 4648, this repository, exec session 95618) was stopped with Ctrl+C after
validation. Test-owned servers also exited. To review locally, run
`pnpm dev --host 127.0.0.1 --port 5173 --strictPort` and open `/focus?view=app`.

## Authorized input and latency evidence

Revalidated the existing generated-audio Companion capture files, not a private
fixture substituted for YouTube. The saved proof used the extension's existing
offscreen stream after human capture invocation. No second stream, provider
download, upload or inference rerun was introduced.

| Measurement | Evidence |
| --- | --- |
| PCM | 35 s, mono 44.1 kHz, 1,543,500 samples / 3,087,000 bytes |
| Integrity | 95.506% nonzero; RMS 0.005584, peak 0.026703 full scale |
| Capture callback | Median/p95 0.10 ms; total 22.1 ms |
| Raw/base64 size | 88,200 / approximately 117,600 bytes per second |
| Clock alignment | Clock-constrained waveform offset 30.455–30.510 s; 54.3 ms spread |
| Frozen local worker | 30 s input, 66.97 s wall, 108.91 s Windows CPU, 1116.8 MiB peak |
| Local export | 39 `lead-pulse-v1` events, first 4.748 s / last 29.486 s; 16,290-byte chunk |
| Earliest batch availability | At least 96.97 s from capture start, excluding remote overhead |

Remote transmission, cloud startup and publication latency are **not measured**.
One waveform match is ambiguous (cosine 0.419). Unconstrained correlation matched
a repeated phrase to the wrong offset; the clock-constrained result is the useful
evidence, not a production clock-normalization guarantee.
All events in this first captured segment are already in the past by completion.
Re-timestamping them to now would create misleading delayed Lead flashes.

## Exact remaining gates and smallest next step

1. Real versioned YouTube request returns **503 `{"status":"unavailable"}`**
   before cache/job execution. The Lead gateway is disabled/unconfigured; this
   is not proof of a failed worker or an authorized cache miss.
2. Existing gateway needs configured private cache/auth and analysis-service
   endpoints/secret (`BEAT_EVENT_CACHE_ORIGIN` or Supabase backend,
   `BEAT_ANALYSIS_URL` / `BEAT_ANALYSIS_KEY`). Server Lead flags and input/rights
   gates must only be enabled after clearance; credentials remain server-side.
3. Companion spectrum/percussion transport does not yet deliver authenticated,
   bounded raw PCM to this gateway with validated asset/range/clock identity.
   Saved generated-audio capture establishes feasibility, not provider permission.
4. Optional Modal Lead image is prepared but unbuilt/undeployed/unvalidated.
   Real admission, worker execution, sparse publication, cache-hit replay and
   normal-grid Lead animations remain unverified end to end.
5. Audio/provider authorization and model/dependency rights remain unresolved.
   Public processing stays disabled. Existing musical misses/extra attacks remain
   the accepted beta limitation; this task does not retune them.

Smallest controlled-beta step after those gates: authenticated, authorized
bounded capture -> existing frozen worker -> private sparse cache -> subsequent
replay through the shared EventTrack clock. First-listen Rows 1–4 continue with
accurate pending/unavailable Lead status. Preanalysis/cached replay is the bounded
alternative to the measured first-listen latency, not a new live detector.

The task stops here. Normal uncached YouTube Lead functionality is not complete.
