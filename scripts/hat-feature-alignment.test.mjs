import assert from 'node:assert/strict';
import {it} from 'node:test';
import {alignHatFeatures} from './hat-feature-alignment.mjs';
const vector=i=>Array.from({length:84},(_,k)=>((Math.imul(i+1,2654435761)^Math.imul(k+3,2246822519))>>>0)/4294967296);
const reference=Array.from({length:1000},(_,i)=>({time:i/100,data:vector(i)}));
it('recovers a fixed offset from the same feature content without changing input timestamps',()=>{
 const captured=reference.slice(50,950).map(f=>({time:f.time+.04,data:f.data}));
 const times=captured.map(f=>f.time),fit=alignHatFeatures(reference,captured,0,1,9);
 assert(Math.abs(fit.offset+.04)<1e-9);assert.deepEqual(captured.map(f=>f.time),times);
});
it('rejects unrelated or uninformative features instead of inventing source-time provenance',()=>{
 const unrelated=reference.slice(50,950).map(f=>({time:f.time,data:vector(Math.round(f.time*100)+1250)}));
 assert.throws(()=>alignHatFeatures(reference,unrelated,0,1,9));
 const constant=reference.map(f=>({time:f.time,data:Array(84).fill(.2)}));
 assert.throws(()=>alignHatFeatures(constant,constant,0,1,9),/boundary|ambiguous/);
});
