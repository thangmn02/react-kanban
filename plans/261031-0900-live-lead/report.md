# Live Melody/Lead: the fifth Beat Grid row

**Status: works end to end in real Kora Windows with the live Companion candidate. Quality is modest and measured; not qualified for public release.**

The fifth row now receives Lead attacks detected live from the captured audio. It appears only while that detector is actually running for the capture. Detection is causal: it uses no look-ahead, no saved analysis, no model weights and no network.

## 1. Audit of earlier Lead work

| When | Engine | Live? | Outcome |
|---|---|---|---|
| ≤ Oct 5 | FFT flatness/centroid "melody" detector | Yes | Followed generic energy, and hats were mixed into Melody. Replaced. |
| Oct 6, Companion 0.3.12 (published) | Spleeter ONNX stems plus a harmonic note tracker on the "other" stem | Yes | 157 MB download, 3.5 s buffering, vocals excluded. Removed Oct 10 with the move to a 4-row grid. |
| Oct 8–18 | HTDemucs stems with MELODIA and vocal articulation (`lead-pulse-v1`) | No | Exact saved references only. Basic Pitch and MELODIA+Basic Pitch fusion compared offline in the Melody Detector Demo. |
| Oct 25 | Stem-assisted bake-off; five-row finalization | No | HTDemucs rejected; Spleeter unmeasurable. Lead marked "offline only, live NOT_SUPPORTED". |

**Already present before this work:**
- The `melody` wire row and the `melody.state` contract.
- The `melodic` telemetry type.
- Kora's onset parsing of a `melody` band.
- The scheduler, the semantic renderer's Melody row and the 5-row shapes.

**Missing:**
- Any live producer.
- `melody` in the Companion's band allowlist.
- A capability telling Kora a live producer exists.

## 2. Detector choice

The shortlist and its measurements are below. Precision, recall and F1 are on the 5 MusicDelta development mixes. Chance is the precision of the same predictions shifted in time.

| Candidate | Precision | Recall | F1 | Chance | Note |
|---|---|---|---|---|---|
| Basic Pitch 0.4.0 ONNX, offline full context | .232 | .286 | .256 | .226 | Polyphonic; its contour follows accompaniment. Raw pitch accuracy .25. |
| Basic Pitch, streaming with 100 ms look-ahead | .256 | .346 | .294 | .199 | Barely above chance. |
| Salience tracker, first version | .053 | .009 | .015 | — | Voicing gate rejected almost everything. |
| **Salience tracker, frozen (`kora-lead-salience-v1`)** | **.464** | **.496** | **.479** | **.224** | Selected. |

**Selected design:**
- One 1024-point spectrum every 128 decimated samples (~11.6 ms), at ~11 kHz.
- 10-cent harmonic salience over MIDI 40–88, built from tonal peaks only.
- The dominant pitch must show 6 partials and hold for 4 frames.
- It emits at a voiced start, a held pitch change of ≥1 semitone, or a same-pitch re-articulation: a ≥9 dB dip below the note's own peak, then a return.
- Pitch is reported only when stable; otherwise the event has no MIDI pitch.

**Abstention:** silence, noise and unpitched frames produce nothing.

**Rejected:**
- Separation-based paths: earlier runs needed seconds of buffering and 157 MB downloads, and HTDemucs was rejected on Oct 25.
- CREPE: monophonic, so unsuitable for full mixes.

## 3. Implementation

**Companion candidate** (built by `--live-lead`, which requires `--source-audio-delay`):
- `lead-tracker.js` is the detector.
- `lead-tracker-worklet.js` runs it on the audio rendering thread.
- `lead-runtime.js` checks ownership and epoch, and keeps output silent.
- The `scripts/live-lead-package.mjs` transform:
  - starts the runtime with each capture;
  - resets it on every synchronization epoch;
  - stops it with the capture;
  - applies the same typed-preview gate as percussion;
  - sends `enqueue('beat',['melody'],audioTime,…)` with the original audio time;
  - adds `melody` to `beat-sync.js` valid bands;
  - reports `leadLive` in health.

**Shared source:**
- `beat-mode.js` and `.d.ts`: `leadLive` capability. It is false unless a private capture reports a running tracker.
- `scripts/native-companion-delay-package.mjs`: hash lock updated for that intentional change.

**Kora:**
- `src/features/music/live-lead.ts` holds the enablement contract.
- `MusicPlayer.tsx` uses it, so the fifth row shows only when Hybrid Beta is off, `capability.leadLive` is true and the beat mode is `capture`.
- Silence keeps the row dark, because only accepted events light it.

**Test package:** candidate-5, Companion 0.3.29, ZIP SHA-256 `fb82f6020fd33647623a7cf88e2da6fcaa5cc729cdf46c51222af816ef994265`. It contains candidate-4's hi-hat prominence plus live Lead.

| File | SHA-256 |
|---|---|
| Tracker | `ff30cdb1…db3c` |
| Worklet | `01d2f5f1…3f93` |
| Runtime | `83d3bee6…32ea` |

