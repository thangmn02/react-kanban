// Test setup: registered for every Vitest run via vitest.config.ts
// `setupFiles`. Adds custom jest-dom matchers (`toBeInTheDocument`, etc.)
// so component tests can use them without per-file imports.
import '@testing-library/jest-dom/vitest';