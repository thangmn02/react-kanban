# Bounded Lead precision/recall pass

Outcome: inspect one frozen Lead v1 baseline, classify candidate/ownership/filter/
delivery failures and make at most one general correction supported by repeated
evidence. Compare on the existing saved-audio grid, with both misses and extras
judged by a small human listening review.

Safety boundary: leave production Lead policy, Rows 1–4, models, infrastructure,
all original fixtures and accepted playback/rendering untouched. Experimental
results and raw measurements stay under ignored `src-tauri/target/`.

- [x] Freeze source/output identities and inspect upstream/filtered evidence.
- [x] Decide whether one repeatable cause justifies a private correction: none established; preserve v1.
- [x] Verify frozen baseline delivery on one audio clock and playback lifecycle; no artificial candidate comparison. Existing export regression tests pass.
- [x] Report evidence, risks and keep/adopt recommendation; stop after one pass.

The twelve reviewed ranges are exposed regression material now, not unseen
holdouts. Lock genuinely new ranges before evaluating, without retuning afterward.
Counts and confidence are descriptive; no inferred musical precision/recall.

Result: confirmed Gymnopédie extraction/ownership misses and alternative-stem
contour-to-attack extras cannot safely be corrected by one demonstrated policy
change. [Evidence and recommendation](../reports/validation-261009-1551-lead-precision-recall.md).
