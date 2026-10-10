# Saved Lead listening acceptance

Outcome: the existing private Beat Grid opens saved automatic Lead fixtures,
plays original audio and schedules Row 5 from that audio's clock, with clear
readiness/counts/ownership and optional normal-renderer preview.

Cause: the demo defaults to legacy manual-stem data, and its saved Lead adapter
requests a live API instead of supplying the saved events it already loaded.

Scope: private diagnostic fixture transport/UI, focused tests and Playwright MCP
validation on existing port 5173. Preserve detection, Rows 1–4, production clock,
scheduler/renderer, prior diagnostics and all saved model outputs.

- [x] Feed saved Lead events through the existing EventTrack engine interface.
- [x] Make automatic fixtures/defaults, audio controls and unavailable states clear.
- [x] Validate tests, visible Play/Pause/Replay, Row 5 timing and a screenshot.

Validation: [concise acceptance report](../reports/validation-261009-1216-lead-listening-acceptance.md).
Status: delivered for human listening review; no model-quality acceptance claimed.

No model work, backend deployment, new application or large generated reports.
