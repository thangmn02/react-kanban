import { requireSupabaseClient } from '../lib/supabase';

type Listener = () => void;
/** One ref-counted private identity topic per browser/WebView, shared by scopes. */
const topics = new Map<string, { listeners: Set<Listener>; dispose: () => void }>();
export function subscribeNoteInvalidations(userId: string, listener: Listener) {
  let entry = topics.get(userId);
  if (!entry) {
    const client = requireSupabaseClient(), listeners = new Set<Listener>();
    let active = true;
    const notify = () => { if (active) listeners.forEach(callback => callback()); };
    const channel = client.channel(`notes:user:${userId}`, { config: { private: true } }).on('broadcast', { event: 'invalidate' }, notify);
    entry = { listeners, dispose: () => { active = false; void client.removeChannel(channel); } };
    topics.set(userId, entry);
    void (async () => {
      const session = await client.auth.getSession();
      if (!active || session.data.session?.user.id !== userId) return;
      await client.realtime.setAuth();
      const current = await client.auth.getSession();
      if (active && current.data.session?.user.id === userId) channel.subscribe(status => { if (status === 'SUBSCRIBED') notify(); });
    })().catch(notify);
  }
  const subscribed = entry;
  subscribed.listeners.add(listener);
  return () => {
    subscribed.listeners.delete(listener);
    if (!subscribed.listeners.size && topics.get(userId) === subscribed) { subscribed.dispose(); topics.delete(userId); }
  };
}
