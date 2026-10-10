# Bounded Lead precision/recall review

Decision: **keep the frozen `lead-pulse-v1` baseline unchanged**. No candidate
policy was introduced. The confirmed misses and extras span extraction,
ownership and pitch-to-attack interpretation; one safe correction addressing
both is not established. This is not a musical-quality improvement claim.

## Confirmed listening failure and first affected stages

| Passage | Upstream evidence | Saved / rendered events | Classification |
| --- | --- | --- | --- |
| Gymnopédie 0–3 s | Only two retained piano proposals: 1.875 and 2.635 s. The first is rejected because 0–2 s ownership abstains. Piano pitch coverage is 0.058 despite energy share 0.949; the existing `support > 0.1` eligibility rule gives score zero. There are no retained piano proposals around 0.360 or 1.138 s. | 1 / 1 | Missing candidates plus source eligibility; not a delivery loss. |
| Gymnopédie 10–13 s | Piano has no retained pitch proposals across 10–14 s. Ownership selects `other`, which provides segmented contours at 10.022, 10.466, 10.971, 11.166, 11.781, 12.188, 12.498 and 12.684 s. | 8 / 8 | Alternative-source selection and interpreting contour boundaries as attacks; the user hears approximately 3–4 meaningful attacks. |

The latter human estimate is qualitative, not measured precision/recall. Without
attack annotations, which individual events are wrong remains unresolved.
`other` can contain real piano leakage: its label does not establish accompaniment
or separation artifacts. Polyphonic/resonant pitch segments need not represent
new attacks. Model confidence is uncalibrated evidence, not a probability.

## Broader evidence and limits

Re-extraction from the existing aligned stems reproduces all 12 saved v1 event
sets and ownership sections exactly. Across them: 2,194 proposals, 607 emitted,
1,163 rejected by ownership and 424 by spacing. These are processing counts,
**not** false-positive/false-negative totals.

151 vocal articulation proposals follow an earlier retained pitch event within
140 ms. Examples: H.S.K.T. 0.640 after 0.618 s; rap 2.250 after 2.226 s. They
may describe the same attack; admitting them is not justified as recall recovery.
Adjacent same-pitch segments, including H.S.K.T. around 28.456/28.706 s, are
possible sustain fragmentation, not confirmed extra vocal attacks. There is no
human-marked vocal miss/extra passage in this pass establishing a safe correction.

Lowering source eligibility could admit the brief 1.875 s piano candidate but
cannot recover absent pitch contours. Suppressing contour boundaries could
remove extras but also meaningful retriggers, without recovering those misses.
Changing vocal spacing would address neither confirmed piano mechanism. No
threshold, ownership, filtering, model or rendering behavior was changed.

All twelve user-reviewed fixtures are exposed regression material, including
those historically labeled holdouts in the selector. No new holdouts were tuned
or inspected for a candidate. Baseline generalization and musical limitations
remain; no new accuracy or production-readiness claim is supported.

## Mechanical validation

Actual Playwright MCP used the existing original-audio Demo Grid, one media clock
and visible Play/Pause/Replay controls. No parallel grid or player was created.

| Fixture / passage position | Saved events | DOM commits | Animation starts |
| --- | ---: | ---: | ---: |
| Gymnopédie 0–3 s | 1 | 1 | 1 |
| Gymnopédie 10–13 s | 8 | 8 | 8 |
| H.S.K.T. 0–3 s | 7 | 7 | 7 |
| Guitar/vocal fixture 3–6 s | 8 | 8 | 8 |

All 24 commits were semantic Row 5 hits with matching saved timestamps and source
provenance. Animation start minus target playback time: median 21.4 ms, p95
35.7 ms in this small foreground run. Seeking, pausing and replay reset the
fixture run; replay before its first onset showed zero played events. These
measurements establish delivery, not whether each musical attack is correct.
Browser console retains live-service `/api/beat-events` 404s; saved fixture
delivery is independent of that service. No demo JavaScript exceptions observed.

20 focused JavaScript tests passed (saved cache clock, demo and shared Lead
events); 3 existing Python Lead tests and audit syntax validation passed. The
initial sandbox Vitest launch failed on a temporary-file `EPERM`; the authorized
retry ran all 20 successfully. No application changes required a fresh full build.

## Reproduction and preservation

Open `/beat-grid?musicDebug=1&view=app&musicDemo=lead&musicFixture=lead-gymnopedie`.
Keep General-Purpose Lead selected. Press Play for 0–3 s, then use Passage position
to seek to 10 s and listen through 13 s. Optional short cross-checks: Automatic
H.S.K.T. 0–3 s and Automatic guitar 3–6 s. Use Missed/Extra note markers if
confirming individual attacks; no twelve-song re-annotation is requested.

`scripts/audit-lead-pulse.py` runs with the existing Essentia environment. It
verifies actual audio/stem hashes, freezes source/manifest/all twelve outputs,
requires exact v1 replay, and exports candidate/filter evidence only to ignored
`src-tauri/target/lead-precision-recall/`. Source SHA-256:
`a9e78c0256fd54367a3377b115ae0f0274701db98f3c18fb15d9b101ad6de07b`.
Raw browser traces and frozen artifacts stay there; no generated traces are
added to tracked reports. Rows 1–4, production analysis, scheduler, merger and
renderer remain untouched. No deployment or further automatic experiment.