## 4–6. Evidence

### Accuracy

The reference is MedleyDB MELODY1 (human-corrected dominant-melody f0) for the MusicDelta excerpts already in the corpus.
- Reference onsets are derived from voicing starts and held pitch moves of ≥0.8 semitone.
- Same-pitch re-articulations do not appear in f0 annotations, so the precision figures below are lower bounds.
- Tolerance is ±50 ms.

| Set | Precision | Recall | F1 | Chance | Events during annotated melody |
|---|---|---|---|---|---|
| Development (5 mixes, used for tuning) | .464 | .496 | .479 | .224 | 85% |
| Held-out (18 mixes) | **.440** | **.473** | **.456** | .213 | 78% |

Median timing error of matched attacks is ~4–11 ms.

Held-out was evaluated three times:
1. After the first grid search.
2. After choosing the drum-rejection setting.
3. After a correctness fix for the self-retrigger bug.

No parameter was chosen from held-out results.

### Controls

| Control | Events |
|---|---|
| Sustained 3 s tone | 1 |
| Sustained tone with tremolo | 1 |
| 6 repeated same-pitch notes | 6 |
| 6-note legato scale | 6, pitches 60–69 exact |
| Silence | 0 |
| White noise | 1 |

**Drum-only false Lead events per minute:**
- Development stems: 19.
- Held-out stems: 29.
- Before drum rejection: 131.

### Live vs offline

Real browser AudioWorklet, run in real time on 145 s of labelled audio:
- 299 live and 299 offline events; 295 match within 30 ms. This is model agreement, not accuracy.
- Live accuracy on that playlist: precision .535, recall .58.

### Real Kora Windows

The chain was: test Chrome running candidate-5, Apple Music preview of "Someone Like You" (audio only), tabCapture, Companion, native bridge, Kora Owner Preview, Focus Dock Beat grid. Enhanced Beat Sync was Active at 170 ms.

- Kora rendered 5 rows, with `leadLive:true`.
- 88 Melody onsets were received. 80 lit the fifth row; the others arrived before the Beat grid tab was opened.
- Zero Melody flashes occurred without a delivered event.
- An earlier Billie Jean run delivered 89 Melody events.

### Latency

| Stage | Time |
|---|---|
| Audio onset → Lead decision | p50 84 ms, p95 90 ms |
| Companion → Kora | p50 3 ms, p95 5 ms |
| Kora receipt → DOM attack | ~140 ms, deliberately held to the delayed-audio deadline |

With Delay ON (170 ms), Lead attacks land at their audio time. With Delay OFF, the candidate keeps every typed row dark, as before. Shown without delay, Lead would trail by about 85–90 ms.

This is software timing, not physical speaker-to-pixel synchronization, which was not measured.

### Resources

- The worklet uses 1.5% of the audio rendering thread.
- Node runs it at real-time factor ≤0.009.
- No model, no allocation per frame beyond small arrays, and no queue beyond the existing bounded capture queue.

## 7. Regression

- Vitest: 162 files, 1,307 tests pass.
- Package tests: 13 pass, covering the delay candidate, native delay and live Lead.
- Type check is clean.
- Lint is clean on every changed file.

## 8. Licensing

- The detector is original code with no weights.
- Basic Pitch (Apache-2.0, `nmp.onnx` SHA `2c3c1d14…`) was evaluated only. It is neither shipped nor committed.
- MedleyDB annotations and MusicDelta audio (CC BY-NC-SA) stay in ignored `scratch/` for private evaluation.

## 9. Owner listening procedure

1. In `chrome://extensions`, turn **off** candidate-4. **Load unpacked**:
   `C:\Users\thang\.codex\worktrees\kora-release-check\react-kanban\scratch\source-audio-delay-261031\candidate-5\extension`
   Its ID is `opknendpnohnhigmnedagigfeaeicdcb`; keep only one 0.3.29 enabled.
2. In Kora: Music → pause → tick consent → **Turn on Enhanced Beat Sync** → play → click the Companion icon on that tab.
   - For a video page, switch to another tab.
   - Pause until **Active**, then play.
3. Open **Beat grid**. A fifth green row appears.
4. Listen for flashes on sung syllables and new lead notes, quiet during sustained notes and drum-only passages.
   - Good test songs: piano ballads, vocal pop, guitar/synth leads.

## 10. Limitations and recommendation

**Limits:**
- About half of the reference onsets are found, and roughly half of the flashes match a reference onset.
- Dense mixes with competing melodic instruments are the weakest; FunkJazz and SwingJazz score worst.
- Drums still add ~20–30 false flashes per minute.
- Same-pitch repeats are under-measured.
- Physical A/V synchronization is unmeasured.
- On Apple pages with animated artwork video, Enhanced Beat Sync eligibility can flip ("visible video"). That belongs to the delay feature, not to Lead.

**Recommendation:** keep it in the private 0.3.29 candidate for the owner's listening A/B. Do not publish or change Production. If it's accepted, the next step is a labelled 30 s owner excerpt to check precision on the owner's own music.
