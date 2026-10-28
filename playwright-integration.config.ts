import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Exercise the actual built app without the development transform server.
const appDirectory = process.env.KORA_QUALIFICATION_APP_DIR || 'scratch/integration-qualification/frontend';
if (!/^scratch\/[a-z0-9/_-]+$/.test(appDirectory)) throw new Error('Use a repository-relative scratch build directory.');

export default defineConfig({
  ...base,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  testMatch: [
    'beat-grid.spec.ts', 'briefing.spec.ts', 'employee-identity.spec.ts',
    'identity-workflow.spec.ts', 'layered-shell-notes.spec.ts', 'product-ux.spec.ts', 'workflows.spec.ts',
  ],
  outputDir: 'scratch/integration-qualification/browser',
  reporter: [['list'], ['json', { outputFile: 'scratch/integration-qualification/browser-results.json' }]],
  use: { ...base.use, trace: 'retain-on-failure' },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5173 --strictPort --outDir ${appDirectory}`,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
