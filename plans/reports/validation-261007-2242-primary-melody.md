# Primary Melody continuation: exit gate failed

Date: 2026-10-07. Phase 4 remains incomplete. The user listened to the candidate
comparison and reported that all tracks still sounded wrong. No completion
commit, hosted schema change, updated Modal/draft deployment, production release
or Phase 5 work was performed in this continuation. Existing unfinished work is
preserved in the working tree.

## Candidate implementation

[PrimaryMelodyTracker](../../server/primary-melody-tracker.ts) consumes existing
Basic Pitch note candidates from vocals, piano, guitar and other. It excludes
drums/bass stems and publishes one measured monophonic stream with section
ownership. It measures contour, note confidence, phrase gaps, sustained activity,
polyphony/chord evidence and relative salience. Energy alone cannot select vocals;
a small vocal prior requires pitched coherence. Half-second decisions use
three seconds of evidence and configurable challenger stability/margin.

Ownership can switch by section; silence/weak evidence can remain dark.
Retrigger merging and monophonic clipping precede normalized `type=melody`
events. The new tracker avoids a whole-range pitch quantile that would remove
lower notes from a valid phrase. Legacy imports and the frozen instrumental A/B
baseline retain their previous register filter. Ranking is compared before
confidence clipping so a strong incumbent cannot permanently prevent handoff.
These are candidate behaviors, not globally accepted production parameters.

The range exporter and offline importer accept tracked output without filtering
its pitch register again. Analysis version changes to
`server-primary-melody-range-v1` for sparse output. Rows 1–4, semantic provenance,
the five-by-eight grid, intentional decoration, telemetry, scheduler, recovery
and priority merger remain intact. Heavy models remain server-only. MelodyBus
remains experimental/default-off and is not called by the range exporter.

## Representative listening and Redbone evidence

The private comparison reuses the existing ten separated 30-second excerpts,
measures the additional vocal candidates with the existing Basic Pitch model,
and compares original, previous lead clicks and candidate primary-voice clicks.
There are no title/artist mappings or song-specific parameters.

| Excerpt / archetype | Candidate attacks | Source switches | Events/minute |
| --- | ---: | ---: | ---: |
| Nujabes / layered hip-hop excerpt | 23 | 5 | 46 |
| Hysteria / guitar-rock | 37 | 3 | 74 |
| Yellow / vocal pop-rock | 20 | 0 | 40 |
| Redbone / layered vocal music | 22 | 2 | 44 |
| Take Five / instrumental ensemble | 30 | 3 | 60 |
| Levels / synth-EDM | 27 | 2 | 54 |
| Gymnopédie / sparse piano regression | 15 | 7 | 30 |
| H.S.K.T. / dense vocal regression | 36 | 4 | 72 |
| Vietnamese remix / layered vocal-EDM | 49 | 0 | 98 |
| Ambient excerpt / sustained layers | 16 | 2 | 32 |

These counts describe output only. They do not establish accuracy, recall or
acceptable generalization. The user's aggregate listening judgment was negative
for all candidates. Sparse piano switching seven times in 30 seconds is a
concrete warning that separation leakage can outrank the primary voice.

In the saved Redbone candidate, vocal ownership ends near 11 seconds. Guitar
ownership then publishes MIDI pitches 33 and 29 at 11.686 and 12.349 seconds,
followed by several seconds with no selected source. Excluding the bass stem
does not exclude low accompaniment or bass leakage in another candidate.
The user's 14.14-second reference recording shows a coherent chorus melody on
the piano roll, including a repeating G/F/D phrase. This supports the intended
voice/phrase behavior; it is not a universal ground-truth export.

The supplied video is a musical reference, not a Kora scheduling trace. Its
absolute song position/transposition are not established against the saved
excerpt. A waveform overlap check reached only 0.259 absolute correlation, so
no precise latency or per-note accuracy claim is made from that alignment.
The selected low-register interruption is an analysis/source-selection problem;
changing visual delay cannot repair those wrong semantic events.

Latest reused-candidate normalization/comparison runtime is 0.140–0.172 seconds
per excerpt, including local artifact generation. It excludes separation, vocal
inference, model startup and Modal execution. New cloud runtime is unmeasured.
Earlier inference/runtime reports must not be presented as current acceptance.

