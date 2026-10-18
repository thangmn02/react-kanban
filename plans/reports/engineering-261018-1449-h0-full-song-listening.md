# H0 full-song listening delivery

Branch: `codex/beat-grid-quality-recovery`. Base: `85b9fddcd22c296e7bbaee3c1fc40064be762fd8`.
The post-commit private receipt `scratch/h0-full-song-listening/delivery.json`
binds the final revision, changed files, checks, source identities and retained server.

## Delivered behavior

The root [Full-Song Lab](http://127.0.0.1:5173/lab/) exposes A/B/H as primary
choices and retains C for diagnosis. H visibly identifies Kick/Snare ← A and
Hat ← B and is marked PRIVATE RESEARCH — PRECOMPUTED HYBRID. Short Attack
is the initial full-song renderer; Original remains available. Detailed blind
annotation remains A/B/C with its existing reference restrictions.

The canonical `hypothetical_hybrid` function was not rewritten. A local JSON
entry point invokes that same implementation, preserving
`H0-frozen-routing-diagnostic-v1`. No detector, threshold, veto, debounce,
quantization, synthesized hit or timing shift was introduced. Original IDs,
timestamps, class fields, raw indices and record provenance remain intact;
component checkpoint/cache/result identities are added without replacing them.
Simultaneous different classes coexist, duplicate origin identities are removed,
and chronological ordering is preserved.

Frozen A checkpoint:
`c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a`.
Frozen B checkpoint:
`785c9b7a8640d78066598bc9da4bba54a2c67464a4b3ae125e322770e9d704db`.
Existing full-song numerical contract is unchanged. Every clip revalidates
original records before H cache lookup. Routing caches bind source/PCM/WAV,
algorithm SHA and both component contracts, and share concurrent work. On
restart only deterministic routing repeats; no neural inference is requested.
Missing A/B produces INCOMPLETE with no fallback; per-class raw coverage gaps
remain explicit.

Retained exact recordings are selectable without reupload or slot reassignment.
Normal user slots can still hold different recordings. Upload is disabled for
a retained selection; choose a normal slot to upload. Old feedback remains in
its original per-source files. H feedback adds component provenance and explicit
comparison pairs. H preference buttons/API require selected track H. Reviewing
a note restores its track and renderer; qualitative feedback remains separate
from blind acoustic references.

## Exact prepared recordings

All four have valid saved A/B/C, a READY H route, native playback and tested
A/B/H continuity. Counts below are predictions, not verified acoustic hits.

| Recording | Exact original SHA-256 | Duration s | H Kick / Snare / Hat |
| --- | --- | ---: | ---: |
| Rằng Em Mãi Ở Bên | `edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a` | 186.108 | 361 / 251 / 565 |
| Original HSKT | `810d0f7d8575bc628c9b4c30383a49ecb547b78bdf73e2a3b805deaabd9e9103` | 204.521 | 267 / 161 / 555 |
| Nujabes Luv(sic) feat. Shing02 | `349b0b80a4e8f7f206d3fed48ccb6bc938b179a171bbff9ecaf9ec6171145f9f` | 280.242 | 245 / 296 / 871 |
| Chinese recording, secondary [200,220) | `2693f11c0f6f605a25574e3a73032ef709ae6d64c0d8b7461fcff1a397c2e7bd` | 292.130 | 585 / 132 / 323 |

Rằng [26,44) retains B's original 21 Hat plus A's 8 Snare in H: 29 events.
A's separate 8 Hat and 2 Cymbal do not enter H. The reported Hat-negative
interval remains provisional and visible. The Chinese pattern description
was illustrative, not a verified transcription. A's EOF gaps (including Rằng
[185.950,186.108), HSKT [204.400,204.521), Nujabes [280.100,280.242)) remain
unavailable for Kick/Snare; B Hat coverage is independent.

## Verification and evidence

The final [browser/API receipt](../../scratch/h0-full-song-listening/verification.json)
records exact event-field equality, provenance, chronology, uniqueness, source
isolation and cache reuse for all four real recordings. Each recording was
played and switched A/B/H repeatedly, with both renderers: the same native
source/duration/rate and play/load/seek counters persisted. Seek/loop and H
feedback persistence/review were exercised. Unit tests additionally cover
simultaneous classes, duplicate origin IDs, missing components, wrong checkpoint,
source/PCM mismatch and cache changes after source/record changes.

