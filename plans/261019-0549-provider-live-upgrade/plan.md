# Existing-provider Beat Grid live upgrade

Status: private investigation and UX corrections delivered; remaining qualification gates documented.
Branch: `codex/beat-grid-quality-recovery`; base `f378fef209793b0ee26cd98b354a5d9b21b0d8c0`.

## Accepted outcome and boundaries

Improve and measure the existing Companion → event engine → scheduler → Music/Focus
grid path without rebuilding providers, playback, discovery, extensions or scheduling.
Preserve Spotify transport, all seven provider host identities, source ownership,
permission/policy guards, independent Bass, offline H0 and saved Lead. Only measured
avoidable delay may be optimized. The existing online CNN diagnostic is reused;
no duplicate model benchmark, model search, threshold tuning, provider download,
protection bypass, delayed original audio/video, deployment or rights promotion.

## Work and acceptance

1. Audit every provider's existing discovery/control/identity/capture/fallback
   paths. Inspect current accessible installed browser state; distinguish source
   compatibility tests, historical live evidence and new real-provider checks.
2. Add bounded opt-in timing evidence for feature availability, worker dispatch,
   inference, postprocessing, transport, scheduling and presentation. Preserve exact
   learned decisions. Diagnose before selecting any optimization.
3. Run repeated controlled actual Companion trials with the existing authorized
   CC0 source, a complete source session, stress and source lifecycle checks.
   Compare local H0 as a different detector path, not a transport-only A/B.
4. Test accessible real YouTube/Music, Spotify, Apple Music and SoundCloud
   discovery/control and permissions; run Deezer/Tidal shared-path regressions.
   Unsupported account/rights/capture states must be explicit. Use actual Web
   Music/Floating Focus and native runtime where available; never infer parity.
5. Run focused then appropriate full regression/build/package checks, read-only
   review, update the smallest owning docs, and commit a report/inventory.

## Evidence reuse and remaining dependencies

Completed: frozen model/pipeline identity audit; optional numeric-only timing with
decision parity; three foreground trials, two-thread stress trial and strict
180-second source continuity check; measurement review with no remaining concerns.
Full-session qualification checks both pre-EOF capture health and lifecycle logs.
An initial harness failed querying an offscreen document after normal EOF cleanup;
that failure is preserved and the corrected full-session run passed continuity.

Current real-provider observations: Brave Spotify normal playback advances and
pauses, restored paused; Apple Music initially showed sign-in UI. YouTube/Music and SoundCloud
pages were accessible in Edge. Brave Kora still displayed “Add music controls”;
the user reloaded but reported Companion v14 and still no music. Source history
confirms 0.3.14 excludes the app's 1420 origin. The current private 0.3.24 package
was rebuilt and the user was given its exact folder for a manual update, because
internal extension pages are blocked by the browser tool. Provider-to-Kora checks
then succeeded for actual Apple Music/YouTube discovery. Kora Apple Music
pause/resume/clock passed; its protected-source policy correctly blocks analysis.
Misleading reconnect/calibration advice for blocked sources was corrected in
existing private controls. Authorized YouTube live preview passed in actual
Brave Kora: all four counters increase, colored grid cells are visible, zero
intentional delay. Video switching revoked source-bound preview as expected;
user re-enabling restored it. The grid now displays that status and reset guidance.
No protected provider audio was analyzed or downloaded.

Final verification: 936/936 full-suite tests, 61/61 focused player checks and
3/3 Node measurement tests pass. Typecheck, lint, ordinary build, 46-file package
validation and bundle limits pass with documented warnings. Read-only reviews
have no remaining concerns. Physical timing, acoustic accuracy, live CNN,
native per-stage timing and unrenewed account-dependent provider checks remain
explicitly unqualified; no public rollout was authorized.

Prior actual Web/native H0 and live A measurements are in
`scratch/hybrid-beta/`; prior report:
[Hybrid integration](../reports/engineering-261018-1525-hybrid-beta-melody.md).
Frozen A and B hashes, canonical numerics and H0 remain unchanged. The original
CNN's 104.49 ms minimum steady future context and running-reference drift are
already measured; a Python offline diagnostic is not sustainable browser live CNN.
Missing HTDemucs/MELODIA generating runtime is a separate follow-up dependency;
saved Lead playback remains supported and tested.

Private evidence: `scratch/provider-live-upgrade/`. Report:
[delivery](../reports/engineering-261019-0549-provider-live-upgrade.md).
Track owned process command/PID/port/worktree, reuse deterministic 1420, close
test contexts/workers, and retain only the user-facing listening server. Official
acoustic scores need independent verified labels; physical timing needs external
calibration. Neither gate is passed by software callbacks.
