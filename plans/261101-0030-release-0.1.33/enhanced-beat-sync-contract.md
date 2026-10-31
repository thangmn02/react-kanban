# Enhanced Beat Sync: release contract (BLOCKED for 0.1.33)

**Decision: BLOCKED.**

Kora 0.1.33 ships with Enhanced Beat Sync compiled out of the public build. The flags `VITE_ENABLE_SOURCE_AUDIO_DELAY` and the native `KORA_ENABLE_SOURCE_AUDIO_DELAY` are both unset. Companion 0.3.29 stays a separate private candidate. The installed research Companion 0.3.25 is untouched.

## Why it is blocked

**The activation flow is per song.** Today's flow in `use-source-audio-delay.ts` and `source-audio-delay-control.tsx`:

- **Fence:** the route is fenced to one browser document *and* one song (`fence`).
- **Pause to enable:** it can only be enabled while paused.
- **Consent per song:** it asks for a checkbox consent each time.
- **Off on song change:** it turns itself OFF on every song or source change.
- **Fixed delay:** it applies a fixed 170 ms delay only while paused, per capture.

The result is that a new song means a new consent and a new pause cycle. That is the repeated workflow the owner reported.

**Audio continuity is unmeasured.** The known risks have no real-Windows measurements:

- initial silence while the delay buffer fills;
- skipped audio when the delay is removed mid-playback.

The acceptance rule is "no clicks, echo, duplicate output, silence or timeline jumps in ordinary use". That needs physical listening and loopback measurement on Windows, which this release did not perform.

**Changes span three components.** Making this a remembered preference requires coordinated changes in:

- Companion 0.3.29: capture lifecycle across tracks, pause, seek and tab reload;
- the native bridge: the `0.3.29` version gate and per-source intents in `nativeMusic.ts`;
- the Kora UI.

Those changes need their own qualification.

## Target contract

**1. Preference.**

- Setting: `music.enhancedBeatSync`, default **Off**.
- Persistence: stored per Kora account on this device.
- Fields: `{ enabled, scope: 'eligible-audio-sources', approvedAt, approvedDelayMs }`.

**2. One-time consent when switching On.** One short explanation: "Supported music may play about 0.2 s later so the Beat Grid lands on the beat. You can turn this off at any time."

- No per-song checkboxes.
- Reconsent only if the delay ceiling or the permission scope materially changes, for example a delay above `approvedDelayMs`.

**3. Automatic activation.** For an eligible source (audio-only, non-DRM, 1× speed, output owned by the Companion), Kora asks the Companion to apply the approved delay at a safe boundary:

- **new track start:** before the first audible frame, or
- **after a seek:** the next resume,

never mid-phrase. Pause, resume and seek keep the preference; only the buffer is rebuilt.

**4. Browser permission gesture.** Chrome's `tabCapture` still needs one toolbar click per source tab. Kora shows that request once per tab, at the moment it's needed, and never pretends it can be skipped.

**5. Lifecycle.**

- **Tab closure or Companion reload:** restore normal output immediately.
- **Kora restart or lost connection:** the Companion falls back to undelayed output; Kora re-applies on the next eligible boundary.
- **Unsupported or protected sources:** show **Unavailable**; never delay them.

**6. UI states.** One compact row under Music:

- Off / Preparing / On / Unavailable / Error;
- details on demand.

No 170 ms field, no capture, buffer or route wording, no candidate text.

## Acceptance before release

**Real Windows playback, three providers, 30 minutes each.** Zero echo or duplicate output. Measured across:

- track changes;
- pause/resume;
- seek;
- device switch;
- tab close;
- Companion reload.

**Thresholds:**

- activation silence ≤ the approved delay, at a track or seek boundary only;
- deactivation never skips audible content outside a boundary;
- no repeated consent or pause cycles after the first opt-in.

**If seamless activation can't meet this:** keep a boundary-only activation, or leave the feature experimental.
