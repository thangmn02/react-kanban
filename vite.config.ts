import { defineConfig, loadEnv } from 'vite'
import { aiDevelopmentPlugin } from './server/viteAiPlugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import nativeConfig from './src-tauri/tauri.conf.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: { __KORA_VERSION__: JSON.stringify(nativeConfig.version) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'exclude-installer-from-native-bundle',
      apply: 'build',
      async writeBundle(options) {
        // Web builds ship the download; native builds must not embed old installers.
        if (process.env.TAURI_ENV_PLATFORM && options.dir) {
          await rm(resolve(options.dir, 'downloads/Kora-setup.exe'), { force: true });
          await rm(resolve(options.dir, 'downloads/latest.json'), { force: true });
        }
      },
    },
    aiDevelopmentPlugin({ ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string>)
  ],
  server: {
    // Cargo locks build helpers on Windows; frontend HMR must not watch them.
    watch: { ignored: ['**/src-tauri/target/**'] },
  },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 ships Rolldown, whose manualChunks is typed as a function
        // (not the Rollup object form). This mirrors the intended vendor
        // split: react/react-dom, supabase, dnd-kit, tiptap, framer.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const n = id.replace(/\\/g, '/');
          if (
            n.includes('/node_modules/react/') ||
            n.includes('/node_modules/react-dom/') ||
            n.includes('/node_modules/scheduler/')
          ) return 'react-vendor';
          if (n.includes('/node_modules/@supabase/supabase-js/')) return 'supabase';
          if (n.includes('/node_modules/@dnd-kit/')) return 'dnd';
          if (n.includes('/node_modules/@tiptap/')) return 'tiptap';
          if (n.includes('/node_modules/framer-motion/')) return 'framer';
          return undefined;
        },
      },
    },
  },
}))
