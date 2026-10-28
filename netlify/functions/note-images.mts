import { handleNoteImages } from '../../server/note-images';

export default (request: Request) => handleNoteImages(request, {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
