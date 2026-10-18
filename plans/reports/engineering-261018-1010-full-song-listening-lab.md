# Full-song private listening lab upgrade

The full-song workflow is implemented at
[127.0.0.1:5173/lab/](http://127.0.0.1:5173/lab/). It plays one complete local
recording with highlighted A/C controls and optional B, preserving the audio
clock while changing predictions. Quick feedback is separate qualitative
evidence; detailed blind annotation remains available. No winning detector,
accuracy improvement or live-streaming qualification is claimed.

Branch: `codex/beat-grid-quality-recovery`; starting revision
`fd2714b0b41abfd1dc3ca38efea0649d3beeec06`. Final revision, changed files, source
hashes, logs, source readiness and check receipts are bound in the post-commit
[delivery receipt](../../scratch/acoustic-visual-lab/full-song-delivery.json).
The [operator guide and Vietnamese instructions](../../docs/private-acoustic-visual-lab.md)
cover startup, file selection, preparation, listening and export.

## Confirmed input identities

The user explicitly confirmed both exact Downloads filenames and authorized
local analysis after the generated full-length workflow passed. HSKT remains the
user-supplied label. No title expansion, download or guessed assignment occurred.

| Slot | Confirmed local file | Original SHA-256 |
| --- | --- | --- |
| Rằng Em Mãi Ở Bên | Rằng em mãi ở bên (prod. Renard 狐 x Yunee).mp3 | `edb26dbb975d54ac8fba7f649363772588a1c8ebd1a2d2da5a4a6332332b673a` |
| HSKT | Lee Hi - H.S.K.T. (Feat. Wonstein) [Audio].mp3 | `810d0f7d8575bc628c9b4c30383a49ecb547b78bdf73e2a3b805deaabd9e9103` |

Actual final preparation/readiness and measured duration are recorded in the
delivery receipt. Original bytes, decoded PCM, canonical WAV/PCM, sample rate,
channels, frame count, transforms and analysis revision are retained in each
private source record. Original files were read using literal paths; a
PowerShell wildcard interpretation of `[Audio]` initially prevented that upload,
then a literal-byte upload succeeded with the confirmed HSKT hash. No unrelated
audio was assigned to its slot.

Both requested songs completed A/C/B preparation and native browser playback
checks: Rằng is 186.1079365 seconds; HSKT is 204.5213605 seconds. These checks
establish operational playback/readiness, not human-perceived acoustic quality.

## Implementation and evidence boundaries

The existing frozen ADTOF BASE, C1 frame CNN and corrected C2-separated OAF plus
HTDemucs are reused without changed weights, learned thresholds or frontend
settings. A/C are primary; B remains a secondary control. The prior replacement
NO-GO is unchanged. The 65-input benchmark is not rerun.

Preparation decodes the full file, records native/decoded identities, resamples
to canonical 44.1 kHz stereo where necessary, and shares that exact timeline
across models and playback. Source time zero is the first sample returned by
the pinned decoder; codec delay/padding is decoder-managed, with no guessed
additional correction or fitted model shifts. Mono duplication/resampling are
recorded. There is no independent detector chunking: C1 retains full-recording
global normalization, and OAF retains its whole-input bidirectional context.
ADTOF uses its existing overlapping frontend and extraction. HTDemucs uses its
official split/overlap, fixed settings and PCM-derived seed, with sample-length
parity and complete separation cost in C preparation. Unavailable context or
resource failure becomes BLOCKED, never substitute output.

Raw-frame coverage revealed the unchanged ADTOF EOF limitation: Rằng has no
frames for 185.950–186.1079365 seconds; HSKT has none for
204.400–204.5213605 seconds. The generated fixture has a 179.850–180.000-second
tail. C1 and OAF have complete raw-frame coverage in these inputs. These are
explicit unavailable intervals, not verified instrument misses. The UI labels
them, and strict model metrics are unavailable for any reviewed window crossing
one. No detector padding, threshold adjustment or artificial event fills them.

One background worker runs at CPU4, with 6 GiB resident/tree and one-hour limits.
Input bounds are 256 MiB, 1–720 seconds and mono/stereo. Queue reservation occurs
before asynchronous startup, avoiding duplicate workers and making cancellation
reach a starting job. Process ID, command and workspace are recorded. Worker
termination remains enforced even if its status write fails. Windows atomic
status replacement uses bounded retries; the initial denial was reproduced and
fixed, not treated as a model error.

Versioned model/raw results are stored under original source SHA and numerical
contract key. Keys include PCM, model/weight/pipeline identities, decoder
versions and automatically hashed numerical code, separated from status helpers.
Each result retains its producing worker hash. Exact successful lanes are reused;
changed source/model/numerical contracts invalidate reuse. Corrupt lane or
separator evidence becomes a recoverable cache miss, with separator contract,
seed, frame count and content checked. Old cache versions remain retained.

The native streaming audio element owns playback; model/renderer switches never
call play/load/seek or change speed. Canonical media and waveform are bound to
original SHA, analysis revision and both canonical identities, with async source
guards. Seeking and looping preserve source-relative events at boundaries.
Waveform navigation uses at most 2,048 overview bins and 10 ms detail envelopes;
lanes render at most 160 markers per class, while saved events remain complete.
Kick, Snare, Hat, Cymbal and grouped percussion stay distinct. OAF's
HH/Tambourine/Maracas class is never relabeled verified true Hat. The four-row
semantic grid remains intact.

Quick flags record actual current time, exact song/model/renderer, note,
provenance, ID/version and nearby predictions. They persist in a source-bound
feedback store, apart from blind references. Export contains no official metrics.
Flagging lets playback continue; later review pauses at adjustable ±2 seconds.
Feedback-linked detailed reviews are forced model-exposed/provisional on the
server, including reloads after query removal. They cannot become a frozen
blind reference. Ambiguous impressions and user-perceived attacks remain human
observations, not model correctness labels.

Original/short renderers receive identical saved event identities, classes and
times. Bounded renderer exports separately show deliveries, first-frame IDs,
shared-row computed-brightness attack proxies and late callbacks. These are not
subjective flash counts or physical timing measurements. Reduced motion remains
honored. The full-song mode does not alter the production scheduler/controller,
filters, detector choice, Companion permission defaults or qualification gates.

## Verification and handoff

An authorized generated 180-second Snare/Hat recording was fully prepared using
the real models before requesting either user recording. The existing model
contracts and source-time mapping passed, with no external detector chunk joins.
The browser verified complete duration, unchanged native playback through A/C/B
switches, whole-track seeks, configurable jumps, selection loops, qualitative
feedback persistence/export, focused review, immutable exposed provenance,
bounded marker rendering and raw evidence windows. Exact retry reused all three
successful model results without neural inference. The final
[full-song verification receipt](../../scratch/acoustic-visual-lab/full-song-verification.json)
binds the observed results; final regression logs are in the delivery receipt.

Final regression checks passed: 912 application tests in 116 files, 39 Node
contract tests and 6 Python tests. Application/private typechecks, build and
bundle budget passed (main entry 718.8 KiB against 976.6 KiB). Lint reported
zero errors and 27 existing warnings. The excerpt renderer, annotation API and
actual generated-source Companion regressions also passed. An actual active
preparation was cancelled without losing successful caches; deliberate corruption
of the generated fixture's canonical WAV blocked clip/audio delivery, and restoring
the exact file reused all model outputs. Neither user's recording was corrupted.

Independent review identified and verified corrections for exposed-review
provenance, stale canonical playback, corrupted caches, worker resource
enforcement and numerical-source identity. The user’s two songs are not acoustic
ground truth and are not scored. The final follow-up review could not run because
the reviewer reached its usage limit; primary self-review and focused automated
source/cache/coverage checks verified the last fixes. No audio, model checkpoint, private feedback or
dataset is committed or redistributed. No deployment, model search or training
occurred. One tracked server remains on 5173/5174 for listening.

The next step is listening: play a complete song, switch A/C while hearing the
same passage, flag misses/false hits/timing or visual merging, and export notes.
Detailed onset annotation is optional for passages requiring independent
verification. Unresolved questions: which model gives the better perceived
Snare/Hat experience, and which flagged passages warrant complete acoustic
reference review. This implementation does not answer those subjective questions.
