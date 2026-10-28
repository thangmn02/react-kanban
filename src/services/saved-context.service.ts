import {requireSupabaseClient} from '../lib/supabase';
import type {AppUser} from '../types/auth.type';
import type {SavedContextItem,SavedReference,SavedResourceType,SavedSource,TaskComment} from '../types/saved-context.type';
import {browserWorkflowRecord} from '../features/notes/notes-browser-storage';
import {readDurableDeviceNotes} from '../features/notes/notes-store';
import {localFetchAllTasks,localFetchAllLists,localFetchBoards} from '../infrastructure/local/localBoardStore';

export const SAVED_CONTEXT_CHANGED='kora:saved-context-changed';
const changed=()=>window.dispatchEvent(new Event(SAVED_CONTEXT_CHANGED));
export async function assertWorkflowAccount(user:AppUser){if(user.isMock)return;const {data,error}=await requireSupabaseClient().auth.getSession();if(error||data.session?.user.id!==user.id)throw Error('The signed-in account changed. Reopen the original in your current account.');}
function checked<T>({data,error}:{data:T;error:{message:string;code?:string}|null}){if(error)throw Object.assign(Error(error.message),{code:error.code});return data;}
const savedKey=(user:AppUser)=>`saved-context:${user.id}`;
const commentsKey=(user:AppUser,workspaceId:string,taskId:string)=>`task-comments:${user.id}:${workspaceId}:${taskId}`;
function localTask(taskId:string,workspaceId:string|null):SavedSource|null{
  const task=localFetchAllTasks(workspaceId).find(row=>row.id===taskId);if(!task)return null;
  if(!localFetchAllLists(task.workspace_id).some(row=>row.id===task.list_id)||!localFetchBoards(task.workspace_id).some(row=>row.id===task.board_id))return null;
  return{label:task.title,workspaceId:task.workspace_id,taskId:task.id,boardId:task.board_id};
}
async function localSource(user:AppUser,reference:SavedReference):Promise<SavedSource|null>{
  if(reference.resourceType==='task')return localTask(reference.resourceId,reference.workspaceId??null);
  if(reference.resourceType==='note'){const note=(await readDurableDeviceNotes({userId:user.id,workspaceId:reference.workspaceId??null})).find(row=>row.id===reference.resourceId&&!row.deletedAt);return note?{label:note.title||'Untitled note',workspaceId:reference.workspaceId??null,noteId:note.id}:null;}
  if(reference.resourceType==='task_comment'&&reference.workspaceId){const index=await browserWorkflowRecord<{taskId:string}>(`task-comment-original:${user.id}:${reference.resourceId}`);if(!index)return null;const source=localTask(index.taskId,reference.workspaceId);if(!source)return null;const comment=(await browserWorkflowRecord<TaskComment[]>(commentsKey(user,reference.workspaceId,index.taskId)))?.find(row=>row.id===reference.resourceId&&!row.deleted_at);return comment?{...source,commentId:comment.id,preview:comment.body.slice(0,300)}:null;}
  return null;
}
export async function fetchSavedContext(user:AppUser):Promise<SavedContextItem[]>{
  await assertWorkflowAccount(user);
  if(user.isMock){const references=await browserWorkflowRecord<SavedReference[]>(savedKey(user))??[];return Promise.all(references.map(async reference=>({...reference,source:await localSource(user,reference)})));}
  const rows=checked(await requireSupabaseClient().rpc('list_saved_context',{actor_user_id:user.id})) as unknown as SavedContextItem[];await assertWorkflowAccount(user);return rows;
}
export async function setSavedContext(user:AppUser,resourceType:SavedResourceType,resourceId:string,saved:boolean,workspaceId:string|null){
  await assertWorkflowAccount(user);
  if(user.isMock){const reference={resourceType,resourceId,savedAt:new Date().toISOString(),workspaceId};if(saved&&!await localSource(user,reference))throw Error('The original is unavailable.');await browserWorkflowRecord<SavedReference[]>(savedKey(user),previous=>{const rows=previous??[],existing=rows.some(row=>row.resourceType===resourceType&&row.resourceId===resourceId);if(saved&&existing)return rows;if(saved&&rows.length>=500)throw Error('Saved Context is full. Remove unused references first.');return saved?[reference,...rows]:rows.filter(row=>row.resourceType!==resourceType||row.resourceId!==resourceId);});}
  else checked(await requireSupabaseClient().rpc('set_saved_context',{request:{actorUserId:user.id,resourceType,resourceId,saved}}));
  await assertWorkflowAccount(user);changed();
}
export async function fetchTaskComments(user:AppUser,workspaceId:string,taskId:string):Promise<TaskComment[]>{
  await assertWorkflowAccount(user);
  if(user.isMock){if(!localTask(taskId,workspaceId))return[];return(await browserWorkflowRecord<TaskComment[]>(commentsKey(user,workspaceId,taskId))??[]).filter(row=>!row.deleted_at);}
  const rows=checked(await requireSupabaseClient().from('task_comments').select('*').eq('task_id',taskId).eq('workspace_id',workspaceId).order('created_at'))??[];await assertWorkflowAccount(user);return rows;
}
export async function mutateTaskComment(user:AppUser,workspaceId:string,taskId:string,operation:{id:string;token:string;action:'create'|'edit'|'delete';body:string;expectedRevision:number}):Promise<TaskComment>{
  await assertWorkflowAccount(user);let comment:TaskComment;
  if(user.isMock){if(!localTask(taskId,workspaceId))throw Error('The original task is unavailable.');const rows=await browserWorkflowRecord<TaskComment[]>(commentsKey(user,workspaceId,taskId),previous=>{const rows=previous??[],current=rows.find(row=>row.id===operation.id);if(current?.write_token===operation.token)return rows;if(current&&(current.revision!==operation.expectedRevision||operation.action==='create'||current.deleted_at))throw Error('This comment changed. Reopen its original.');if(!current&&operation.action!=='create')throw Error('This comment is unavailable.');const body=operation.body.trim();if(operation.action!=='delete'&&(!body||body.length>4000))throw Error('Comments must contain 1–4000 characters.');const now=new Date().toISOString(),next:TaskComment={id:operation.id,task_id:taskId,workspace_id:workspaceId,author_user_id:user.id,body:operation.action==='delete'?current!.body:body,revision:(current?.revision??0)+1,write_token:operation.token,created_at:current?.created_at??now,updated_at:now,deleted_at:operation.action==='delete'?now:null};return current?rows.map(row=>row.id===next.id?next:row):[...rows,next];});comment=rows!.find(row=>row.id===operation.id)!;await browserWorkflowRecord(`task-comment-original:${user.id}:${comment.id}`,()=>({taskId}));}
  else comment=checked(await requireSupabaseClient().rpc('mutate_task_comment',{request:{id:operation.id,taskId,actorUserId:user.id,action:operation.action,body:operation.body,expectedRevision:operation.expectedRevision,writeToken:operation.token}})) as unknown as TaskComment;
  await assertWorkflowAccount(user);changed();return comment;
}
