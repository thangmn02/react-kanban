import type {NativeNoteContext} from './native-note-bridge';
export const DETACH_NOTE='kora:detach-note';
/** `besideMain` places a new floating note next to the main (dock) window; `replaceLabel` closes that window first. */
export interface DetachRequest extends NativeNoteContext {focus?:boolean;besideMain?:boolean;replaceLabel?:string;done?:(error?:string)=>void}
export function detachNote(request:DetachRequest){window.dispatchEvent(new CustomEvent(DETACH_NOTE,{detail:request}));}
/** Opens a floating note and resolves once its window exists (or rejects with the owner's reason). */
export function floatNote(request:Omit<DetachRequest,'done'>){return new Promise<void>((resolve,reject)=>detachNote({...request,done:error=>error?reject(Error(error)):resolve()}));}
