import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config (remediation plan §9.2 / Phase 5 — E2E).
 *
 * The smoke suite runs against the app in **local mock mode** (no Supabase
 * required): `npm run dev` is started as the `webServer`, and tests load
 * URL-addressable routes. CI installs browsers via `npx playwright install`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Force local mock mode so E2E never depends on a running Supabase stack.
      VITE_AUTH_MODE: 'mock',
    },
  },
});
