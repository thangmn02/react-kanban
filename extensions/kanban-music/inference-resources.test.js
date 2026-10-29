import {it,expect,vi} from 'vitest';
import {withOwnedInference} from './inference-resources.js';
const tensor=()=>({dispose:vi.fn(),data:new Float32Array([1,2,3])});
it('retains tensor values until consumer finishes, then disposes every unique input and output',async()=>{
 const input=tensor(),output=tensor();
 const result=await withOwnedInference({run:async()=>({scores:output,alias:output})},{input},async outputs=>{expect(input.dispose).not.toHaveBeenCalled();expect(output.dispose).not.toHaveBeenCalled();await Promise.resolve();return Array.from(outputs.scores.data);});
 expect(result).toEqual([1,2,3]);expect(input.dispose).toHaveBeenCalledOnce();expect(output.dispose).toHaveBeenCalledOnce();
});
it('disposes inputs when inference rejects and outputs when a consumer fails or cancels',async()=>{
 const input=tensor();await expect(withOwnedInference({run:async()=>{throw Error('inference failed');}},{input},()=>{})).rejects.toThrow('inference failed');expect(input.dispose).toHaveBeenCalledOnce();
 const next=tensor(),output=tensor();await expect(withOwnedInference({run:async()=>({output})},{input:next},()=>{throw Error('consumer failed');})).rejects.toThrow('consumer failed');expect(next.dispose).toHaveBeenCalledOnce();expect(output.dispose).toHaveBeenCalledOnce();
});
it('does not dispose an aliased input twice or retain tensors across successive batches',async()=>{
 const input=tensor();await withOwnedInference({run:async()=>({output:input})},{input},()=>{});expect(input.dispose).toHaveBeenCalledOnce();
 for(let i=0;i<100;i++){const feed=tensor(),output=tensor();await withOwnedInference({run:async()=>({output})},{feed},()=>{});expect(feed.dispose).toHaveBeenCalledOnce();expect(output.dispose).toHaveBeenCalledOnce();}
});
