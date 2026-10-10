# Raw semantic generation and percussion-absent calibration

**The first contamination is in raw local detection.** Vocal/instrumental
inputs already produce typed Kick/Snare/Hat events before any merger, scheduler,
renderer or decoration. This investigation does not establish a Row 5 broadcast.
Row 5 was never an input to these tests.

The latest measurement-only instruction supersedes further tuning. The earlier
spectral-flux candidate is still unaccepted. The stronger conservative trial is
preserved, not adopted: it reduced false activity but also removed many real
percussion candidates and still failed the MONO negative control. No further
thresholds, audio models, scheduler or rendering behavior were changed during
this investigation. Melody tuning and Phase 5 remain stopped; Rows 1–4 are not
frozen. Nothing was published or packaged as a new release.

## Inputs and versions

Four existing benchmark families supply aligned vocal, piano, bass and drum
stems, original mixes, and mixtures formed by summing vocals/piano/guitar/other/
bass while omitting the drum stem. Additional guitar and instrumental stems,
Gymnopédie, and the user's two annotated drum-free excerpts provide stronger
negative controls. Total: **29 inputs**, evaluated separately against the
released detector and the current working candidate.

Each benchmark excerpt is 30 seconds. The user's Bích Phương excerpt is 0–13
seconds; MONO's *Em Là* is 0–40 seconds. All timestamps in exports are seconds
relative to the input excerpt. Original mix filenames preserve their source
window, for example H.S.K.T. 130–160 seconds. No per-song production rules were
added.

The saved separated stems are model outputs, not perfectly isolated ground
truth. They can contain separation artifacts or leakage. The drum-omitted
mixtures consequently cannot prove absolute percussion absence. The user's
annotated natural excerpts independently corroborate the observed failure.
The Chinese-pop piano stem is near-silent (maximum FFT-bin level about −77 dB);
its zero counts are not a meaningful clean-melody accuracy success. The remix
piano stem is also mostly below −65 dB. Guitar, instrumental accompaniment and
the natural piano reference avoid relying only on those weak controls.

Audio was decoded in owned isolated Edge processes, downmixed without gain
normalization and sampled at 44.1 kHz, FFT size 2048, Blackman window, 60 frames/
second. This measures the production detector against real supplied audio;
it is not a physical-speaker latency measurement. No new separation or heavy
inference was run, and no audio was uploaded.

The private released detector snapshot matches `HEAD` (`f7a2445`) after newline
normalization. The working detector matches the saved second candidate.
Exports include source SHA-256 and distinguish `released`, `candidate`, and
the archived `conservative-trial`. Companion's manifest remains **0.3.14**.
The browser's cached worker need not match an uncommitted source snapshot until
it is reloaded; the report does not infer the user's loaded code from its
version label alone.

## Raw counts, before transport or UI

These are binary detector decisions, not verified musical note counts.

| Input | Control | Kick | Snare | Hat | Bass |
|---|---|---:|---:|---:|---:|
| H.S.K.T. | A: vocals | 50 | 76 | 64 | 52 |
| H.S.K.T. | B: piano | 14 | 0 | 0 | 20 |
| H.S.K.T. | C: bass | 58 | 16 | 0 | 54 |
| H.S.K.T. | D: drums | 46 | 64 | 87 | 59 |
| H.S.K.T. | E: original mix | 72 | 84 | 85 | 77 |
| H.S.K.T. | F: drum stem omitted | 61 | 76 | 64 | 61 |
| Chân Ái remix | A: vocals | 73 | 94 | 98 | 93 |
| Chân Ái remix | B: piano | 2 | 0 | 0 | 1 |
| Chân Ái remix | C: bass | 20 | 1 | 0 | 19 |
| Chân Ái remix | D: drums | 27 | 44 | 36 | 27 |
| Chân Ái remix | E: original mix | 27 | 89 | 98 | 29 |
| Chân Ái remix | F: drum stem omitted | 32 | 95 | 97 | 55 |
| Nujabes | A: vocals | 63 | 84 | 33 | 85 |
| Nujabes | B: piano | 17 | 0 | 0 | 19 |
| Nujabes | C: bass | 58 | 0 | 0 | 57 |
| Nujabes | D: drums | 26 | 92 | 89 | 49 |
| Nujabes | E: original mix | 70 | 90 | 100 | 73 |
| Nujabes | F: drum stem omitted | 76 | 84 | 33 | 76 |
| Chinese pop | A: vocals | 59 | 52 | 52 | 54 |
| Chinese pop | B: near-silent piano | 0 | 0 | 0 | 0 |
| Chinese pop | C: bass | 23 | 1 | 0 | 22 |
| Chinese pop | D: drums | 69 | 70 | 68 | 70 |
| Chinese pop | E: original mix | 88 | 78 | 86 | 87 |
| Chinese pop | F: drum stem omitted | 53 | 69 | 52 | 55 |
| Nujabes | B: guitar | 70 | 10 | 0 | 65 |
| H.S.K.T. | B: other instrumental accompaniment | 41 | 2 | 0 | 57 |
| Gymnopédie | B: natural piano reference | 46 | 0 | 0 | 35 |
| Bích Phương, 0–13 s | user-annotated drum-free mix | 22 | 17 | 0 | 34 |
| MONO, 0–40 s | user-annotated drum-free mix | 57 | 85 | 58 | 64 |

