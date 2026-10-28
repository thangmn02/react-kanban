import { requireSupabaseClient } from '../lib/supabase';
import type { AppUser, WorkspaceRole } from '../types/auth.type';
import type { Json } from '../types/database.types';
import { newNote, type StickyNote } from '../features/notes/notes-store';
import { notePresentationPreferences } from '../features/notes/note-presentation';
import { noteContent, notePresentation, type ConnectedNote, type NoteAccessRow, type NoteComment, type NotePermission, type NoteRow } from '../features/notes/notes-types';

function result<T>(value: { data: T; error: { message: string; code?: string } | null }): T {
  if (value.error) throw Object.assign(new Error(value.error.message), { code: value.error.code });
  return value.data;
}
export async function fetchConnectedNotes(user: AppUser, workspaceId: string | null, role?: WorkspaceRole): Promise<ConnectedNote[]> {
  const client = requireSupabaseClient();
  const assertAccount = async () => { const session = await client.auth.getSession(); if (session.data.session?.user.id !== user.id) throw Error('The signed-in account changed. Reopen Notes in the current account.'); };
  await assertAccount();
  let query = client.from('notes').select('*').order('updated_at', { ascending: false });
  query = workspaceId ? query.eq('workspace_id', workspaceId) : query.is('workspace_id', null);
  const rows = result(await query) ?? [];
  if (!rows.length) { await assertAccount(); return []; }
  const currentRole = workspaceId ? result(await client.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle())?.role : role;
  const ids = rows.map(row => row.id);
  const [layouts, grants, links] = await Promise.all([
    client.from('note_user_presentation').select('*').eq('user_id', user.id).in('note_id', ids),
    client.from('note_access').select('*').eq('user_id', user.id).in('note_id', ids),
    client.from('note_task_links').select('*').in('note_id', ids),
  ]);
  const presentations = result(layouts) ?? [], access = result(grants) ?? [], taskLinks = result(links) ?? [];
  const taskBoards = taskLinks.length ? result(await client.from('tasks').select('id,board_id').in('id', taskLinks.map(link => link.task_id))) ?? [] : [];
  await assertAccount();
  return rows.map((row, index) => {
    const content = row.content as { html?: string; checklist?: StickyNote['checklist']; convertedTaskId?: string | null };
    const stored = presentations.find(item => item.note_id === row.id)?.presentation as Partial<StickyNote> | undefined;
    const layout = stored ? {
      ...notePresentationPreferences(stored),
      x: bounded(stored.x, 0, 3000, 0), y: bounded(stored.y, 0, 2000, 0),
      width: bounded(stored.width, 260, 900, 310), height: bounded(stored.height, 280, 900, 360),
      pinned: stored.pinned === true, minimized: stored.minimized === true, expanded: stored.expanded === true,
    } : {};
    const link = taskLinks.find(item => item.note_id === row.id);
    const explicit = access.find(item => item.note_id === row.id)?.permission;
    const base: NotePermission = row.owner_user_id === user.id ? 'manage' : row.visibility === 'workspace' && currentRole && currentRole !== 'viewer' ? 'edit' : 'view';
    const ranks = { view: 1, comment: 2, edit: 3, manage: 4 };
    const permission = explicit && ranks[explicit] > ranks[base] ? explicit : base;
    return { row, permission, note: { ...newNote(index), ...layout, id: row.id, title: row.title, html: content.html ?? '', checklist: content.checklist ?? [], convertedTaskId: content.convertedTaskId ?? null, taskId: link?.task_id ?? null, taskBoardId: taskBoards.find(task => task.id === link?.task_id)?.board_id ?? null, revision: row.revision, writeToken: row.write_token, updatedAt: row.updated_at, peek: false } };
  });
}
function bounded(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
export async function saveConnectedNote(note: StickyNote, workspaceId: string | null, expectedRevision: number, token: string, actorUserId: string, importKey?: string): Promise<NoteRow> {
  const request: Json = { id: note.id, workspaceId, title: note.title, content: noteContent(note), expectedRevision, writeToken: token, taskId: note.taskId, ...(importKey ? { importKey } : {}), ...(actorUserId ? { actorUserId } : {}) };
  return result(await requireSupabaseClient().rpc('save_note', { request })) as unknown as NoteRow;
}
export async function saveNoteLayout(note: StickyNote, actorUserId: string): Promise<void> {
  result(await requireSupabaseClient().rpc('save_note_presentation', { request: { id: note.id, presentation: notePresentation(note), ...(actorUserId ? { actorUserId } : {}) } }));
}
export async function importNoteLayoutIfAbsent(note: StickyNote, actorUserId: string): Promise<void> {
  result(await requireSupabaseClient().rpc('save_note_presentation', { request: { id: note.id, actorUserId, presentation: notePresentation(note), onlyIfAbsent: true } }));
}
export async function setNoteAccess(row: NoteRow, changes: { userId?: string; permission?: NotePermission | null; visibility?: NoteRow['visibility'] }, actorUserId: string): Promise<NoteRow> {
  return result(await requireSupabaseClient().rpc('set_note_access', { request: { id: row.id, expectedRevision: row.revision, actorUserId, ...changes } })) as unknown as NoteRow;
}
export async function setNoteDeleted(row: NoteRow, deleted: boolean, actorUserId: string): Promise<NoteRow> {
  return result(await requireSupabaseClient().rpc('set_note_deleted', { request: { id: row.id, expectedRevision: row.revision, deleted, actorUserId } })) as unknown as NoteRow;
}
export async function moveConnectedNote(row:NoteRow,workspaceId:string|null,clearTaskLink:boolean,actorUserId:string):Promise<NoteRow>{
  return result(await requireSupabaseClient().rpc('move_note',{request:{id:row.id,workspaceId,clearTaskLink,expectedRevision:row.revision,actorUserId}})) as unknown as NoteRow;
}
export async function fetchNoteCollaboration(id: string, actorUserId: string): Promise<{ comments: NoteComment[]; grants: NoteAccessRow[] }> {
  const client = requireSupabaseClient();
  const assertAccount = async () => { const session = await client.auth.getSession(); if (session.data.session?.user.id !== actorUserId) throw Error('The signed-in account changed. Reopen Notes in the current account.'); };
  await assertAccount();
  const [comments, grants] = await Promise.all([client.from('note_comments').select('*').eq('note_id', id).order('created_at'), client.from('note_access').select('*').eq('note_id', id)]);
  await assertAccount();
  return { comments: result(comments) ?? [], grants: result(grants) ?? [] };
}
export async function mutateNoteComment(noteId: string, action: 'create' | 'edit' | 'delete', body: string, actorUserId: string, comment?: NoteComment): Promise<void> {
  result(await requireSupabaseClient().rpc('mutate_note_comment', { request: { noteId, id: comment?.id ?? crypto.randomUUID(), action, body, expectedRevision: comment?.revision ?? 0, actorUserId } }));
}
