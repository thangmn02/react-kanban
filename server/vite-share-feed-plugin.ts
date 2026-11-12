import type { Plugin } from 'vite';
import { handleShareFeed } from './shareFeed';

/** Serves /api/share-feed in development, the same handler Netlify runs in production. */
export function shareFeedDevelopmentPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-share-feed',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/share-feed', async (req, res) => {
        try {
          const request = new Request(`http://${req.headers.host}/api/share-feed${req.url && req.url !== '/' ? req.url : ''}`, { method: req.method ?? 'GET' });
          const result = await handleShareFeed(request, { supabaseUrl: env.VITE_SUPABASE_URL, supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY });
          res.writeHead(result.status, Object.fromEntries(result.headers));
          res.end(await result.text());
        } catch { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Temporarily unavailable'); }
      });
    },
  };
}
