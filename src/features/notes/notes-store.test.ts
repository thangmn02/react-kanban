import { beforeEach, expect, it, vi } from 'vitest';
import { newNote, notesKey, readNotes, saveNote } from './notes-store';
import { clearUserData } from '../../shared/storage/storageAdapter';

const scope = { userId: 'owner', workspaceId: 'workspace' };
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
it('retains device originals and their backup on logout while other account scopes remain separate', () => {
  const [saved] = saveNote(scope, newNote());
  saveNote(scope, { ...saved, title: 'Retained original' }, saved.revision);
  localStorage.setItem('kanban:owner:workspace:server-cache:v1', 'remove');
  clearUserData('owner');
  expect(readNotes(scope)[0].title).toBe('Retained original');
  expect(localStorage.getItem(`${notesKey(scope)}:backup`)).not.toBeNull();
  expect(localStorage.getItem('kanban:owner:workspace:server-cache:v1')).toBeNull();
  expect(readNotes({ ...scope, userId: 'other' })).toEqual([]);
});
it('persists rich content, checklist, geometry and reversible Peek in the owning scope', () => {
  const note = { ...newNote(), html: '<p><strong>Keep</strong> this</p>', checklist: [{ id: 'check', text: 'Review', isDone: true }], peek: true, width: 400, taskId: 'task', taskBoardId: 'board' };
  const [saved] = saveNote(scope, note);
  expect(readNotes(scope)).toEqual([saved]);
  expect(readNotes({ ...scope, userId: 'other' })).toEqual([]);
  expect(readNotes({ ...scope, workspaceId: 'other' })).toEqual([]);
  saveNote(scope, { ...saved, peek: false }, saved.revision);
  expect(readNotes(scope)[0]).toMatchObject({ html: note.html, peek: false, width: 400, taskId: 'task' });
});
it('rejects a stale writer and retains a recoverable before-image', () => {
  const [first] = saveNote(scope, newNote());
  const [second] = saveNote(scope, { ...first, title: 'Other tab' }, first.revision);
  expect(() => saveNote(scope, { ...first, title: 'Stale' }, first.revision)).toThrow(/another tab/);
  expect(readNotes(scope)[0]).toEqual(second);
  expect(JSON.parse(localStorage.getItem(`${notesKey(scope)}:backup`)!)[0]).toEqual(first);
});
it('reports quota failures without replacing saved content', () => {
  const [first] = saveNote(scope, newNote());
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
  expect(() => saveNote(scope, { ...first, title: 'Not saved' }, first.revision)).toThrow();
  expect(readNotes(scope)[0].title).toBe('');
});
it('retains malformed storage and rejects oversized notes', () => {
  localStorage.setItem(notesKey(scope), '{broken');
  expect(() => readNotes(scope)).toThrow();
  expect(localStorage.getItem(notesKey(scope))).toBe('{broken');
  localStorage.clear();
  expect(() => saveNote(scope, { ...newNote(), html: 'x'.repeat(60001) })).toThrow(/limit/);
  expect(readNotes(scope)).toEqual([]);
});

it('rejects dependent queued writes after a same-note conflict even when numeric revisions coincide', () => {
  const [first] = saveNote(scope, newNote());
  const [external] = saveNote(scope, { ...first, title: 'External winner' }, first.revision);
  const queued = { ...first, writeToken: crypto.randomUUID(), revision: first.revision + 1, title: 'Uncommitted first edit' };
  expect(() => saveNote(scope, queued, first.revision, first.writeToken)).toThrow(/another tab/);
  expect(() => saveNote(scope, { ...queued, title: 'Dependent second edit', writeToken: crypto.randomUUID() }, queued.revision, queued.writeToken)).toThrow(/another tab/);
  expect(readNotes(scope)[0]).toEqual(external);
});
