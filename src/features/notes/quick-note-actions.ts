import type { StickyNote } from './notes-store';
import type { QuickNotesRequest } from './quick-notes-events';
import type { deviceNotesRepository } from './device-notes-session';
import type { connectedNotesRepository } from './notes-repository';
import { setNoteDeleted } from '../../services/notes.service';
import { isEmptyNote } from './note-save-state';

type DeviceSession = ReturnType<typeof deviceNotesRepository>['session'];
type ConnectedSession = ReturnType<typeof connectedNotesRepository>['session'];

/** The few operations Quick Notes needs, over either the device or the connected session. */
export interface QuickNoteStore {
  /** Live (not trashed) notes with their shared archive state. */
  notes: () => { note: StickyNote; readOnly: boolean; owner: boolean }[];
  create: (patch: Partial<StickyNote>) => Promise<string>;
  change: (id: string, patch: Partial<StickyNote>) => Promise<void>;
  /** Moves the note to Trash. */
  discard: (id: string) => Promise<void>;
  loading: () => boolean;
}

export function deviceQuickStore(session: DeviceSession): QuickNoteStore {
  return {
    notes: () => session.getSnapshot().notes.filter(note => !note.deletedAt).map(note => ({ note, readOnly: false, owner: true })),
    create: patch => session.create(patch),
    change: (id, patch) => session.change(id, patch),
    discard: id => session.change(id, { deletedAt: new Date().toISOString() }),
    loading: () => false,
  };
}

export function connectedQuickStore(session: ConnectedSession, userId: string): QuickNoteStore {
  return {
    notes: () => session.getSnapshot().notes.filter(entry => !entry.row.deleted_at).map(entry => ({ note: { ...entry.note, archivedAt: entry.row.archived_at ?? null }, readOnly: !['edit', 'manage'].includes(entry.permission), owner: entry.row.owner_user_id === userId })),
    create: async patch => session.create(patch),
    change: async (id, patch) => { session.change(id, patch); },
    discard: async id => {
      await session.flush(id);
      if (session.hasPending(id)) throw Error('Wait for this note to finish syncing, then close it again.');
      const entry = session.getSnapshot().notes.find(row => row.row.id === id);
      if (!entry || entry.row.deleted_at || entry.permission !== 'manage') return;
      await setNoteDeleted(entry.row, true, userId);
      await session.refresh();
    },
    loading: () => session.getSnapshot().loading,
  };
}

/**
 * Which note a Quick Notes request opens. An explicit `create` always starts a new note; a task request
 * reopens that task's latest note and only creates one when the task has none.
 */
export async function resolveQuickNote(store: QuickNoteStore, request: QuickNotesRequest): Promise<string | null> {
  const live = store.notes();
  if (request.noteId) return live.some(entry => entry.note.id === request.noteId) ? request.noteId : null;
  if (request.taskId && !request.create) {
    const latest = live.filter(entry => entry.note.taskId === request.taskId && !entry.note.archivedAt).sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt))[0];
    if (latest) return latest.note.id;
  }
  return store.create({ expanded: true, floating: true, ...(request.taskId ? { taskId: request.taskId, taskBoardId: request.boardId ?? null } : {}) });
}

/** Closing an empty note discards it. Returns true when it was discarded. */
export async function discardIfEmpty(store: QuickNoteStore, id: string): Promise<boolean> {
  const entry = store.notes().find(row => row.note.id === id);
  if (!entry || entry.readOnly || !entry.owner || !isEmptyNote(entry.note)) return false;
  await store.discard(id);
  return true;
}
