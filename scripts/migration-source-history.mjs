import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
/** Preserve committed byte identities; admit only proven CRLF-to-LF checkout normalization. */
export async function verifyMigrationSourceHistory(recorded,current,readHistorical){
 assert.deepEqual(current.map(row=>row.name),recorded.map(row=>row.name),'Migration names/order differ from committed history.');
 const normalized=[];
 for(let i=0;i<current.length;i++){
  const source=current[i],history=recorded[i];if(digest(source.bytes)===history.sha256)continue;
  assert.ok(readHistorical,'Committed source bytes differ; supply the original history-source directory for explicit EOL verification.');
  const previous=await readHistorical(history.name);assert.equal(digest(previous),history.sha256,'Historical file does not match the committed receipt.');
  const canonical=Buffer.from(previous.toString('utf8').replaceAll('\r\n','\n'));
  assert.ok(previous.includes(Buffer.from('\r\n'))&&source.bytes.equals(canonical),'Migration content changed beyond CRLF-to-LF normalization.');
  normalized.push({name:source.name,committedSha256:history.sha256,checkoutSha256:digest(source.bytes)});
 }
 return normalized;
}
