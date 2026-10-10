import { handleBeatEventCache } from '../../server/beat-event-cache';

export default (request: Request) => handleBeatEventCache(request, {
  cacheOrigin: process.env.BEAT_EVENT_CACHE_ORIGIN,
  analysisUrl: process.env.BEAT_ANALYSIS_URL,
  analysisKey: process.env.BEAT_ANALYSIS_KEY,
  leadEnabled: process.env.BEAT_LEAD_PIPELINE === 'true',
  leadAccess: process.env.BEAT_LEAD_PUBLIC_ENABLED === 'true' ? 'public' : 'private-beta',
  leadBetaUsers: process.env.BEAT_LEAD_BETA_USER_IDS,
  leadProcessingEnabled: process.env.BEAT_LEAD_PROCESSING_ENABLED === 'true'
    && process.env.BEAT_LEAD_RIGHTS_CLEARED === 'true' && process.env.BEAT_LEAD_AUDIO_AUTHORIZED === 'true',
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.BEAT_EVENT_CACHE_BACKEND === 'supabase' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined,
});
