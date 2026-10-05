import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import nativeConfig from './src-tauri/tauri.conf.json' with { type: 'json' };

// https://vite.dev/config/
export default defineConfig({
  define: { __KORA_VERSION__: JSON.stringify(nativeConfig.version) },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Discover both `.ts` and `.tsx` test/spec files. Previously this only
    // matched `*.test.ts`, so component/route tests written in TSX were
    // silently ignored by Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx,js}', 'extensions/**/*.test.js', 'supabase/functions/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      // Coverage thresholds are intentionally omitted until the first
      // application/component tests exist (see remediation plan §9.1).
      // Adding 60% thresholds now would fail CI since only pure-utils are
      // currently covered.
    },
  },
});
