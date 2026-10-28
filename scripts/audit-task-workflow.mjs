/** Read-only reconciliation preview; never connects to or mutates a database. */
import { readFile } from 'node:fs/promises';
import { auditTaskConsistency } from '../src/features/task/model/task-workflow.ts';
const input=process.argv[2];
if(!input||input==='--help'){
 console.log('Usage: node scripts/audit-task-workflow.mjs snapshot.json\nInput: {lists:[ListRow],tasks:[TaskRow]}, or the linked Supabase query envelope containing rows[0].snapshot. Output is a dry-run JSON preview; no repairs are executed.');
 process.exit(input?0:1);
}
const raw=JSON.parse(await readFile(input,'utf8')),snapshot=raw.rows?.[0]?.snapshot??raw;
if(!Array.isArray(snapshot.lists)||!Array.isArray(snapshot.tasks))throw Error('Expected lists and tasks arrays.');
const audit=auditTaskConsistency(snapshot.lists,snapshot.tasks);
const records=[...new Set(audit.anomalies.map(row=>row.taskId))].map(taskId=>{
 const task=snapshot.tasks.find(row=>row.id===taskId),list=snapshot.lists.find(row=>row.id===task.list_id);
 const findings=audit.anomalies.filter(row=>row.taskId===taskId);
 return {taskId,boardId:task.board_id,workspaceId:task.workspace_id,current:{...findings[0].before,listTitle:list?.title??null},
  findings:findings.map(row=>row.type),proposed:findings.map(row=>row.proposed),
  ambiguity:task.is_done&&!task.completed_at?'Historical completion time is unknown. Do not infer it from updated_at or generate a completion timestamp without a reviewed repair-time decision.':'Confirm intended completion state before repair.',
  reversibility:'Retain this before-image and a restorable backup. Any reviewed repair must compare updated_at and restore membership/positions transactionally; no repair is executed here.'};
});
console.log(JSON.stringify({dryRun:true,generatedAt:new Date().toISOString(),snapshotIsLive:false,...audit,affectedRecords:records},null,2));
