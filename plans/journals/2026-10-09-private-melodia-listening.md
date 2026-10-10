# Private MELODIA listening comparison

Implemented actual Essentia original-mixture extraction on five bounded inputs in isolated WSL Python. Added the measured contour/notes to the existing private grid and clock, preserving the earlier v3/rejected outputs. An initial provenance failure came from comparing WAV file SHA to decoded PCM SHA; measured decoder samples matched. Explicit note source metadata avoids float32 owner-boundary ambiguity in the private adapter.

Six Python checks, nine focused grid checks and 771 full-suite tests passed. Generated EventTracks validate; isolated Edge shows Row 5-only source/pitch/hash traces and working playback lifecycle. Accepted source hashes and v3 checkpoint match. The short default segments and inferred rests are exposed for listening, not declared correct. Stop for review; no automatic corpus expansion, tuning, production adoption or deployment.

The journal CLI returned `Command failed`; this native local record is the fallback. AgentWiki publish skipped.

See [technical report](../reports/validation-261009-0007-melodia-listening.md).
