import type { Plugin } from 'vite';
import { handleBeatEventCache } from './beat-event-cache';
import { localPercussionListeningCache } from './local-percussion-listening-cache';
import { resolve } from 'node:path';
import { LEAD_ANALYSIS_VERSION } from '../src/features/music/lead-events';
import { MAX_PLAYBACK_AUDIO_BYTES } from './playback-audio-input';
export function beatCacheDevelopmentPlugin(env: Record<string, string>): Plugin {
  return { name: 'local-beat-event-cache', apply: 'serve', configureServer(server) {
    server.middlewares.use('/api/beat-events', async (req, res) => {
      const buffers: Buffer[] = []; let bytes = 0;
      const limit = req.headers['content-type'] === 'audio/wav'
        && new URL(req.url || '', 'http://localhost').searchParams.get('operation') === 'segment'
        ? MAX_PLAYBACK_AUDIO_BYTES : 2048;
      if (req.method === 'POST') {
        for await (const buffer of req) {
          bytes += buffer.length;
          if (bytes > limit) { res.writeHead(400); res.end('{"error":"invalid_request"}'); return; }
          buffers.push(buffer);
        }
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      const request = new Request(`http://${req.headers.host}/api/beat-events${req.url || ''}`, {
        method: req.method, headers, ...(buffers.length ? { body: Buffer.concat(buffers) } : {}),
      });
      const privateFixture = new URL(request.url).searchParams.get('id')?.startsWith('private-local/');
      const privateLead = new URL(request.url).searchParams.get('analysisVersion')===LEAD_ANALYSIS_VERSION;
      const result = privateFixture ? await localPercussionListeningCache(request, privateLead ? resolve('src-tauri/target/lead-pulse/cache') : env.KORA_PRIVATE_BEAT_CACHE_DIRECTORY || resolve('src-tauri/target/percussion-closure/cache')) : await handleBeatEventCache(request, { cacheOrigin: env.BEAT_EVENT_CACHE_ORIGIN, analysisUrl: env.BEAT_ANALYSIS_URL, analysisKey: env.BEAT_ANALYSIS_KEY,
        leadEnabled: env.BEAT_LEAD_PIPELINE==='true',
        leadAccess: 'development',
        leadAuthorizedAsset: env.BEAT_LEAD_AUDIO_TEST_ASSET,
        leadProcessingEnabled: env.BEAT_LEAD_PROCESSING_ENABLED === 'true'
          && env.BEAT_LEAD_RIGHTS_CLEARED === 'true' && env.BEAT_LEAD_AUDIO_AUTHORIZED === 'true',
        supabaseUrl: env.VITE_SUPABASE_URL, supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
        supabaseServiceKey: env.BEAT_EVENT_CACHE_BACKEND === 'supabase' ? env.SUPABASE_SERVICE_ROLE_KEY : undefined });
      res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text());
    });
  } };
}
