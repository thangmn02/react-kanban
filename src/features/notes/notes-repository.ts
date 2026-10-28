import type { AppUser, WorkspaceRole } from '../../types/auth.type';
import { ConnectedNotesSession } from './connected-notes-session';

const connected = new Map<string, { session: ConnectedNotesSession; references: number; stop?: () => void }>();
export async function prepareConnectedNotesToClose(userId:string){await Promise.all([...connected].filter(([key])=>key.startsWith(`${userId}:`)).map(([,entry])=>entry.session.prepareToClose()));}
/** Manager, task context, Quick Notes and native broker share one scoped owner. */
export function connectedNotesRepository(user: AppUser, workspaceId: string | null, role?: WorkspaceRole) {
  const key = `${user.id}:${workspaceId ?? 'personal'}`;
  let owner = connected.get(key);
  if (!owner) { owner = { session: new ConnectedNotesSession(user, workspaceId, role), references: 0 }; connected.set(key, owner); }
  const entry = owner;
    return { session: entry.session, acquire() { entry.references++; if (entry.references === 1&&!entry.stop) entry.stop = entry.session.start(); let released = false; return () => { if (released) return; released = true; if (--entry.references === 0) { void entry.session.flushAll().finally(()=>{if(!entry.references){entry.stop?.();entry.stop=undefined;if(connected.get(key)===entry)connected.delete(key);}}); } }; } };
}
