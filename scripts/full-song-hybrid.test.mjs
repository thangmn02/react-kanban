import test from 'node:test';
import assert from 'node:assert/strict';
import {createHybridRouter,frozenModels,hybridVariant} from './full-song-hybrid.mjs';
const source={originalSourceSha256:'source',canonicalWavSha256:'wave',decodedPcmSha256:'pcm'};
const event=(id,instrument,time)=>({id,instrument,sourceTime:time,time,rawClass:instrument,rawIndex:1,recordSha256:'original-record',confidence:.7});
const record=(m,events)=>({sourceSha256:source.originalSourceSha256,pcmSha256:source.decodedPcmSha256,cacheKey:m+'cache',resultSha256:m+'result',events,contract:{identities:{[m]:{contract:{modelSha256:frozenModels[m]}}}}});
const coverage={A:{completeRawCoverage:false,uncoveredIntervals:[{start:9.85,end:10,reason:'original EOF gap'}]},B:{completeRawCoverage:true,uncoveredIntervals:[]}};
test('canonical H0 bridge retains exact events and simultaneous classes, excluding A Hat/Cymbal and B drums',async()=>{
 const route=await createHybridRouter(),kick=event('ak','kick',1),snare=event('as','snare',1),hat=event('bh','hat',1);
 const records={A:record('A',[kick,snare,event('ah','hat',2),event('ac','cymbal',3),kick]),B:record('B',[hat,event('bk','kick',4),event('bs','snare',5)])};
 const result=await route(source,records,coverage);
 assert.deepEqual(result.events.map(e=>e.id),['bh','ak','as']);
 for(const e of result.events){const original=records[e.originModel].events.find(x=>x.id===e.id);for(const [k,v] of Object.entries(original))assert.deepEqual(e[k],v);assert.equal(e.originPredictionId,e.id);assert.equal(e.variantId,hybridVariant);assert.equal(e.originModelSha256,frozenModels[e.originModel]);assert.equal(e.originCacheKey,records[e.originModel].cacheKey);assert.equal(e.originResultSha256,records[e.originModel].resultSha256);}
 assert.deepEqual(result.metadata.coverageByInstrument.kick,coverage.A);assert.deepEqual(result.metadata.coverageByInstrument.snare,coverage.A);assert.deepEqual(result.metadata.coverageByInstrument.hat,coverage.B);
 assert.equal(result.metadata.inferenceRun,false);assert.equal(await route(source,records,coverage),result,'exact binding reuses the same routed arrays');
 const changed=await route({...source,canonicalWavSha256:'newwave'},records,coverage);assert.notEqual(changed.metadata.cacheKey,result.metadata.cacheKey);
 const newRecords={...records,B:{...records.B,resultSha256:'changed'}};assert.notEqual((await route(source,newRecords,coverage)).metadata.cacheKey,result.metadata.cacheKey);
});
test('missing data is explicitly incomplete and cannot leak a previous cached hybrid',async()=>{
 const route=await createHybridRouter();await route(source,{A:record('A',[]),B:record('B',[])},coverage);
 const result=await route(source,{A:record('A',[])},coverage);assert.equal(result.events,null);assert.equal(result.metadata.state,'INCOMPLETE');assert.deepEqual(result.metadata.missing,['B']);
});
test('wrong source, PCM or checkpoint is rejected before routing',async()=>{
 const route=await createHybridRouter(),records={A:record('A',[]),B:record('B',[])};
 await assert.rejects(route({...source,originalSourceSha256:'other'},records,coverage),/source binding/);
 await assert.rejects(route({...source,decodedPcmSha256:'other'},records,coverage),/source binding/);
 records.B.contract.identities.B.contract.modelSha256='different';await assert.rejects(route(source,records,coverage),/frozen B checkpoint/);
});
