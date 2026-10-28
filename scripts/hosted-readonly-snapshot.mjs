import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

/** Own one read-only MVCC snapshot until all dump/verification readers finish. */
export async function hostedReadOnlySnapshot({dockerArgs,env,evidence}){
  const name=`kora-readonly-snapshot-${randomUUID()}`;
  const args=['run','--rm','-i','--name',name,...dockerArgs,'psql','-X','-qAt','--no-password','-v','ON_ERROR_STOP=1'];
  const child=spawn('docker',args,{env,stdio:['pipe','pipe','pipe'],windowsHide:true});
  child.stdin.on('error',()=>{});
  let exited=false;const ended=new Promise(resolve=>{child.once('exit',()=>{exited=true;resolve();});child.once('error',()=>{exited=true;resolve();});});
  const waitForExit=async duration=>{let timer;await Promise.race([ended,new Promise(resolve=>{timer=setTimeout(resolve,duration);})]);clearTimeout(timer);return exited;};
  const close=async()=>{
    if(exited)return;
    child.stdin.end('rollback;\n');
    if(await waitForExit(10000))return;
    const stopped=spawnSync('docker',['stop','--time','5',name],{stdio:'ignore',timeout:15000});
    if(await waitForExit(5000))return;
    child.kill('SIGTERM');await waitForExit(5000);
    throw Error(`Read-only snapshot cleanup was not confirmed for owned container ${name} (stop exit ${stopped.status}); inspect this exact owned container.`);
  };
  let timer;
  try{
    await writeFile(`${evidence}/snapshot-process.json`,JSON.stringify({pid:child.pid,command:'docker run --rm -i [TLS client configuration withheld] psql',container:name,startedAt:new Date().toISOString(),readOnly:true},null,2));
    if(exited)throw Error('Read-only snapshot client exited before setup completed.');
    const id=await new Promise((resolve,reject)=>{
      let output='';timer=setTimeout(()=>reject(Error('Read-only snapshot connection timed out; provider diagnostics withheld.')),25000);
      child.stdout.on('data',chunk=>{output+=chunk.toString();const value=output.trim();if(/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}-\d+$/.test(value))resolve(value);});
      child.stderr.on('data',()=>{});
      child.once('error',()=>reject(Error('Read-only snapshot client could not start.')));
      child.once('exit',()=>reject(Error('Read-only snapshot client exited before exporting its snapshot; provider diagnostics withheld.')));
      child.stdin.write("begin isolation level repeatable read read only; set local idle_in_transaction_session_timeout='10min'; select pg_export_snapshot();\n");
    });
    clearTimeout(timer);return{id,observedAt:new Date().toISOString(),close};
  }catch(error){clearTimeout(timer);await close();throw error;}
}
