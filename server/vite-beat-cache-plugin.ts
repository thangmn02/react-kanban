import type { Plugin } from 'vite';
import { handleBeatEventCache } from './beat-event-cache';
export function beatCacheDevelopmentPlugin(env: Record<string, string>): Plugin {
  return { name: 'local-beat-event-cache', apply: 'serve', configureServer(server) {
    server.middlewares.use('/api/beat-events', async (req, res) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      const result = await handleBeatEventCache(new Request(`http://${req.headers.host}/api/beat-events${req.url || ''}`, {
        method: req.method, headers,
      }), { cacheOrigin: env.BEAT_EVENT_CACHE_ORIGIN, analysisUrl: env.BEAT_ANALYSIS_URL, analysisKey: env.BEAT_ANALYSIS_KEY,
        supabaseUrl: env.VITE_SUPABASE_URL, supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY });
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
    });
  } };
}
