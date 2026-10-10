# Dependency-aware test infrastructure

Status: implemented and locally validated; GitHub execution awaits publication.

Outcome: dependency-aware local and PR tests with exact reasons, conservative
unknown-impact fallback, mandatory quality/security checks and full nightly,
main and release regression. Preserve all existing tests and coverage gates.
No audio, Lead, percussion, rendering or threshold changes.

- [x] Measure current execution and inspect actual CI triggers/commands.
- [x] Implement transitive import selection, shared-contract/platform boundaries,
  targeted browser journeys, conservative fallback and local runner.
- [x] Wire PR lanes and full regression workflows, preserving mandatory checks.
- [x] Validate representative diffs, benchmark lanes, review and document.

Use the existing npm/package-lock CI commands; do not migrate package managers.
Keep measurements and selected-plan JSON under ignored `src-tauri/target/test-impact/`.
Automated browser tests own deterministic mock/auth ports separate from 5173.
Stop those test-owned servers on exit; do not stop the user's existing server.

Evidence and limitations: [validation report](../reports/validation-261009-1126-blast-radius-testing.md).
Rollback: restore the previous CI test commands and browser ports; remove only
the new selector scripts and package script entries. No product migration is needed.
