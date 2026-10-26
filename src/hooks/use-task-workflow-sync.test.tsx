import { act,renderHook,waitFor } from '@testing-library/react';
import { beforeEach,expect,it,vi } from 'vitest';
import type { TaskRow } from '../types/supabase.type';
import type { FocusSessionValue } from '../features/focus/useFocusSessionController';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../lib/supabase',()=>({default:null}));
vi.mock('../services/task.service',()=>({fetchTasks:mocks.fetch}));
import { useTaskWorkflowSync } from './use-task-workflow-sync';
import { TASK_WORKFLOW_CHANGED } from '../services/task-workflow.service';
beforeEach(()=>{vi.clearAllMocks();});
function focus(){return {focusTasks:[{id:'task',boardId:'board',title:'Old'}],timerState:{activeTaskId:'task',isRunning:true,mode:'focus'},updateFocusedTask:vi.fn(),removeFocusTask:vi.fn(),pauseTimer:vi.fn()} as unknown as FocusSessionValue;}
function row(done=false){return {id:'task',workspace_id:'workspace',board_id:'board',list_id:'list',title:'Work',is_done:done} as TaskRow;}
it('does not let an older snapshot undo a newer completion event',async()=>{
 let resolve!:(rows:TaskRow[])=>void;mocks.fetch.mockReturnValueOnce(new Promise(r=>{resolve=r;}));const current=focus();const hook=renderHook(()=>useTaskWorkflowSync('workspace','user',current));
 act(()=>window.dispatchEvent(new CustomEvent(TASK_WORKFLOW_CHANGED,{detail:{task:row(true)}})));
 expect(current.updateFocusedTask).toHaveBeenLastCalledWith('task',expect.objectContaining({isDone:true}));
 await act(async()=>resolve([row(false)]));expect(current.updateFocusedTask).toHaveBeenCalledOnce();expect(current.pauseTimer).toHaveBeenCalledOnce();hook.unmount();
});
it('removes a deleted local cross-tab task and pauses its active timer',async()=>{
 mocks.fetch.mockResolvedValueOnce([row()]).mockResolvedValueOnce([]);const current=focus();const hook=renderHook(()=>useTaskWorkflowSync('workspace','user',current));await waitFor(()=>expect(current.updateFocusedTask).toHaveBeenCalledOnce());
 act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'kanban:user:workspace:board_store:v1'})));await waitFor(()=>expect(current.removeFocusTask).toHaveBeenCalledWith('task'));expect(current.pauseTimer).toHaveBeenCalledOnce();hook.unmount();
});
it('ignores a snapshot returned after leaving its workspace',async()=>{
 let resolve!:(rows:TaskRow[])=>void;mocks.fetch.mockReturnValueOnce(new Promise(r=>{resolve=r;})).mockResolvedValueOnce([]);const current=focus();const hook=renderHook(({workspace})=>useTaskWorkflowSync(workspace,'user',current),{initialProps:{workspace:'workspace'}});
 hook.rerender({workspace:'other'});await act(async()=>resolve([row(true)]));expect(current.updateFocusedTask).not.toHaveBeenCalled();hook.unmount();
});
