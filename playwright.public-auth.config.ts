import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: '**/public-auth.spec.ts',
  testIgnore: [],
  workers: 2,
  use: { ...base.use, baseURL: 'http://127.0.0.1:5184' },
  projects: [{ name: 'public-auth', use: { ...base.projects![0].use,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }],
  webServer: { ...base.webServer,
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5184 --strictPort',
    url: 'http://127.0.0.1:5184',
    env: {
    VITE_AUTH_MODE: 'supabase',
    VITE_SUPABASE_URL: 'https://kora-auth-test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-public-anon-key',
  } },
});