The local spectral-flux candidate still fails the vocal controls:

| Candidate input | Kick | Snare | Hat | Bass |
|---|---:|---:|---:|---:|
| H.S.K.T. vocals | 7 | 72 | 64 | 69 |
| Chân Ái remix vocals | 45 | 91 | 96 | 72 |
| Nujabes vocals | 7 | 76 | 33 | 71 |
| Chinese-pop vocals | 15 | 45 | 52 | 64 |
| Gymnopédie | 21 | 0 | 0 | 29 |
| Bích Phương, 0–13 s | 0 | 0 | 0 | 31 |
| MONO, 0–40 s | 31 | 68 | 55 | 47 |

Zero percussion events on one intro did not generalize. Spectral novelty and
tonal/noisy gates are onset evidence, not proof of percussion identity. The
archived conservative trial still emitted **17/19/13/1** events on MONO and
reduced Nujabes full-mix Hat activity from 100 to 15. It is not an accepted
production repair even with the user's preference for fewer false flashes.

## Confidence distributions and existing calibration

Local `BeatDetector.analyze()` returns `{hits, audible, envelope}`. It produces
**no class confidence, posterior probability or percussion/nonpercussion
margin**. Every exported local event has `confidence:null`; the known-score
count is zero. Minimum/median/maximum class confidence are unavailable, not
zero. Normalization and merging preserve that unknown value. Tempo lock's
confidence is not drum-class confidence.

Measured energy evidence illustrates why an absolute volume cutoff alone
cannot separate classes. These are median band-energy/absolute-floor ratios
at emitted events from the released detector:

| H.S.K.T. input | Kick | Snare | Hat | Bass |
|---|---:|---:|---:|---:|
| Vocals | 5.84 | 27.93 | 5.12 | 988.21 |
| Drums | 30,225.82 | 26.03 | 4.32 | 9,540.41 |
| Bass | 19,553.14 | 1.36 | no events | 10,190.87 |

The vocal Snare/Hat medians exceed the drum-stem medians. Raising one global
energy floor therefore risks rejecting real drums while retaining vocal
transients. The complete exports include p10/median/p90 energy-over-floor
evidence, energy/average, rising-envelope ratio, adaptive threshold, event
density and, for the candidate, flux/spread/attack values. None is labeled a
calibrated class probability.

The actual mechanisms in the released detector are:

- Fixed per-band absolute energy floor **1e−7**, 400 ms warmup and per-band
  120 ms refractory. The floor is present but does not establish identity.
- A **700 ms exponential moving band-energy average**; a hit requires current
  energy above average × threshold and above previous-frame energy × 1.15.
  Quiet sections decay the reference average, so a subsequent non-drum attack
  can cross the relative gate. For constant silence, that average loses about
  94% over two seconds. This is relative sensitivity, not automatic gain.
- Density above three hits/second raises the multiplier. After sparse/quiet
  input it returns to the configured base, **never below 1.6**. Across these
  released controls, measured multipliers range **1.6–2.368**. First/last-five-
  second distributions are exported; there is no demonstrated runaway lowering
  below the base threshold or invented confidence increase.
- Semantic identity comes from the frequency-band name. The detector has no
  explicit percussion-presence/abstention classifier.

No per-window top-N selection, signal gain rescaling, class-confidence
renormalization or generic tempo-to-typed-drum conversion exists in this local
detector path. The candidate adds log-compressed positive spectral flux,
envelope and timbral checks, but retains the relative average and density
mechanisms. Its gates still accept vocal consonants and melodic attacks.

## Exact raw → normalized → merged → rendered comparison

The same measured event lists were replayed against the actual application
bridge parser, event engine/priority merger, media-clock scheduler, controller
and semantic DOM renderer. Cache demand was disabled; no server jobs or cache
substitutions participated. Continuous clock/capture heartbeats represent
active analysis during sparse sections. The first harness omitted those
heartbeats and correctly triggered stale-owner recovery; that harness failure
was corrected without weakening event-preservation assertions.

**58 comparisons / 10,192 raw events:**

- 10,192 normalized events;
- 10,192 merged/scheduled semantic events;
- 10,192 DOM semantic commits;
- zero extra semantic events, changed IDs/types/target timestamps or wrong rows;
- no Melody, tempo-generated semantic hits or decoration in the comparison.

