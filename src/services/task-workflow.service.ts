import supabase, { requireSupabaseClient } from '../lib/supabase';
import { localTransitionTaskWorkflow } from '../infrastructure/local/localBoardStore';
import type { WorkflowRequest, WorkflowResult } from '../features/task/model/task-workflow';
import type { Json } from '../types/supabase.type';

export const TASK_WORKFLOW_CHANGED = 'kora:task-workflow-changed';
export async function transitionTaskWorkflow(input: Omit<WorkflowRequest,'operationId'> & {operationId?:string}): Promise<WorkflowResult> {
  const request:WorkflowRequest={...input,operationId:input.operationId||crypto.randomUUID()};
  const execute=async()=>{
    let result:WorkflowResult;
    if(!supabase) result=localTransitionTaskWorkflow(request);
    else {
      const {data,error}=await requireSupabaseClient().rpc('transition_task_workflow',{
        request:request as unknown as Json,
      });
      if(error) throw new Error(`Task transition was not confirmed. Reload to reconcile. ${error.message}`);
      if(!data) throw new Error('Task transition was not confirmed. Reload to reconcile.');
      result=data as unknown as WorkflowResult;
    }
    if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent(TASK_WORKFLOW_CHANGED,{detail:{boardId:request.boardId,workspaceId:request.workspaceId,task:result.task}}));
    return result;
  };
  if(!supabase && typeof navigator!=='undefined' && navigator.locks) return navigator.locks.request('kora:local-task-workflow',execute);
  return execute();
}
