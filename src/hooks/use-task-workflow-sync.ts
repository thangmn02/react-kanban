import { useEffect, useRef } from 'react';
import supabase from '../lib/supabase';
import { fetchTasks } from '../services/task.service';
import { TASK_WORKFLOW_CHANGED } from '../services/task-workflow.service';
import type { TaskRow } from '../types/supabase.type';
import type { FocusSessionValue } from '../features/focus/useFocusSessionController';
import { normalizeTaskPriority } from '../utils/boardDataMapper';

export function useTaskWorkflowSync(workspaceId:string|null, userId:string|undefined, focus:FocusSessionValue) {
  const latest=useRef(focus);
  useEffect(()=>{latest.current=focus;},[focus]);
  useEffect(()=>{
    if(!workspaceId||!userId)return;
    let active=true;
    let generation=0;
    const apply=(task:TaskRow)=>{
      if(!active||task.workspace_id!==workspaceId)return;
      const current=latest.current;
      if(task.deleted_at||task.archived_at) {current.removeFocusTask(task.id);if(current.timerState.activeTaskId===task.id&&current.timerState.isRunning)current.pauseTimer();}
      else if(current.focusTasks.some(item=>item.id===task.id)) current.updateFocusedTask(task.id,{isDone:task.is_done,title:task.title,priority:normalizeTaskPriority(task.priority),dueDate:task.due_date||undefined,listId:task.list_id,updatedAt:task.updated_at});
      if(task.is_done&&current.timerState.activeTaskId===task.id&&current.timerState.isRunning&&current.timerState.mode==='focus')current.pauseTimer();
    };
    const event=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.task?.workspace_id===workspaceId){generation+=1;apply(detail.task);}};
    const refresh=()=>{const request=++generation;void fetchTasks({workspaceId}).then(tasks=>{
      if(!active||request!==generation)return;
      const ids=new Set(tasks.map(task=>task.id));
      for(const item of latest.current.focusTasks)if(!ids.has(item.id)){latest.current.removeFocusTask(item.id);if(latest.current.timerState.activeTaskId===item.id&&latest.current.timerState.isRunning)latest.current.pauseTimer();}
      tasks.forEach(apply);
    }).catch(()=>{/* Preserve current state; the next reconnect retries. */});};
    const storage=(event:StorageEvent)=>{if(event.key?.endsWith(':board_store:v1'))refresh();};
    const channel=supabase?.channel(`workflow-${workspaceId}`).on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:`workspace_id=eq.${workspaceId}`},payload=>{
      if(!active)return;
      if(payload.eventType==='DELETE'){generation+=1;latest.current.removeFocusTask(String(payload.old.id));return;}
      const task=payload.new as TaskRow;
      window.dispatchEvent(new CustomEvent(TASK_WORKFLOW_CHANGED,{detail:{workspaceId,boardId:task.board_id,task}}));
    }).subscribe(status=>{if(status==='SUBSCRIBED')refresh();});
    window.addEventListener(TASK_WORKFLOW_CHANGED,event);window.addEventListener('focus',refresh);window.addEventListener('storage',storage);
    refresh();
    return()=>{active=false;window.removeEventListener(TASK_WORKFLOW_CHANGED,event);window.removeEventListener('focus',refresh);window.removeEventListener('storage',storage);if(channel)void channel.unsubscribe();};
  },[workspaceId,userId]);
}