## Bounded playback input candidate

The candidate native Windows route taps the existing accepted browser-process
PCM feed while Beat Grid demand is active. It accumulates 30-second aligned
cores, configurable to 60 seconds, and at most five seconds of historical
context. It emits mono 16 kHz PCM WAV bounded at 2,080,044 bytes. Partial data is
discarded on pause, seeking, source/clock interruption and unsupported rates;
initial upload supports rate 1. Beat Grid off creates no capture subscriber,
audio upload or analysis job. Web-only input remains unsupported by this route.

[The protected upload handler](../../server/playback-audio-input.ts) authenticates
through the existing gateway, checks asset/duration/live demand, validates WAV
format and byte bounds, and rechecks admission atomically after reading the
body. Preparing capture registers demand without analyzing unplayed future
audio. Existing chunk ownership deduplicates cache hits and concurrent claims.
Each admitted job has independent private raw input and a job-owned manifest,
including split ranges; no upload can overwrite another worker's input.
Failed storage admission releases pending ownership for recovery.

The worker reads only the registered private object, trims historical context,
and deletes input on completion/failure. A candidate hourly scale-to-zero sweep
removes orphan objects older than one hour. No provider cookies, DRM bypass,
arbitrary URLs, full-track downloads or permanent raw-audio retention were added.
The prepared private-bucket/admission migration is **unapplied**.

First-pass captured input is historical. Server results cannot predict future
notes without delaying playback. Local fallback continues; completed historical
coverage serves replay/subsequent playback. Stale attacks are never flashed as
current. Browser-process capture can include another tab/call; source selection
cannot isolate that audio. Consent/privacy/terms must be reviewed before release.

The user left Edge/Kora playing and supplied a real YouTube asset URL. The local
Companion bridge had established connections. The supported browser runtime
failed twice with `EPERM` resolving its installed module, so no live media-clock
or capture/Modal/ordinary-Line-5 validation is claimed. No browser-policy bypass,
synthetic identity, injected clock or fixture substitute was used to pass this gate.

## Verification and operational state

- Full Vitest: 95 files, 697 tests passed, including Companion diagnostics,
  recovery, timing, transport and application/server tests.
- Python analyzer suite: 24 tests passed, including private-input expiry,
  job ownership, cleanup and unavailable/expired input behavior.
- Focused Companion rerun: 18 files, 134 tests passed. Native Rust suite:
  14 tests passed, including process ownership, bridge validation and timing.
- TypeScript build/type checking passed. Production web build passed.
- ESLint completed with zero errors and 23 existing warnings.
- Isolated Edge E2E initially passed 20/21. The remaining expectation still
  required `/home` after authenticated auth entry; the accepted public-root
  routing now returns `/`. Updating that expectation passed its focused rerun.
- The frozen comparison additionally verifies vocal candidates cannot alter the
  old instrumental A baseline. Focused comparison/cache tests passed.
- A mistaken Node test-runner invocation could not run Vitest-based Companion
  tests; the actual full Vitest run above is the valid result.
- Restore-verified encrypted Supabase backup was prepared at
  `C:/Users/thang/KoraBackups/2026-10-07-221924-lthlvntvjgnornrdxnms` (55 tables).
  No new hosted schema/data mutation followed it.

Inline review tightened ended-demand admission, per-job file ownership,
independent split-job cleanup, request-body abort handling, expiry pagination
and comparison compatibility. Unit success does not close the failed listening
gate. Candidate code and private diagnostics remain reviewable without shipping.
The optional local journal CLI save failed with `Command failed`; no journal
success is claimed. This report and the execution plan retain the session record.

## Unresolved exit gates

1. Primary-voice selection and attack continuity fail representative listening.
   Redbone low-register leakage and sparse-piano source instability are concrete
   failures; no global threshold/source rule is approved from these examples.
2. Real bounded ordinary-playback input through Modal and cached Line 5 rendering
   remains unverified. The prepared route has not been deployed/applied.
3. Production privacy/terms and capture consent review remains required.

Stop here under the user's failed-gate instruction. Reuse these artifacts for
the next bounded repair; do not start Phase 5 or a new broad research branch.
