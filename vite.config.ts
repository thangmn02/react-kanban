import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
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
})
