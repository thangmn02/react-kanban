import type {NativeNoteContext} from './native-note-bridge';
export const DETACH_NOTE='kora:detach-note';
export function detachNote(context:NativeNoteContext){window.dispatchEvent(new CustomEvent(DETACH_NOTE,{detail:context}));}
