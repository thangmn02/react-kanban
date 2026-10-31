# Hi-hat local prominence: candidate-4 A/B (October 31)

**Status: owner listening A/B pending. Not qualified for release.**

## Change

candidate-4 is candidate-3 plus a single peak-picking change in `percussion-classifier.js`, applied by `--hat-prominence` in packaging.

**What changed for Hi-Hat:** a hi-hat now counts when its rise is large relative to the local valley before it (the minimum of the previous 3 frames).

**Why:** previously a hi-hat had to rise above its own 120 ms rolling mean. Dense hi-hats keep that mean high, which hides real hits.

**What did not change:**
- Kick and Snare still use the rolling mean. Snare is excluded because the October 16 XO study found local prominence adds false Hats on Snare-only audio.
- The model, thresholds, label mapping and delay route are identical to candidate-3.

## Package

| | candidate-4 | candidate-3 |
|---|---|---|
| Version | 0.3.29, `version_name` "hat prominence A/B" | 0.3.29 |
| Extension ID (unpacked, this path) | `chkjlhooimmpjhhbkjilemnohjjcfgaj` | `cpjallhmbfdlkhlilfochoeehhcglgmc` |
| ZIP SHA-256 | `765efbd397236dc10d44d416f4a0ac9f6e6bcbee0ecc50b44cc220fbd53b6fa2` (reproducible) | `9f054eae…` |

## Replay on frozen ADTOF scores

The harness is `scratch/hat-prominence-ab/replay.mjs` in the main checkout. Inputs are the October 21 novelty-study corpus and its references.

**Matching rule:** one-to-one, nearest prediction first. The tolerance is 40 ms for complete constructed references and 50 ms for published natural positives.

**Harness check:** candidate-3 reproduces the study's MusicDelta evaluation baseline exactly (384/390). On the constructed set it finds 101 hits against the study's 96, because the study's matcher also caps tolerance at a quarter of the nearest reference gap.

| Set | Hat refs | candidate-3 recall | candidate-4 recall | False Hats |
|---|---:|---:|---:|---|
| Constructed, complete refs | 162 | .623 | .679 | 35 → 36 (precision .743 → .753) |
| MusicDelta calibration | 966 | .831 | .886 | unknown (incomplete refs; predictions 957 → 1045) |
| MusicDelta development | 430 | .947 | .972 | unknown (538 → 573) |
| MusicDelta evaluation, held out | 390 | .985 | .990 | unknown (661 → 703) |

- **Snare-only (complete):** false Hats go from 18 to 19.
- **Alternating snare/hat:** unchanged at 11 found, 12 false.

**Owner captures** (Head-3 frozen activations, counts only, no references):

| Song | candidate-3 | candidate-4 |
|---|---:|---:|
| Private Landing | 63 | 87 |
| Too Many Nights | 166 | 170 |
| Melody | 39 | 56 |

- In the known Private Landing gap, hats go from 1 to 2. Activation there peaks at about .25 raw, so the gap is a model limit, not a peak-picking one.
- The Melody additions are unreviewed and may be false Hats.

## Decision rule

Keep candidate-4 only if both of these hold:

1. The owner hears a fuller Hi-Hat row without new flashes on snares or vocals.
2. A labelled 30 s passage, from a song not used here, shows higher Hat recall with no meaningful precision loss.

Otherwise, keep candidate-3.
