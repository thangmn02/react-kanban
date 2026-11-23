import { describe, expect, it, vi } from 'vitest';
import { newNote, type StickyNote } from './notes-store';
import { discardIfEmpty, resolveQuickNote, type QuickNoteStore } from './quick-note-actions';
import { isEmptyNote, noteSaveState } from './note-save-state';

function fakeStore(notes: Partial<StickyNote>[], extra: { readOnly?: boolean; owner?: boolean } = {}) {
  const rows = notes.map(patch => ({ note: { ...newNote(), ...patch } as StickyNote, readOnly: !!extra.readOnly, owner: extra.owner ?? true }));
  const store: QuickNoteStore & { created: Partial<StickyNote>[] } = {
    created: [],
    notes: () => rows,
    create: vi.fn(async patch => { store.created.push(patch); return 'new-id'; }),
    change: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    loading: () => false,
  };
  return store;
}

describe('Quick Notes', () => {
  it('creates on an explicit request and reopens a task note on a task request', async () => {
    const store = fakeStore([{ id: 'old', taskId: 't1', updatedAt: '2026-01-01T00:00:00Z' }, { id: 'recent', taskId: 't1', updatedAt: '2026-02-01T00:00:00Z' }, { id: 'archived', taskId: 't1', updatedAt: '2026-03-01T00:00:00Z', archivedAt: '2026-03-02T00:00:00Z' }]);
    expect(await resolveQuickNote(store, { taskId: 't1' })).toBe('recent');
    expect(await resolveQuickNote(store, { create: true, taskId: 't1', boardId: 'b1' })).toBe('new-id');
    expect(store.created.at(-1)).toMatchObject({ taskId: 't1', taskBoardId: 'b1' });
    expect(await resolveQuickNote(store, { taskId: 't2' })).toBe('new-id');
    expect(await resolveQuickNote(store, {})).toBe('new-id');
    expect(await resolveQuickNote(store, { noteId: 'old' })).toBe('old');
    expect(await resolveQuickNote(store, { noteId: 'missing' })).toBeNull();
  });
  it('discards only empty notes the user owns and can edit', async () => {
    const empty = fakeStore([{ id: 'e' }]);
    expect(await discardIfEmpty(empty, 'e')).toBe(true);
    expect(empty.discard).toHaveBeenCalledWith('e');
    const written = fakeStore([{ id: 'w', html: '<p>keep me</p>' }]);
    expect(await discardIfEmpty(written, 'w')).toBe(false);
    const shared = fakeStore([{ id: 's' }], { owner: false });
    expect(await discardIfEmpty(shared, 's')).toBe(false);
    expect(shared.discard).not.toHaveBeenCalled();
  });
  it('treats titles, text, images and checklist items as content', () => {
    const base = { title: '', html: '', checklist: [] };
    expect(isEmptyNote(base)).toBe(true);
    expect(isEmptyNote({ ...base, html: '<p><br></p><p> </p>' })).toBe(true);
    expect(isEmptyNote({ ...base, title: 'x' })).toBe(false);
    expect(isEmptyNote({ ...base, html: '<p><img src="kora-note-image://1"></p>' })).toBe(false);
    expect(isEmptyNote({ ...base, checklist: [{ id: '1', text: '', isDone: false }] })).toBe(false);
  });
  it('maps session and outbox state to one status', () => {
    expect(noteSaveState({ status: 'All changes saved.' })).toBe('saved');
    expect(noteSaveState({ status: 'Saved locally on this device.', local: true, online: false })).toBe('saved');
    expect(noteSaveState({ status: 'Saving locally…' })).toBe('saving');
    expect(noteSaveState({ status: 'Saved locally, awaiting synchronization.' })).toBe('saving');
    expect(noteSaveState({ status: 'Saved locally, awaiting synchronization.', online: false })).toBe('offline');
    expect(noteSaveState({ status: '', online: false })).toBe('offline');
    expect(noteSaveState({ status: 'Local save failed.' })).toBe('failed');
    expect(noteSaveState({ error: 'boom' })).toBe('failed');
  });
});
