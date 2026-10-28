export type SavedResourceType='task'|'task_comment'|'note'|'note_comment';
export interface SavedReference {resourceType:SavedResourceType;resourceId:string;savedAt:string;workspaceId?:string|null}
export interface SavedSource {label:string;preview?:string;workspaceId:string|null;taskId?:string;boardId?:string;noteId?:string;commentId?:string}
export interface SavedContextItem extends SavedReference {source:SavedSource|null}
export type TaskComment = {id:string;task_id:string;workspace_id:string;author_user_id:string|null;body:string;revision:number;write_token:string;created_at:string;updated_at:string;deleted_at:string|null};
