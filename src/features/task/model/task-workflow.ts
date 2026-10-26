import type { ListRow, TaskActivityRow, TaskRow } from '../../../types/supabase.type';

export interface WorkflowRequest {
  taskId: string; boardId: string; workspaceId: string | null;
  kind: 'complete' | 'reopen' | 'move'; operationId: string;
  destinationListId?: string; destinationIndex?: number;
  expectedListId?: string; expectedUpdatedAt?: string;
}
export interface WorkflowResult {
  task: TaskRow; changed: boolean; completedTransition: boolean;
  mapping: 'standard' | 'completion-only'; occurrence: TaskRow | null;
}
const normalize = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');
export const workflowCompletionState=(kind:WorkflowRequest['kind'],doneListId:string|null,destination:string|undefined,current:boolean)=>kind==='complete'?true:kind==='reopen'?false:doneListId?destination===doneListId:current;
export function resolveTaskWorkflow(lists: Pick<ListRow, 'id' | 'title' | 'position'>[]) {
  const ordered = [...lists].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const shape = ordered.map(list => normalize(list.title)).join('/');
  const standard = shape === 'todo/doing/done' || shape === 'backlog/inprogress/nearlydone/done';
  return { mode: standard ? 'standard' as const : 'completion-only' as const,
    doneListId: standard ? ordered.at(-1)!.id : null, activeListId: standard ? ordered[0].id : null };
}
export function planTaskWorkflow(task: TaskRow, lists: ListRow[], tasks: TaskRow[], activities: TaskActivityRow[], request: WorkflowRequest, now: string) {
  if (task.board_id !== request.boardId || task.workspace_id !== request.workspaceId || task.deleted_at || task.archived_at) throw new Error('Task is unavailable in this workspace.');
  if (request.expectedListId && task.list_id !== request.expectedListId) throw new Error('Task moved elsewhere. Reload and try again.');
  if (request.expectedUpdatedAt && task.updated_at !== request.expectedUpdatedAt) throw new Error('Task changed elsewhere. Reload and try again.');
  const policy = resolveTaskWorkflow(lists);
  const history = [...activities].reverse().find(activity => {
    const d = activity.details as Record<string, unknown>;
    return activity.task_id === task.id && d.workflowTransition === true && d.fromCompleted === false && d.toCompleted === true;
  })?.details as Record<string, unknown> | undefined;
  let listId = task.list_id, index = request.destinationIndex;
  const isDone = workflowCompletionState(request.kind,policy.doneListId,request.destinationListId,task.is_done);
  if (request.kind === 'move') listId = request.destinationListId || '';
  else if (policy.doneListId && isDone) listId = policy.doneListId;
  else if (policy.doneListId && task.list_id === policy.doneListId) {
    listId = typeof history?.fromListId === 'string' && lists.some(list => list.id === history.fromListId && list.id !== policy.doneListId)
      ? history.fromListId : policy.activeListId!;
    index = listId === history?.fromListId && typeof history.fromIndex === 'number' ? history.fromIndex : undefined;
  }
  if (!lists.some(list => list.id === listId)) throw new Error('Destination list is unavailable in this board.');
  const ordered = (id: string) => tasks.filter(t => t.list_id === id && !t.deleted_at && !t.archived_at).sort((a,b) => a.position-b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const sourceIndex = ordered(task.list_id).findIndex(t => t.id === task.id);
  const destination = ordered(listId).filter(t => t.id !== task.id);
  const targetIndex = Math.max(0, Math.min(destination.length, Math.trunc(index ?? (listId === task.list_id ? sourceIndex : destination.length))));
  const completedAt = isDone ? task.completed_at || now : null;
  return { listId, targetIndex, sourceIndex, isDone, completedAt, policy,
    changed: listId !== task.list_id || targetIndex !== sourceIndex || isDone !== task.is_done || completedAt !== task.completed_at };
}

export function auditTaskConsistency(lists: ListRow[], tasks: TaskRow[]) {
  const anomalies: { taskId: string; type: string; before: Pick<TaskRow,'is_done'|'list_id'|'position'|'completed_at'|'updated_at'>; proposed: Record<string, unknown> | null }[] = [];
  for (const task of tasks.filter(t => !t.deleted_at && !t.archived_at)) {
    const boardLists = lists.filter(l => l.board_id === task.board_id && !l.archived_at);
    const policy = resolveTaskWorkflow(boardLists);
    const before = { is_done: task.is_done, list_id: task.list_id, position: task.position, completed_at: task.completed_at, updated_at: task.updated_at };
    const add = (type: string, proposed: Record<string, unknown> | null) => anomalies.push({taskId:task.id,type,before,proposed});
    if (!boardLists.some(l=>l.id===task.list_id)) add('missing-list',null);
    if (policy.doneListId && task.is_done && task.list_id !== policy.doneListId) add('completed-in-active-list',{kind:'complete',destinationListId:policy.doneListId});
    if (policy.doneListId && !task.is_done && task.list_id === policy.doneListId) add('active-in-done-list',{kind:'complete',requiresDecision:true});
    if (task.is_done !== Boolean(task.completed_at)) add('completion-timestamp-mismatch',{kind:task.is_done?'complete':'reopen',timestampIsHistorical:false});
    if (!Number.isFinite(task.position) || task.position < 0) add('invalid-position',null);
    if (tasks.some(t=>t.id!==task.id&&t.list_id===task.list_id&&t.position===task.position&&!t.deleted_at&&!t.archived_at)) add('duplicate-position',null);
  }
  return { counts: anomalies.reduce<Record<string,number>>((counts,a)=>({...counts,[a.type]:(counts[a.type]||0)+1}),{}), anomalies };
}
