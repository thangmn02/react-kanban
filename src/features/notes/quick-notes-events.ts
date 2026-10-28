export const OPEN_QUICK_NOTES='kora:open-quick-notes';
export const OPEN_SAVED_CONTEXT='kora:open-saved-context';
export interface QuickNotesRequest {taskId?:string;boardId?:string;noteId?:string;personal?:boolean;create?:boolean}
export const openQuickNotes=(request:QuickNotesRequest={})=>window.dispatchEvent(new CustomEvent(OPEN_QUICK_NOTES,{detail:request}));
export const openSavedContext=()=>window.dispatchEvent(new Event(OPEN_SAVED_CONTEXT));