`clap` becomes canonical `snare`; it does not fan out. The merger deduplicates
and replaces by **row plus media timestamp**, preserving coincident different
types. The renderer's exact type-to-row mapping remains Kick→1, Snare→2, Hat→3,
Bass→4. The new durable regression verifies unknown local class confidence and
coincident identities survive merging while tempo remains timing-only.

The capture code audit supports the observed path: capture-engine enqueues
`result.hits`, offscreen forwards the same bands, beat-sync validates/dedupes
those band names, and widget transport forwards the payload. No evidence here
supports a Melody output rebroadcasting into percussion. The full-chain
timestamped detector telemetry integration also passes.

This is an identity/provenance test under a controlled media clock. It recorded
10,118 explicitly dispatched jsdom animation-start observations for the 10,192
DOM commits. The harness probes currently present cells after each input batch;
those observations are incomplete and do not establish animation delivery for
every commit. It does not certify actual CSS animation timing, provider capture
latency or physical speaker alignment.

## Bass finding

Bass must not share the drum abstention decision. Low piano, synth bass and
bass-guitar events may legitimately coincide with melodic events. Piano's Bass
counts alone are therefore not failures.

There is nevertheless clear ambiguity: released vocal stems emit **52/93/85/54**
Bass events; the candidate emits **69/72/71/64**. The released Kick 45–150 Hz and
Bass 60–250 Hz bands overlap, allowing the same low attack to qualify twice.
Moving Bass to a disjoint 150–400 Hz region reduces direct shared-bin evidence
but exposes it to vocal fundamentals; it does not establish a real bass source.
Isolated bass stems also generate many Kick events before rendering. Bass needs
its own low-pitched/low-pulse evidence and continuity checks, while retaining
legitimate low piano. A blanket rule that Bass must always have a root below
150 Hz would discard valid material and is not adopted.

## Proposed abstention, not implemented

Rows 1–3 need an explicit uncertainty/abstention decision. Preserve the user's
chosen priority: fewer false flashes, accepting missed uncertain/soft hits.

1. Keep onset detection separate from percussion identity. A novelty peak is
   an attack candidate, not a mandatory Kick/Snare/Hat event.
2. Require convincing per-class evidence plus separation from tonal/vocal
   competing evidence. Retain an absolute floor, but do not use amplitude or
   spectral flux as a substitute for class confidence.
3. If a local method can only establish generic activity, abstain on semantic
   drum rows. Any fallback decoration remains explicitly nonsemantic and is
   disabled in this diagnostic mode.
4. Evaluate a bounded short-term presence check across several independent
   convincing attacks. It must expire through quiet/nonpercussive passages,
   never lower thresholds to fill an empty row, and never manufacture events
   from the presence state itself. Strong independently verified attacks must
   not wait for a decorative tempo lock.
5. Calibrate decision margins and allowed density on the measured positive and
   negative controls plus natural holdouts before choosing global parameters.
   Inspect isolated false hits separately from phrase-following activity.
6. Evaluate Bass independently for actual low-pulse/pitched continuity; do not
   suppress all low piano or make Bass follow every generic lead onset.

These measurements justify abstention but do not validate a specific heuristic
or supply missing class probabilities. No new presence gate, model download,
client ML, server deployment or later roadmap phase starts from this report.

## Artifacts and checks

Private local artifacts contain audio-derived measurements; they remain in
ignored build output and were not committed or published:

- [Raw per-row events, confidence and calibration distributions](../../src-tauri/target/local-dsp/raw-controls.json)
- [Per-input pipeline counts](../../src-tauri/target/local-dsp/pipeline-summary.json)
- [Exact event identities, timestamps and pipeline traces](../../src-tauri/target/local-dsp/pipeline-controls.json)
- [Raw measurement script](../../src-tauri/target/local-dsp/measure-raw-controls.mjs)
- [Controlled pipeline comparison](../../src-tauri/target/local-dsp/provenance.test.tsx)
- [Archived conservative trial results](../../src-tauri/target/local-dsp/conservative-candidate-evaluation.json)

The **full existing suite passes: 98 files / 726 tests**. The real-input
diagnostic replay passes **58 comparisons**. TypeScript, scoped lint, diff
whitespace checks and production Vite build pass; existing extensionless-import
and large-chunk warnings remain. No release packaging was run with an unaccepted
detector candidate.

The actual project Companion, loaded into an owned isolated Edge profile,
starts its offscreen document without page errors. An intentionally invalid
stream ID returns the observable `stream-open / AbortError` diagnostic. This
checks extension startup/error transport, not successful provider audio capture.
The user previously confirmed live capture works. Direct control of the user's
Edge remains unavailable because the browser runtime fails with file-access
errors; no personal-profile bypass was attempted.

Owned diagnostic browsers and test processes are closed. The existing local
preview on port 5173, PID 3132, remains available for the user's checks. The
accepted renderer commit stays `f7a2445`; this diagnostic does not declare the
DSP repair or listening gate complete.
