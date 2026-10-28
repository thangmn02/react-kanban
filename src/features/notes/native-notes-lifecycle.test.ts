import {expect,it,vi} from 'vitest';
import {runNotesTransition} from './native-notes-lifecycle';

it('holds one lease for the whole prepare and commit and releases it after success',async()=>{
  let finish!:()=>void;const held=new Promise<void>(resolve=>{finish=resolve;});const competing=vi.fn();
  const first=runNotesTransition(async()=>{await held;return 'committed';});
  await expect(runNotesTransition(competing)).rejects.toThrow('already in progress');expect(competing).not.toHaveBeenCalled();
  finish();await expect(first).resolves.toBe('committed');await expect(runNotesTransition(async()=>42)).resolves.toBe(42);
});
it('releases the transition only after its failure cleanup completes',async()=>{
  let cleanup!:()=>void;const held=new Promise<void>(resolve=>{cleanup=resolve;});
  const first=runNotesTransition(async()=>{try{throw Error('Storage unavailable');}finally{await held;}});
  const failed=expect(first).rejects.toThrow('Storage unavailable');
  await expect(runNotesTransition(async()=>{})).rejects.toThrow('already in progress');cleanup();await failed;
  await expect(runNotesTransition(async()=>{})).resolves.toBeUndefined();
});
