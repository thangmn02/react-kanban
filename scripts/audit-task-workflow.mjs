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
console.log(JSON.stringify({dryRun:true,generatedAt:new Date().toISOString(),...auditTaskConsistency(snapshot.lists,snapshot.tasks)},null,2));
