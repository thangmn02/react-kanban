import { handleTaskBreakdown } from '../../server/taskBreakdown';

export default (request: Request) => handleTaskBreakdown(request, {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
});
