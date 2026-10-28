import type { Json } from '../../types/database.types';
import type { StickyNote } from './notes-store';
import { notePresentationPreferences } from './note-presentation';

export type NotePermission = 'view' | 'comment' | 'edit' | 'manage';
export type NoteRow = {
  id: string; owner_user_id: string; workspace_id: string | null; title: string;
  content: Json; content_schema_version: number; visibility: 'private' | 'workspace';
  revision: number; write_token: string; import_key: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}
export type NoteAccessRow = { note_id: string; user_id: string; permission: NotePermission; created_at: string };
export type NoteComment = { id: string; note_id: string; author_user_id: string; body: string; revision: number; created_at: string; updated_at: string };
export type NotePresentationRow = { note_id: string; user_id: string; presentation: Json; updated_at: string };
export type NoteTaskLink = { note_id: string; task_id: string; workspace_id: string; created_at: string };
export type NoteImage = { id: string; note_id: string; created_by: string | null; object_path: string; mime_type: string; byte_size: number; width: number; height: number; sha256: string; state: 'pending' | 'ready' | 'retired'; created_at: string };
export type NotePresentation = Pick<StickyNote, 'x' | 'y' | 'width' | 'height' | 'pinned' | 'minimized' | 'expanded'> & ReturnType<typeof notePresentationPreferences>;
export interface ConnectedNote { row: NoteRow; note: StickyNote; permission: NotePermission }
export const notePermissionRank: Record<NotePermission, number> = { view: 1, comment: 2, edit: 3, manage: 4 };
export const notePresentation = (note: StickyNote): NotePresentation => ({ x: note.x, y: note.y, width: note.width, height: note.height, pinned: note.pinned, minimized: note.minimized, expanded: note.expanded, ...notePresentationPreferences(note) });
export const noteContent = (note: StickyNote): Json => ({ html: note.html, checklist: note.checklist.map(item => ({ id: item.id, text: item.text, isDone: item.isDone })), convertedTaskId: note.convertedTaskId });