Actual H playback over Rằng [26,44) delivered all 29 exact input IDs/classes/times
through both renderers, with 29/29 frame-observed IDs for each. The final verifier
scrolls the grid into view after Play; frame proxies do not certify perceptual
separation or physical synchronization. A complete generated 180-second source
played at 1× with 29 A/B/H changes over 181.188 wall seconds, retaining
play/load/seek counters and reaching EOF normally. This tests interface endurance,
not natural-song accuracy. Final catalog bytes were identical before/after the
test; the test issued no upload or preparation request. Canonical H0 function
AST and full-song numerical module SHA were also checked unchanged.

The [in-app screenshot](../../scratch/h0-full-song-listening/h0-in-app.png)
shows Nujabes selected as H with Short Attack and explicit routing. Actual narrow
viewport 553 px fits after bounding the retained-recording selector. The tab is
left paused, ready for human listening. The private renderer envelopes remain
unchanged; appended CSS only constrains form widths.

Checks:

- Application: 912 tests / 116 files passed.
- Relevant Node contracts: 24 passed, including 3 new real Python-bridge tests.
- Python: 6 frozen Hat core, 6 full-song cache, 5 scoring tests passed.
- App/private TypeScript passed. Lint: 0 errors, 27 existing warnings.
- Production build passed; main bundle 718.8 KiB / 976.6 KiB budget.
- Existing full-song, excerpt UI, annotation API and actual generated-source
  Companion capture regressions passed. Targeted investigation smoke passed.
- Both normal Companion ZIPs: 46 entries, valid CRC, all bytes match existing
  extension sources, identical archive SHA
  `885626efad35a4e72e5b4cfb765c4852e4f6b95eab142596ca11b40436d2f8ac`.
  No private H0 research, new weights or music was added. Production private
  candidate flag remains false.
- Reviewer finding about preference-note provenance fixed; follow-up review
  reports no actionable concerns.

Logs and machine receipts are under `scratch/h0-full-song-listening/`.
Existing receipts/screenshots were copied before regression runs and restored
afterward; new results have separate task-local copies. One initial browser
assertion queried feedback before its asynchronous save completed; the verifier
now waits for the saved row. One existing regression exceeded its short retry
wait while the preparation queue was busy; the idle-queue rerun passed. Both
attempts are retained, rather than concealed or weakening functional assertions.
No threshold sweep, new model search, training or requested neural inference ran.

## Files changed

- `scripts/full-song-hybrid.mjs`: validated, cached bridge to existing H0.
- `scripts/hat-recovery-core.py`: JSON CLI only; canonical routing unchanged.
- `scripts/full-song-store.mjs`: H clip/provenance, retained catalog, H feedback.
- `scripts/full-song-core.ts`: private listening-track type and feedback choices.
- `scripts/full-song-lab.tsx`: H controls/routing, retained selector, note review.
- `scripts/acoustic-visual-lab.css`: narrow full-song form containment.
- `scripts/full-song-hybrid.test.mjs`: bridge/routing/cache/missing-data tests.
- `scripts/verify-full-song-hybrid.mjs`: real-cache and browser endurance checks.
- `docs/private-acoustic-visual-lab.md`: operational H0 guide.
- This report and `plans/261018-1449-h0-full-song-listening/plan.md`.

## Operation and remaining gates

Run `node scripts/serve-acoustic-visual-lab.mjs` from the repository, only if the
owned listener is stopped. Current process/ports are recorded in the delivery
receipt and `scratch/acoustic-visual-lab/server-process.json`; ports are 5173/5174.
Preparation worker is idle at delivery. No private audio, notes or weights are
committed. No deployment is performed.

Hướng dẫn ngắn: mở `/lab/`, chọn bản thu trong **Retained exact recordings**,
bấm **H · Hybrid ADTOF + CNN**, giữ **Short Attack**, bấm **Play full song**.
Đổi A/B/H trong lúc nghe; dùng Seek/Loop và ghi chú nhanh ở phần 4. Chọn Original
để so sánh hình ảnh. HSKT gốc là mục có SHA bắt đầu `810d0f7d8575`.

Human full-song acceptance is pending. Independent complete and accurately timed
references are still required for acoustic evaluation. Centered CNN context,
whole-recording global dB reference, causal/online normalization equivalence,
live Companion synchronization and physical speaker-to-pixel timing remain open.
AGPL-3.0 integration and weight-distribution questions remain unresolved.

Required delivery states: H0 FULL-SONG LAB PASS;
A/B/H PLAYBACK SWITCHING PASS; EVENT PROVENANCE PASS; FULL-SONG USER LISTENING
PENDING USER REVIEW; ACOUSTIC ACCURACY UNVERIFIED; LIVE COMPANION NOT QUALIFIED;
PRODUCTION DEPLOYMENT NOT AUTHORIZED. Stop here for user evaluation; do not
advance another correction experiment.
