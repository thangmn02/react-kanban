# Compact dock player validation

The Music tab retains its glass, blur and blue-purple container. Its primary
content is now a real media player: title/source, seek timeline and time labels,
previous/play/next controls, and volume/mute. Source selection and existing
instrument-note setup remain secondary. Unsupported controls are disabled.

The dock fits five rows and eight cells at 320 × 360; native and PiP opening
sizes are 520 × 580. User resizing and hidden-tab playback are preserved.
No detector, model, telemetry, Beat scheduler or source selection logic is part
of this commit. Existing unfinished synchronization changes remain separate.

Validation used actual browser audio through the production media-control
functions. Seeking changed playback position, volume changed the media element,
and playback continued while viewing Beat Grid. Small and normal layouts were
captured locally. Browser checks do not prove native Windows compositor blur or
provider-specific skip controls; capability guards and extension tests cover
the latter. The reference named with `(1)` was not present; the supplied
`kora-dock-tabs-v2.html` was used for structure, never its demo state/theme.

The combined working tree passed 604 JS tests and 13 native tests, TypeScript
and production build. A fresh focused run passed all 68 dock/media/PiP tests.
Inline review verified that only UI/control additions are staged, including
partial staging of shared bridge files. No release, push or version bump.
