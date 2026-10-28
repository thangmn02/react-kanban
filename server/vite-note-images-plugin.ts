import type { Plugin } from 'vite';
import { Readable } from 'node:stream';
import { handleNoteImages } from './note-images';

export function noteImagesDevelopmentPlugin(env: Record<string, string>): Plugin {
  return { name: 'private-note-images', configureServer(server) {
    server.middlewares.use('/api/note-images', async (incoming, outgoing) => {
      try {
        const headers = new Headers(); for (const [key, value] of Object.entries(incoming.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value);
        const init = { method: incoming.method, headers, ...(incoming.method === 'POST' ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) };
        const request = new Request(`http://${incoming.headers.host || 'localhost'}/api/note-images`, init as RequestInit);
        const reply = await handleNoteImages(request, { supabaseUrl: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY });
        outgoing.statusCode = reply.status; reply.headers.forEach((value, key) => outgoing.setHeader(key, value)); outgoing.end(Buffer.from(await reply.arrayBuffer()));
      } catch { outgoing.statusCode = 500; outgoing.end('{"error":"Image service is unavailable."}'); }
    });
  } };
}
