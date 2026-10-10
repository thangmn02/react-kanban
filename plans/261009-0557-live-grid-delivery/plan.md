# Live Beat Grid delivery diagnosis

Status: closed for the accepted mechanical animation repair on 2026-10-09. No further animation tuning is authorized for this task. The next priority is the shared general-purpose Row 5 Lead pipeline for Web/Desktop; it is not started here.

Outcome: identify missing live Clap events, tab-switch lag and absent Lead output without tuning models or changing accepted row semantics.

Scope: compare the user's preserved ADTOF test bundle with the exact local song; trace raw learned events through transport and rendering. Preserve model weights, thresholds, Bass, Lead policy and cached baselines. Repair only demonstrated delivery/lifecycle bugs. No release, database or Modal changes.

- [x] Confirm the active bundle is `src-tauri/target/percussion-latency/candidate` (original ADTOF, 5-frame cadence and 10-frame right context).
- [x] Reproduce the real song with the exact bundle: 47 raw Snare events and 47 semantic DOM commits in the 60–90-second excerpt. The user's live counter still stays at 0–1, so its failure stage remains unresolved.
- [x] Check controlled tab switching and Lead flag/cache behavior. Headless switching did not produce hidden-document state; actual background throttling is not certified.
- [x] Restore normal debug counters/record/export, include delivery telemetry and visibility timestamps, and explain missing Lead output. No detector or playback behavior was changed without evidence.
- [x] Run 92 focused tests, all 788 existing tests, type checking and scoped lint. Preserve the original ADTOF model and Lead policy hashes.
- [x] Report listening instructions and remaining limitations.
- [x] Obtain the live row/transport evidence and repair the demonstrated independent-row animation cancellation. Mechanically validated and accepted; the older upstream missing-Snare observation was not reproduced and is not fixed.

Update: the connected Playwright Companion produced 33 Snare receives/accepts/DOM commits over 60–90 seconds. A separate normal-renderer bug was demonstrated and repaired: other row updates prematurely removed percussion animations. Final verification passed 790 tests, type checking, scoped lint and build. See [repair evidence and limits](../reports/repair-261009-0856-independent-percussion-flashes.md). The older upstream 0–1 Snare session and actual hidden-tab throttling remain unverified; do not mark those solved.

Separate open issues, outside this completed repair:

| Issue | Recorded status |
|---|---|
| Learned percussion timing delay | Open: approximately 227–246 ms median target-to-first-animation delay; no model, threshold, scheduler or duration change authorized here. |
| Analysis-service availability | Open: analysis requests returned HTTP 503; cache GET 404 misses are distinct. No service/configuration repair was made. |
| Older upstream missing-Snare observation | Not reproduced, not fixed. Preserve the user's 0–1 counter observation separately from the accepted rendering fix. |
| Hidden-tab return lag | Unverified: MCP tab switching did not establish actual hidden-document throttling. |

The port-5173 Vite server remains PID 1924 in this checkout. Reuse it. Private browser probes own isolated profiles and must close them on completion.

Evidence: [live delivery report](../reports/diagnostic-261009-0557-live-grid-delivery.md).
