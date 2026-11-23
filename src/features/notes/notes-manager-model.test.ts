import { describe, expect, it } from 'vitest';
import { newNote, type StickyNote } from './notes-store';
import { hasLabel, labelCounts, normalizeLabels } from './note-labels';
import { managerSections, matchesSearch, notePreviewText, selectRange, visibleEntries, type ManagerEntry } from './notes-manager-model';
import { noteContent } from './notes-types';

const entry = (patch: Partial<StickyNote>, extra: Partial<ManagerEntry> = {}): ManagerEntry => ({ note: { ...newNote(), ...patch }, readOnly: false, canArchive: true, canTrash: true, ...extra });

describe('note labels', () => {
  it('normalizes, de-duplicates case-insensitively and bounds labels', () => {
    expect(normalizeLabels([' Work ', 'work', ' Work /  Projects/ ', 7, '', 'x'.repeat(80)])).toEqual(['Work', 'Work/Projects', 'x'.repeat(50)]);
    expect(normalizeLabels(Array.from({ length: 30 }, (_, index) => `l${index}`))).toHaveLength(20);
    expect(normalizeLabels(undefined)).toEqual([]);
  });
  it('matches nested labels and counts parents once per note', () => {
    expect(hasLabel(['Work/Projects'], 'work')).toBe(true);
    expect(hasLabel(['Workshop'], 'Work')).toBe(false);
    expect(labelCounts([{ labels: ['Work/Projects', 'Work'] }, { labels: ['Home'] }, { labels: ['work/Admin'] }])).toEqual([
      { label: 'Home', count: 1 }, { label: 'Work', count: 2 }, { label: 'work/Admin', count: 1 }, { label: 'Work/Projects', count: 1 },
    ]);
  });
  it('stores labels in note content', () => {
    expect(noteContent({ ...newNote(), labels: ['A', 'a', 'B'] })).toMatchObject({ labels: ['A', 'B'] });
    expect(noteContent(newNote())).toMatchObject({ labels: [] });
  });
});

describe('notes manager model', () => {
  it('reads block text from note HTML for previews and search', () => {
    expect(notePreviewText('<h1>Plan</h1><p>First&nbsp;line<br>second</p><ul><li>one</li><li>two</li></ul><img src="x">')).toBe('Plan\nFirst line\nsecond\none\ntwo');
    expect(matchesSearch({ ...newNote(), title: 'Groceries', labels: ['Home'], checklist: [{ id: '1', text: 'Milk', isDone: false }] }, 'milk')).toBe(true);
    expect(matchesSearch({ ...newNote(), labels: ['Home'] }, 'home')).toBe(true);
  });
  it('separates archive and trash from every other view', () => {
    const rows = [entry({ id: 'a', title: 'active' }), entry({ id: 'b', archivedAt: '2026-01-01T00:00:00Z' }), entry({ id: 'c', deletedAt: '2026-01-01T00:00:00Z', archivedAt: '2026-01-01T00:00:00Z' }), entry({ id: 'd', labels: ['Work/Q4'], pinned: true })];
    expect(visibleEntries(rows, { filter: 'all' }).map(row => row.note.id).sort()).toEqual(['a', 'd']);
    expect(visibleEntries(rows, { filter: 'archive' }).map(row => row.note.id)).toEqual(['b']);
    expect(visibleEntries(rows, { filter: 'trash' }).map(row => row.note.id)).toEqual(['c']);
    expect(visibleEntries(rows, { filter: 'all', label: 'work' }).map(row => row.note.id)).toEqual(['d']);
    expect(visibleEntries(rows, { filter: 'pinned' }).map(row => row.note.id)).toEqual(['d']);
    expect(visibleEntries([...rows, entry({ id: 'e' }, { shared: true })], { filter: 'shared' }).map(row => row.note.id)).toEqual(['e']);
  });
  it('splits Pinned and Others only when something is pinned', () => {
    const pinned = entry({ id: 'p', pinned: true }), other = entry({ id: 'o' });
    expect(managerSections([pinned, other], 'all').map(section => [section.key, section.entries.map(row => row.note.id)])).toEqual([['pinned', ['p']], ['others', ['o']]]);
    expect(managerSections([other], 'all').map(section => section.key)).toEqual(['all']);
    expect(managerSections([pinned, other], 'recent').map(section => section.key)).toEqual(['all']);
  });
  it('toggles single cards and selects shift ranges in display order', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(selectRange(order, [], null, 'b', false)).toEqual(['b']);
    expect(selectRange(order, ['b'], 'b', 'b', false)).toEqual([]);
    expect(selectRange(order, ['b'], 'b', 'd', true)).toEqual(['b', 'c', 'd']);
    expect(selectRange(order, ['d'], 'd', 'a', true).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
