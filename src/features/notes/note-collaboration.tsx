import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import type { AppUser, WorkspaceMember } from '../../types/auth.type';
import { fetchNoteCollaboration, mutateNoteComment, setNoteAccess } from '../../services/notes.service';
import { notePermissionRank, type ConnectedNote, type NoteAccessRow, type NoteComment } from './notes-types';

interface Props { entry: ConnectedNote; user: AppUser; members: WorkspaceMember[]; onClose: () => void; onRefresh: () => Promise<void>; pending: boolean }
export default function NoteCollaboration({ entry, user, members, onClose, onRefresh, pending }: Props) {
  const [comments, setComments] = useState<NoteComment[]>([]), [grants, setGrants] = useState<NoteAccessRow[]>([]);
  const [body, setBody] = useState(''), [search, setSearch] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<NoteComment | null>(null), [editBody, setEditBody] = useState('');
  const manage = entry.permission === 'manage';
  const dialog = useRef<HTMLElement | null>(null);
  useDialogFocus(true, dialog, () => { if (!busy) onClose(); });
  const load = async () => { const data = await fetchNoteCollaboration(entry.row.id, user.id); setComments(data.comments); setGrants(data.grants); };
  useEffect(() => {
    let active = true;
    void fetchNoteCollaboration(entry.row.id, user.id).then(data => { if (active) { setComments(data.comments); setGrants(data.grants); } }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, [entry.row.id, entry.row.revision, user.id]);
  const run = async (action: () => Promise<unknown>) => {
    if (busy || pending) return;
    setBusy(true); setError('');
    try { await action(); await load(); await onRefresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'The change could not be saved.'); await onRefresh(); } finally { setBusy(false); }
  };
  const button = 'min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50';
  return <section ref={dialog} role="dialog" aria-modal="true" aria-label="Note sharing and comments" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4">
    <div className="max-h-[85vh] w-full max-w-xl space-y-4 overflow-auto rounded-2xl bg-white p-5 shadow-xl">
      <header className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-950">{entry.note.title || 'Untitled note'} · {entry.permission}</h2><button autoFocus type="button" disabled={busy} className={button} onClick={onClose}>Close</button></header>
      <p className="text-sm text-slate-600">{entry.row.visibility === 'private' ? 'Private to the owner and people explicitly granted access.' : 'Visible to current workspace members. Workspace editors can edit; viewers can read.'} Only the owner manages sharing and deletion.</p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {pending && <p role="status" className="text-sm text-amber-800">Finish syncing this note before changing collaboration.</p>}
      {manage && entry.row.workspace_id && <fieldset disabled={busy || pending} className="space-y-3 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">Sharing</legend>
        <label className="flex items-center justify-between gap-2 text-sm">Visibility<select aria-label="Note visibility" value={entry.row.visibility} className={button} onChange={event => void run(() => setNoteAccess(entry.row, { visibility: event.target.value as 'private' | 'workspace' }, user.id))}><option value="private">Private</option><option value="workspace">Workspace members</option></select></label>
        <input aria-label="Find a member to share this note" placeholder="Find a member by name or email" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-slate-200 p-2 text-sm" />
        <ul className="space-y-2">{members.filter(member => member.userId !== entry.row.owner_user_id && `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase())).map(member => <li key={member.userId} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{member.name}</span><select aria-label={`Note permission for ${member.name}`} value={grants.find(grant => grant.user_id === member.userId)?.permission ?? ''} className={button} onChange={event => void run(() => setNoteAccess(entry.row, { userId: member.userId, permission: event.target.value as 'view' | 'comment' | 'edit' || null }, user.id))}><option value="">No explicit grant</option><option value="view">View</option><option value="comment">Comment</option><option value="edit">Edit</option></select></li>)}</ul>
      </fieldset>}
      <h3 className="text-sm font-semibold">Comments</h3>
      {editing && <form className="space-y-2 rounded-lg border border-slate-200 p-3" onSubmit={event => { event.preventDefault(); void run(async () => { await mutateNoteComment(entry.row.id, 'edit', editBody.trim(), user.id, editing); setEditing(null); }); }}><textarea aria-label="Edit note comment" maxLength={4000} value={editBody} onChange={event => setEditBody(event.target.value)} className="min-h-20 w-full rounded border border-slate-200 p-2 text-sm" /><button type="submit" disabled={busy || pending || !editBody.trim()} className={button}>Save comment</button><button type="button" className={`${button} ml-2`} onClick={() => setEditing(null)}>Cancel edit</button></form>}
      {!comments.length && <p className="text-sm text-slate-500">No comments yet.</p>}
      <ul className="space-y-3">{comments.map(comment => <li key={comment.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="mb-1 text-xs font-medium text-slate-600">{members.find(member => member.userId === comment.author_user_id)?.name ?? (comment.author_user_id === user.id ? 'You' : 'Workspace member')} · <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time></p><p className="whitespace-pre-wrap break-words text-slate-800">{comment.body}</p>{(manage || comment.author_user_id === user.id) && notePermissionRank[entry.permission] >= 2 && <><button type="button" disabled={busy || pending} className="mr-3 mt-2 text-xs font-medium text-blue-700" onClick={() => { setEditing(comment); setEditBody(comment.body); }}>Edit comment</button><button type="button" disabled={busy || pending} className="mt-2 text-xs font-medium text-rose-700" onClick={() => void run(() => mutateNoteComment(entry.row.id, 'delete', '', user.id, comment))}>Delete comment</button></>}</li>)}</ul>
      {notePermissionRank[entry.permission] >= 2 && <form onSubmit={event => { event.preventDefault(); const text = body.trim(); if (text) void run(async () => { await mutateNoteComment(entry.row.id, 'create', text, user.id); setBody(''); }); }} className="space-y-2"><textarea aria-label="New note comment" maxLength={4000} value={body} onChange={event => setBody(event.target.value)} className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm" /><button disabled={busy || pending || !body.trim()} type="submit" className={button}>Add comment</button></form>}
    </div>
  </section>;
}
