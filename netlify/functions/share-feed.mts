import { handleShareFeed } from '../../server/shareFeed';

export default (request: Request) => handleShareFeed(request, {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
});
