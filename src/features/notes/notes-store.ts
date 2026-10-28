import { buildStorageKey, type StorageScope } from '../../shared/storage/storageAdapter';
import type { TaskChecklistItem } from '../../types/task.type';
import { isTauri } from '@tauri-apps/api/core';
import { nativeNotesControl } from './native-note-bridge';
import { readBrowserNotes, saveBrowserNote } from './notes-browser-storage';

export interface StickyNote {
  id: string; title: string; html: string; checklist: TaskChecklistItem[];
  pinned: boolean; minimized: boolean; peek: boolean; expanded: boolean;
  x: number; y: number; width: number; height: number;
  taskId: string | null; taskBoardId: string | null; convertedTaskId: string | null;
  revision: number; writeToken: string; updatedAt: string;
  opacity?: number; color?: 'paper' | 'mint' | 'sky' | 'rose' | 'slate'; fontSize?: number;
  floating?: boolean; hidden?: boolean; collapsed?: boolean; clickThrough?: boolean;
  bubbleX?: number; bubbleY?: number; headerVisible?: boolean; deletedAt?: string | null;
}
export const NOTES_CHANGED = 'kora:notes-changed';
export const notesKey = (scope: StorageScope) => buildStorageKey(scope, 'notes-preview');
/** Serialize the entire scoped snapshot, including edits to different notes. */
export async function saveNoteSafely(scope: StorageScope, note: StickyNote, expectedRevision?: number, expectedToken?: string): Promise<StickyNote[]> {
  if (isTauri()) {
    const rows = await nativeNotesControl<StickyNote[]>('local_save', { scope: scope.workspaceId ?? 'personal', seed: readNotes(scope), note: { ...note, updatedAt: new Date().toISOString() }, expectedRevision: expectedRevision ?? null, expectedToken: expectedToken ?? note.writeToken });
    try{localStorage.setItem(notesKey(scope), JSON.stringify(rows));}catch{/* The native canonical document is already durable. */} window.dispatchEvent(new CustomEvent(NOTES_CHANGED, { detail: { key: notesKey(scope) } })); return rows;
  }
  const rows=await saveBrowserNote(notesKey(scope),note,expectedRevision,expectedToken??note.writeToken,()=>readNotes(scope));
  try{const before=localStorage.getItem(notesKey(scope));if(before!==null)localStorage.setItem(`${notesKey(scope)}:backup`,before);localStorage.setItem(notesKey(scope),JSON.stringify(rows));}catch{/* IndexedDB commit is authoritative; a full legacy mirror must not erase it. */}
  window.dispatchEvent(new CustomEvent(NOTES_CHANGED,{detail:{key:notesKey(scope)}}));return rows;
}
export async function readDurableDeviceNotes(scope:StorageScope):Promise<StickyNote[]>{
  if(isTauri())return nativeNotesControl<StickyNote[]>('local_read',{scope:scope.workspaceId??'personal',seed:readNotes(scope)});
  return readBrowserNotes(notesKey(scope),()=>readNotes(scope));
}
export function readNotes(scope: StorageScope): StickyNote[] {
  const stored = localStorage.getItem(notesKey(scope));
  if (!stored) return [];
  const rows: unknown = JSON.parse(stored);
  if (!Array.isArray(rows) || rows.some(note => !note || typeof note.id !== 'string' || typeof note.html !== 'string' || typeof note.revision !== 'number' || !Array.isArray(note.checklist))) throw Error('The saved Notes preview could not be read. Your data has been retained.');
  return (rows as StickyNote[]).map(note => ({ ...note, writeToken: note.writeToken || `legacy:${note.revision}` }));
}
export function saveNote(scope: StorageScope, note: StickyNote, expectedRevision?: number, expectedToken = note.writeToken): StickyNote[] {
  const key = notesKey(scope), before = localStorage.getItem(key), rows = readNotes(scope), current = rows.find(row => row.id === note.id);
  if (expectedRevision !== undefined && (current?.revision !== expectedRevision || current?.writeToken !== expectedToken)) throw Error('This note changed in another tab. Reload Notes before editing again.');
  if (note.title.length > 160 || note.html.length > 60000 || note.checklist.length > 100 || rows.length >= 50 && !current) throw Error('Notes preview storage limit reached. Shorten the note or reuse an existing note.');
  const next = { ...note, writeToken: note.writeToken === current?.writeToken ? crypto.randomUUID() : note.writeToken, width: Math.max(260, Math.min(900, note.width)), height: Math.max(280, Math.min(900, note.height)), x: Math.max(0, note.x), y: Math.max(0, note.y), revision: (current?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
  const result = current ? rows.map(row => row.id === note.id ? next : row) : [...rows, next];
  if (before !== null) localStorage.setItem(`${key}:backup`, before);
  localStorage.setItem(key, JSON.stringify(result));
  window.dispatchEvent(new CustomEvent(NOTES_CHANGED, { detail: { key } }));
  return result;
}
export function newNote(index = 0): StickyNote {
  return { id: crypto.randomUUID(), title: '', html: '', checklist: [], pinned: false, minimized: false, peek: false, expanded: false, x: (index % 3) * 330, y: Math.floor(index / 3) * 390, width: 310, height: 360, taskId: null, taskBoardId: null, convertedTaskId: null, revision: 0, writeToken: crypto.randomUUID(), updatedAt: new Date().toISOString() };
}
