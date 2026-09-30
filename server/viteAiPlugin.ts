import type { Plugin } from 'vite';
import { handleTaskBreakdown } from './taskBreakdown';

export function aiDevelopmentPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-task-breakdown',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/task-breakdown', async (req, res) => {
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const buffer = Buffer.from(chunk);
            size += buffer.length;
            if (size > 16_384) { res.writeHead(413); res.end(); return; }
            chunks.push(buffer);
          }
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
          const method = req.method ?? 'GET';
          const request = new Request(`http://${req.headers.host}/api/task-breakdown`, { method, headers, ...(method === 'POST' ? { body: Buffer.concat(chunks).toString('utf8') } : {}) });
          const result = await handleTaskBreakdown(request, {
            apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL,
            supabaseUrl: env.VITE_SUPABASE_URL, supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
            allowLocalMock: env.VITE_AUTH_MODE !== 'supabase' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? ''),
          });
          res.writeHead(result.status, Object.fromEntries(result.headers));
          res.end(await result.text());
        } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unavailable' })); }
      });
    },
  };
}
