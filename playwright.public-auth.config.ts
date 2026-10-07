import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: '**/public-auth.spec.ts',
  testIgnore: [],
  workers: 2,
  projects: [{ name: 'public-auth', use: { ...base.projects![0].use,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) } }],
  webServer: { ...base.webServer, env: {
    VITE_AUTH_MODE: 'supabase',
    VITE_SUPABASE_URL: 'https://kora-auth-test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-public-anon-key',
  } },
});
