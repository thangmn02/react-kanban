export const OPEN_QUICK_NOTES='kora:open-quick-notes';
export const OPEN_SAVED_CONTEXT='kora:open-saved-context';
/** `create` always starts a new note; a task request reopens that task's latest note. `fromDock` places a floating note beside the Focus Dock; `float` asks for a floating window even when the in-app card is preferred. */
export interface QuickNotesRequest {taskId?:string;boardId?:string;noteId?:string;personal?:boolean;create?:boolean;fromDock?:boolean;float?:boolean}
export const openQuickNotes=(request:QuickNotesRequest={})=>window.dispatchEvent(new CustomEvent(OPEN_QUICK_NOTES,{detail:request}));
export const openSavedContext=()=>window.dispatchEvent(new Event(OPEN_SAVED_CONTEXT));
