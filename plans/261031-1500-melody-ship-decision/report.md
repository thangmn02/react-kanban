# Fifth Beat Grid row: shippable-path decision

**Decision: B, not viable for public release yet.**

No evaluated option, live or offline, gives a demonstrably better and release-defensible Melody row.

- **Preserved:** the four-row release path. Builds without the Lead flag contain no Lead code; Kora shows four rows unless a capture reports a running Lead tracker.
- **Kept for owner A/B only:** candidate-5 and candidate-6A as private evaluation candidates.

## What was compared

All runs use the same audio and the same scoring.

**Benchmark: MedleyDB MusicDelta, 23 excerpts.**
- Human MELODY2 melody f0. INTERVALS plus stem metadata give the melody source over time.
- 5 development tracks were used for tuning; 18 held-out tracks were not.
- Onsets are derived from f0 with a ±50 ms match.

**Owner clips (owner-reviewed drafts, not fully verified):**
- "Levels" 30–60 s: synth lead; 113 owner notes, lag-corrected 46 ms.
- "Praise The Lord" 30–54 s: flute hook plus vocal; 55 accepted or uncertain owner notes.

| Option | Licence of exact artifacts | Held-out ownership | Held-out F1 (P / R) | Levels F1 | Praise F1 | Drum-only false/min | Cost |
|---|---|---:|---:|---:|---:|---:|---|
| Candidate-5: live salience tracker on mix | Kora code, no weights | **.427** | .464 (.455 / .473) | .28 | .13 | 29 (MusicDelta) / 3 (owner stems) | 0.9% of a core, live |
| Candidate-6A: live contour line follower on mix | Kora code; Vocal/Unknown table only | .381 | **.477** (.496 / .458) | .34 | .12 | 37 / 3 | 1.7% of a core, live |
| Spleeter 4-stem, then Kora tracker on stem, dominance policy | Spleeter weights MIT; ONNX graph Apache-2.0 | .392 | .449 (.475 / .425) | **.35** | **.19** | **6.3** | ~0.05× real time offline (198 s song in 9 s) |
| Same, instrument-first policy (owner's rule) | same | .346 | .428 | .35 | .17 | 6.3 | same |
| Spleeter, then Basic Pitch on stem | Basic Pitch Apache-2.0 | .239 (dev) | .393 (dev) | — | — | 13–19 | offline |
| Basic Pitch on full mix (earlier run) | Apache-2.0 | .25–.33 raw pitch (dev) | .26–.29 (dev; chance .23) | — | — | — | offline |

**Real Kora Windows**, labelled playlist, Enhanced Beat Sync ON, same audio:
- Candidate-6A: F1 .63 (P .66, R .59).
- Candidate-5: F1 .60 (P .61, R .59).

Transport took 3–5 ms. No fifth-row flash ever appeared without a detected event.

**Interpretation:**
- **Separation helps most against drums.** False events fall about 5×, the vocal-versus-instrument choice matches the human source labels 81% of the time, and the owner's synth and flute clips improve slightly.
- **Separation does not improve melody-note accuracy or ownership.** The note front end on a stem is the limit. The "other" stem still mixes the lead instrument with comping (jazz trumpet plus piano, guitar riffs under vocals).
- **The instrument-first policy is worse on every labelled measure.**
- **Everything is weak on the owner's clips.** Best F1 is .35 on Levels and .19 on Praise The Lord. "Mostly right on most songs" is not met by any option.

## Exact artifact licensing

| Artifact | SHA-256 | Licence and redistribution | Notices needed |
|---|---|---|---|
| Spleeter `vocals.onnx` | `341bd47d…8701` | Weights MIT, per Deezer's JOSS 2020 paper. The README says "code" only; issue deezer/spleeter#898 is unresolved. Kora shipped these as an opt-in download in Companion 0.3.12. | Deezer MIT, plus Apache-2.0 for the sherpa-onnx-derived graph (§4(b) modification notice) |
| Spleeter `drums.onnx` | `fe832ff1…f997` | same | same |
| Spleeter `bass.onnx` | `be84af10…6d81` | same | same |
| Spleeter `other.onnx` | `9fa7fc4e…bedd` | same. Hugging Face `Best-Practice/spleeter-4stems-onnx` @ `87c5b6d2…`, card licence Apache-2.0. | same |
| Basic Pitch `nmp.onnx` (basic-pitch 0.4.0 wheel `738adb50…`) | `2c3c1d14…a0ec` | Apache-2.0 (Spotify); weights ship in the licensed package | Apache-2.0 plus NOTICE |
| HTDemucs | not used here | Research reference only; earlier lab use only. Not a release dependency. | — |
| MuScriptor | not evaluated | Research reference; licence unknown, so it is not a candidate | — |

Spleeter and Basic Pitch are redistributable with notices. Licensing is not the blocker; accuracy is.

## What stays in the product

- **Unchanged:** the four rows, Enhanced Beat Sync and the P3 visuals.
- **Not in release builds:** the fifth-row Lead code is not in any build without `--live-lead`, verified on a fresh package.
- **Owner-preview test aids, compile/build-flag gated, off in every ordinary build:**
  - Rust `KORA_OWNER_PREVIEW_LOOPBACK` admits a loopback test player;
  - Vite `VITE_OWNER_PREVIEW_LOOPBACK` lists it for Enhanced Beat Sync.

## Kept for the future

- **`scripts/lead-research/`:** the assisted Lead Annotation Editor (independent onset proposals, tap-to-confirm snapping, review gates), the Spleeter and policy evaluation harness, and the MedleyDB A/B scripts.
- **Candidate-6A tracker:** `extensions/kanban-music/lead-contour-tracker.js` (live). Its regression tests cover acquisition, no-backlog and source-label rules.

## Future Melody task (scoped)

Re-open the fifth row only when **one** of these is available:

1. **A permissively licensed melody-extraction model** with published weights. Its training data must allow redistribution of the weights. It must beat .55 ownership and .55 F1 on the MusicDelta held-out set, and beat .5 F1 on the owner clips.
2. **Owner-curated saved Lead tracks** for the owner's own library, using the annotation editor and Kora's existing saved-Lead EventTrack path. This works for a personal library, not as a general feature.

Before either counts as accuracy evidence, the two owner clips need finishing: set the lead label and resolve the uncertain notes.
