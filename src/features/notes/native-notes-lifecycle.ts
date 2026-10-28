let lifecycle=Promise.resolve();
/** Serialize identity setup/teardown without making note frames auth owners. */
export function sequenceNativeNotesLifecycle(operation:()=>Promise<void>){lifecycle=lifecycle.catch(()=>{}).then(operation);return lifecycle;}
export async function whenNativeNotesReady(){await Promise.resolve();await lifecycle;}
let transition:Promise<unknown>|null=null;
/** One full prepare/commit/cancel operation across user navigation and native quit. */
export async function runNotesTransition<T>(operation:()=>Promise<T>){
  if(transition)throw Error('A Notes account or workspace transition is already in progress.');
  const work=Promise.resolve().then(operation);transition=work;
  try{return await work;}finally{if(transition===work)transition=null;}
}
