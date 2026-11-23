import type { StickyNote } from './notes-store';
import { hasLabel, normalizeLabels } from './note-labels';

export type ManagerFilter = 'all' | 'pinned' | 'recent' | 'shared' | 'archive' | 'trash';
export const managerFilters: readonly ManagerFilter[] = ['all', 'pinned', 'recent', 'shared', 'archive', 'trash'];
export const asManagerFilter = (value: string | null | undefined): ManagerFilter => managerFilters.includes(value as ManagerFilter) ? value as ManagerFilter : 'all';

export interface ManagerEntry {
  note: StickyNote;
  /** Content edits are not allowed (view/comment permission, conflict or discard in progress). */
  readOnly: boolean;
  canArchive: boolean;
  canTrash: boolean;
  /** Connected notes the user does not own or that are visible to the workspace. */
  shared?: boolean;
}

/** Plain text of a note body, one line per block, for cards and search. */
export function notePreviewText(html: string): string {
  if (!html) return '';
  const blocks = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h[1-6]|div|pre|blockquote|tr)>/gi, '\n').replace(/<img\b[^>]*>/gi, '');
  const text = typeof DOMParser === 'undefined' ? blocks.replace(/<[^>]+>/g, '') : new DOMParser().parseFromString(blocks, 'text/html').body.textContent ?? '';
  return text.split('\n').map(line => line.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function matchesSearch(note: StickyNote, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;
  return `${note.title}\n${notePreviewText(note.html)}\n${note.checklist.map(item => item.text).join('\n')}\n${normalizeLabels(note.labels).join('\n')}`.toLocaleLowerCase().includes(query);
}

/** Notes shown in the active view: Trash and Archive are separate; every other view hides both. */
export function visibleEntries(entries: readonly ManagerEntry[], view: { filter: ManagerFilter; label?: string | null; search?: string }): ManagerEntry[] {
  const { filter, label, search = '' } = view;
  const rows = entries.filter(({ note, shared }) => {
    if (filter === 'trash') return !!note.deletedAt;
    if (note.deletedAt) return false;
    if (filter === 'archive') { if (!note.archivedAt) return false; }
    else if (note.archivedAt) return false;
    if (filter === 'pinned' && !note.pinned) return false;
    if (filter === 'shared' && !shared) return false;
    if (label && !hasLabel(note.labels, label)) return false;
    return matchesSearch(note, search);
  });
  return rows.sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));
}

/** Pinned first, then Others. Recent, Archive and Trash are one list ordered by last change. */
export function managerSections(rows: readonly ManagerEntry[], filter: ManagerFilter): { key: 'pinned' | 'others' | 'all'; entries: ManagerEntry[] }[] {
  if (filter === 'recent' || filter === 'archive' || filter === 'trash' || filter === 'pinned') return [{ key: 'all', entries: [...rows] }];
  const pinned = rows.filter(entry => entry.note.pinned), others = rows.filter(entry => !entry.note.pinned);
  if (!pinned.length) return [{ key: 'all', entries: others }];
  return [{ key: 'pinned', entries: pinned }, ...(others.length ? [{ key: 'others' as const, entries: others }] : [])];
}

/** Shift-click selects the range between the last clicked card and this one, in display order. */
export function selectRange(order: readonly string[], selected: readonly string[], anchor: string | null, id: string, range: boolean): string[] {
  if (range && anchor && order.includes(anchor) && order.includes(id)) {
    const [from, to] = [order.indexOf(anchor), order.indexOf(id)].sort((a, b) => a - b);
    return [...new Set([...selected, ...order.slice(from, to + 1)])];
  }
  return selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
}
