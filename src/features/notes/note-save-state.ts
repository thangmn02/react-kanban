import type { StickyNote } from './notes-store';
import { notePreviewText } from './notes-manager-model';

export type NoteSaveState = 'saved' | 'saving' | 'offline' | 'failed';

/**
 * One status for every note surface, derived from the session/outbox state instead of a Save button.
 * Connected sessions report "Saved locally, awaiting synchronization." while the outbox holds the edit.
 */
export function noteSaveState({ status = '', error = '', writing = false, failed = false, online = true, local = false }: { status?: string; error?: string; writing?: boolean; failed?: boolean; online?: boolean; local?: boolean }): NoteSaveState {
  if (failed || error || /failed/i.test(status)) return 'failed';
  if (writing || /^Saving/i.test(status)) return 'saving';
  if (/awaiting synchroni[sz]ation/i.test(status)) return online ? 'saving' : 'offline';
  if (!local && !online) return 'offline';
  return 'saved';
}
export const noteSaveStateKey = (state: NoteSaveState) => (({ saved: 'notes.save.saved', saving: 'notes.save.saving', offline: 'notes.save.offline', failed: 'notes.save.failed' }) as const)[state];

/** Nothing worth keeping: no title, no text, no image and no checklist item. */
export function isEmptyNote(note: Pick<StickyNote, 'title' | 'html' | 'checklist'>): boolean {
  return !note.title.trim() && !note.checklist.length && !/<img\b/i.test(note.html) && !notePreviewText(note.html).trim();
}
