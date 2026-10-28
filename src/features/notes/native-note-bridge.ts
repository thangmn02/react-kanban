import { invoke, isTauri } from '@tauri-apps/api/core';
import type { StickyNote } from './notes-store';
import { readBrowserDrafts,writeBrowserDraft,removeBrowserDraft } from './notes-browser-storage';

export const nativeNotesControl = <T = unknown>(action: string, payload: unknown = null) => invoke<T>('native_notes_control', { action, payload });
export const nativeNoteRequest = <T = unknown>(action: string, payload: unknown = null) => invoke<T>('native_note_request', { action, payload });
export const writeNativeDraft = (key: string, value: string) => isTauri() ? nativeNotesControl('journal_write', { key, value }) : writeBrowserDraft(key,value);
export const retireNativeDraft = async(key: string, expected: string) => {
  const retired=isTauri()?(await nativeNotesControl<{retired:boolean}>('journal_remove',{key,expected})).retired:await removeBrowserDraft(key,expected);
  if(!retired)throw Error('This retained draft changed before it could be retired. Its newer version is preserved.');
};
export const readStoredNoteDrafts = async(prefix:string)=>{
  if(!isTauri())return readBrowserDrafts(prefix);
  const scope=prefix.split(':')[3];const journal=await nativeNotesControl<{records:{key:string;value:string}[]}>('journal_read',{scope});return journal.records.filter(record=>record.key.startsWith(prefix));
};
export const writeDeviceDraft=(scope:string,key:string,value:string)=>isTauri()?nativeNotesControl('local_draft_write',{scope,key,value}):writeBrowserDraft(key,value);
export const readDeviceDrafts=async(scope:string,prefix:string)=>isTauri()?(await nativeNotesControl<{records:{key:string;value:string}[]}>('local_drafts',{scope})).records:readBrowserDrafts(prefix);
export const retireDeviceDraft=async(scope:string,key:string,expected:string)=>{const retired=isTauri()?await nativeNotesControl<boolean>('local_draft_remove',{scope,key,expected}):await removeBrowserDraft(key,expected);if(!retired)throw Error('This retained device draft changed. Its newer version is preserved.');};
export interface NativeNoteContext { userId: string; workspaceId: string | null; noteId: string; local: boolean }
export interface NativeNoteFlags { alwaysOnTop: boolean; opacity:number; collapsed: boolean; ghost: boolean; peek: boolean }
export interface NativeNoteSnapshot { note: StickyNote; readOnly: boolean; status: string; error: string; conflict: boolean }
