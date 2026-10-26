import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase',()=>({default:null,requireSupabaseClient:vi.fn()}));
import { localCreateBoardFromTemplate, localCreateTasks, localFetchBoardSnapshot, localFetchBoardActivities, resetLocalBoardStore } from '../infrastructure/local/localBoardStore';
import { transitionTaskWorkflow } from './task-workflow.service';
import { auditTaskConsistency } from '../features/task/model/task-workflow';

const workspaceId='local-mock-workspace';
beforeEach(()=>{localStorage.clear();resetLocalBoardStore();});
function setup(templateId='simple-kanban'){
 const board=localCreateBoardFromTemplate({title:'Workflow',description:'',templateId});
 const snapshot=()=>localFetchBoardSnapshot(board.id,workspaceId);
 const lists=snapshot().listRows.sort((a,b)=>a.position-b.position);
 const task=localCreateTasks([{board_id:board.id,list_id:lists[0].id,workspace_id:workspaceId,title:'Work',description:'<p>Read</p><p>Write</p>',priority:'High',due_date:'2026-10-26',repeat_interval:'daily'}])[0];
 const run=(kind:'complete'|'reopen'|'move',extra:Partial<Parameters<typeof transitionTaskWorkflow>[0]>={})=>transitionTaskWorkflow({taskId:task.id,boardId:board.id,workspaceId,kind,...extra});
 return {board,task,lists,snapshot,run};
}
it.each([0,1])('completes from active column %i with persisted timestamp, membership, counts and one recurrence',async index=>{
 const x=setup();if(index)await x.run('move',{destinationListId:x.lists[index].id,destinationIndex:0});
 const result=await x.run('complete');expect(result.task).toMatchObject({is_done:true,list_id:x.lists[2].id});expect(result.task.completed_at).toBeTruthy();
 const rows=x.snapshot().taskRows;expect(rows.filter(t=>t.list_id===x.lists[2].id)).toHaveLength(1);expect(rows.find(t=>t.id===result.occurrence?.id)).toMatchObject({is_done:false,list_id:x.lists[0].id,due_date:'2026-10-27'});
 const activities=localFetchBoardActivities(x.board.id);expect(activities.filter(a=>a.action==='status_change')).toHaveLength(1);
});
it('moves into Done, reopens into Doing and restores history without changing other fields',async()=>{
 const x=setup();const counts=()=>x.lists.map(list=>x.snapshot().taskRows.filter(task=>task.list_id===list.id).length);
 await x.run('move',{destinationListId:x.lists[1].id,destinationIndex:0});expect(counts()).toEqual([0,1,0]);
 const done=await x.run('move',{destinationListId:x.lists[2].id,destinationIndex:0});expect(done.task.is_done).toBe(true);expect(counts()).toEqual([1,0,1]);
 const reopened=await x.run('reopen');expect(reopened.task).toMatchObject({list_id:x.lists[1].id,is_done:false,completed_at:null,priority:'High',description:x.task.description});expect(counts()).toEqual([1,1,0]);
 await x.run('complete');expect(counts()).toEqual([1,0,1]);expect(x.snapshot().taskRows).toHaveLength(2);
 const moved=await x.run('move',{destinationListId:x.lists[0].id,destinationIndex:0});expect(moved.task.is_done).toBe(false);expect(counts()).toEqual([2,0,0]);
});
it('deduplicates simultaneous completion and repeat requests',async()=>{
 const x=setup();const results=await Promise.all([x.run('complete'),x.run('complete'),x.run('complete')]);
 expect(results.filter(r=>r.completedTransition)).toHaveLength(1);expect(x.snapshot().taskRows).toHaveLength(2);
 expect(localFetchBoardActivities(x.board.id).filter(a=>a.action==='status_change')).toHaveLength(1);
});
it('rejects stale moves and a different workspace without changing persisted data',async()=>{
 const x=setup();await x.run('complete');const before=JSON.stringify(x.snapshot());
 await expect(x.run('move',{destinationListId:x.lists[1].id,expectedListId:x.lists[0].id})).rejects.toThrow('moved elsewhere');
 await expect(x.run('reopen',{workspaceId:'other'})).rejects.toThrow('workspace');expect(JSON.stringify(x.snapshot())).toBe(before);
});
it('keeps custom boards in explicit completion-only mode',async()=>{
 const x=setup('presentation');const done=await x.run('complete');expect(done.mapping).toBe('completion-only');expect(done.task.list_id).toBe(x.lists[0].id);
 await x.run('move',{destinationListId:x.lists.at(-1)!.id,destinationIndex:0});expect(x.snapshot().taskRows.find(t=>t.id===x.task.id)?.is_done).toBe(true);
});
it('fails without permanent success or lost unrelated data when the storage commit fails',async()=>{
 const x=setup();const before=JSON.stringify(x.snapshot());const original=localStorage.setItem.bind(localStorage);
 const failing=vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{if(key.endsWith(':board_store:v1'))throw new DOMException('Full','QuotaExceededError');return original(key,value);});
 await expect(x.run('complete')).rejects.toThrow();failing.mockRestore();expect(JSON.stringify(x.snapshot())).toBe(before);
 expect(localStorage.getItem('kanban:mock-user:local-mock-workspace:workflow_backup:v1')).toBeTruthy();
});
it('reports historical anomalies and proposed corrections without editing them',()=>{
 const x=setup();const snap=x.snapshot();const tasks=snap.taskRows.map(t=>({...t,is_done:true,completed_at:null}));const before=JSON.stringify(tasks);
 const audit=auditTaskConsistency(snap.listRows,tasks);expect(audit.counts).toMatchObject({'completed-in-active-list':1,'completion-timestamp-mismatch':1});expect(JSON.stringify(tasks)).toBe(before);
});
