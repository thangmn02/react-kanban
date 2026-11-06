import { defineConfig, devices } from '@playwright/test';

/** The first-run spec needs a server that does not seed the sample. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/first-run.spec.ts',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', launchOptions: { args: ['--no-proxy-server'] } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_AUTH_MODE: 'mock', VITE_LOCAL_SAMPLE: 'false' },
  },
});
