import { handleBeatEventCache } from '../../server/beat-event-cache';

export default (request: Request) => handleBeatEventCache(request, {
  cacheOrigin: process.env.BEAT_EVENT_CACHE_ORIGIN,
  analysisUrl: process.env.BEAT_ANALYSIS_URL,
  analysisKey: process.env.BEAT_ANALYSIS_KEY,
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
});
