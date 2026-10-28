import { requireSupabaseClient } from '../../lib/supabase';
import { subscribeNoteInvalidations } from '../../services/note-invalidation.service';
import type { NoteMedia } from './note-media';
import { isTauri } from '@tauri-apps/api/core';
const validId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function connectedNoteMedia(actorUserId: string, noteId: string, ensureSaved: () => Promise<void>): NoteMedia {
  const operations = new WeakMap<File, string>();
  const assertAccount = async () => { const current = await requireSupabaseClient().auth.getSession(); if (current.data.session?.user.id !== actorUserId) throw Error('The account changed. Reopen the note.'); return current.data.session; };
  return {
    async upload(file, operationId) {
      if (!navigator.onLine) throw Error('Images need a connection. Your text draft is retained; reconnect and retry this image.');
      await ensureSaved(); const session = await assertAccount();
      const configured = import.meta.env.VITE_NOTE_IMAGES_URL as string | undefined;
      const endpoint = new URL(configured || '/api/note-images', location.href);
      const trustedNativeOrigins=['https://koraspace.online','https://kanthangboard.netlify.app'];
      if(endpoint.origin!==location.origin&&!(isTauri()&&trustedNativeOrigins.includes(endpoint.origin)))throw Error('The image server origin is not authorized. No credentials were sent.');
      if(endpoint.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('Image uploads require a secure server.');
      const id = operationId && validId.test(operationId) ? operationId : operations.get(file) ?? crypto.randomUUID(); operations.set(file, id);
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${session!.access_token}`, 'X-Note-Id': noteId, 'X-Note-Image-Id': id, 'Content-Type': file.type }, body: file, signal: AbortSignal.timeout(45_000) });
      const result = await response.json(); await assertAccount();
      if (!response.ok) throw Error(result.error || 'Image upload failed. Your text is retained.');
      if (!validId.test(result.id) || result.noteId !== noteId) throw Error('Invalid image upload response.');
      return { id: result.id, width: result.width, height: result.height };
    },
    async download(id) {
      if (!validId.test(id)) throw Error('Invalid image identity.'); await assertAccount();
      const { data, error } = await requireSupabaseClient().storage.from('kora-note-images').download(`${noteId}/${id}`);
      await assertAccount(); if (error || !data) throw Error('Image access is unavailable.'); return data;
    },
    subscribe(invalidate) {
      const unsubscribe = subscribeNoteInvalidations(actorUserId, invalidate);
      const auth = requireSupabaseClient().auth.onAuthStateChange((_event, session) => { if (session?.user.id !== actorUserId) invalidate(); });
      return () => { unsubscribe(); auth.data.subscription.unsubscribe(); };
    },
    async uploaded(){await assertAccount();const response=await requireSupabaseClient().from('note_images').select('id,width,height,created_at').eq('note_id',noteId).eq('state','ready').order('created_at',{ascending:false});await assertAccount();if(response.error)throw Error('Uploaded image recovery is unavailable.');return(response.data??[]).map(image=>({id:image.id,width:image.width,height:image.height,createdAt:image.created_at}));},
  };
}
