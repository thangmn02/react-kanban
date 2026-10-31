# Optional source audio delay for the release candidate

Status: implementation and testing authorized by the owner on October 30. Production and installed-app/research-extension replacement remain forbidden. Continue the [whole-product release plan](../261027-0846-product-completion/phase-release.md).

## Outcome and acceptance

Prepare a release-capable, source-specific mode from the accepted private 170 ms experiment. Default Windows capture and ordinary web behavior stay intact. Opt-in is ephemeral and tied to selected source, asset and generation. Preparation is explicit, paused and authorized. Enabling delay additionally requires actual output/no-echo consent for the current capture and generation. OFF remains available during playback and is acknowledged before the UI claims the tab route stopped.

Use only frozen L0, existing presets and strict event timestamps. Preserve provider/protected-media checks, one captured output, original-output suppression proof, bounded typed commands and owner/subscription fencing. Exclude research recording, early finalization, Hybrid CNN, global offsets and physical synchronization claims.

## Implementation and verification

1. Package distinct Companion 0.3.29 with hash-bound packaging changes and a separate candidate flag. Admit advanced behavior only for explicitly opted-in native owners. Preserve Windows-monitor and ordinary web behavior. Reuse the proven private output/transport fixes; keep source/model bytes frozen.
2. Add a release-candidate build gate and exact-version admission in Rust. Reuse bounded consented L0 configuration validation; keep private 0.3.28 separately debug-gated.
3. Pass route choice explicitly with the beat subscription. Serialize transitions, retire old subscriptions and fence incoming events. Add per-source opt-in and acknowledged exit; reuse compensation controls without unrelated private modes.
4. Verify actual transformed modules, default behavior, consent, pause/seek/source/output ownership, protected providers, OFF and failure/rollback. Run native/UI regressions, type/build/lint and preservation; independently review ownership. Exercise the isolated candidate with fresh staging recovery admission before generated fixtures.

## Recovery and release boundary

No database change is needed. Disable candidate build flags to retain the default route. Preserve prior private/public artifacts. An uncertain OFF stays visibly unconfirmed and cannot silently fall through to a new route. Final signed-native/provider/device qualification and separate Production authorization still apply.
