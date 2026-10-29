import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PercussionClassifier} from './percussion-classifier.js';
import {EarlyPercussionClassifier} from './early-percussion-classifier.js';
import {CausalPercussionClassifier} from './causal-percussion-classifier.js';
import {PrecisionEvidenceRing,precisionConfiguration,precisionDecision} from './semantic-precision-guards.js';
import {ADTOF_CLASS_NAMES,labelProvenance,mappedPercussionKind,validateHatLabelMode} from './percussion-label-contract.js';
import {withOwnedInference} from './inference-resources.js';
import {loadFrozenPercussionModel,frozenPercussionSha256} from './model-assets.js';
const session={run:vi.fn()};
const ownership={captureId:'test',sourceId:'song',sourceGeneration:3,synchronizationEpoch:'epoch'};
const row=time=>({audioTime:time,complete:true,valid:true,rms:time===.12?.1:0,
  backgroundRms:.01,flux:[1,1,1,1],contrast:[2,2,2,2]});
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();session.run.mockReset();});
async function worker({hatLabelMapping='off',classifier='onset-guided',head=3}={}){
  const frozenBytes=readFileSync('extensions/kanban-music/generated/percussion/percussion.onnx');vi.stubGlobal('fetch',vi.fn(async()=>new Response(frozenBytes)));
  const messages=[],scope={postMessage:value=>messages.push(value)};
  session.run.mockImplementation(async({audio})=>{
    const end=audio.data.at(-1),scores=new Float32Array(500);
    for(let j=0;j<100;j++)scores[j*5+head]=end-100+j===12?.9:.01;
    return {scores:{data:scores,dispose:vi.fn()}};
  });
  // Execute the actual Worker orchestration with a controlled inference backend.
  // Native frozen-model inference is exercised separately by the corpus benchmark.
  const source=readFileSync('extensions/kanban-music/percussion-worker.js','utf8')
    .replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',"'file:///percussion-worker.js'")
    .replace('ort = await import(/* @vite-ignore */ runtimeUrl);','ort = testOrt;');
  const testOrt={env:{wasm:{}},Tensor:class {constructor(type,data,dims){Object.assign(this,{type,data,dims,dispose:vi.fn()});}},InferenceSession:{create:async()=>session}};
  runInNewContext(source,{self:scope,URL,performance,Date,withOwnedInference,loadFrozenPercussionModel,PercussionClassifier,EarlyPercussionClassifier,CausalPercussionClassifier,
    PrecisionEvidenceRing,precisionConfiguration,precisionDecision,ADTOF_CLASS_NAMES,labelProvenance,mappedPercussionKind,validateHatLabelMode,testOrt});
  await scope.onmessage({data:{kind:'init',model:new Uint8Array(),config:{ownership,
    bins:1,windowFrames:100,stepFrames:5,rightContext:10,input:'audio',output:'scores',
    classifier,hatLabelMapping,diagnostics:true,sha256:frozenPercussionSha256,semanticPrecisionGuards:{mode:'shadow'}}}});
  expect(messages).toEqual([{kind:'ready',ownership}]);
  return {scope,messages};
}
function batch(first,owner=ownership){
  const times=Array.from({length:5},(_,i)=>(first+i)/100);
  return {kind:'frames',ownership:owner,times,data:Float32Array.from(times,(_,i)=>first+i+1),evidence:times.map(row)};
}
it('captures continuous non-emitting scores and warm postprocessing state without changing event output',async()=>{
  const run=async capture=>{
    const {scope,messages}=await worker({head:4});
    if(capture)await scope.onmessage({data:{kind:'diagnostic-capture',recordingId:'record',enabled:true,ownership}});
    for(let first=0;first<50;first+=5){await scope.onmessage({data:batch(first)});await vi.waitFor(()=>expect(messages.filter(x=>x.kind==='result')).toHaveLength(first/5+1));}
    return {scope,messages};
  };
  const plain=await run(false),recorded=await run(true),results=recorded.messages.filter(x=>x.kind==='result');
  const recognition=rows=>rows.flatMap(x=>x.events).map(event=>{const copy={...event};delete copy.timing;return copy;});
  expect(recognition(results)).toEqual(recognition(plain.messages.filter(x=>x.kind==='result')));
  expect(results.flatMap(x=>x.events)[0].timing.decisionAt).toBeTypeOf('number');
  expect(recorded.messages.find(x=>x.kind==='diagnostic-start').classifierState).toMatchObject({count:0,pending:[null,null,null,null,null]});
  expect(results.flatMap(x=>x.diagnostics)).toHaveLength(40);
  expect(results.flatMap(x=>x.diagnostics).find(x=>x.peakNovelty)?.peakNovelty).toHaveLength(5);
  expect(results.every(x=>x.diagnosticRecordingId==='record')).toBe(true);
  await recorded.scope.onmessage({data:{kind:'diagnostic-capture',recordingId:'record',enabled:false,ownership}});
  expect(recorded.messages.at(-1)).toMatchObject({kind:'diagnostic-stop',diagnosticRecordingId:'record'});
});
it('validates an older finalized event against its own source frame instead of later silent FFT frames',async()=>{
  const {scope,messages}=await worker();
  for(let first=0;first<50;first+=5){await scope.onmessage({data:batch(first)});await vi.waitFor(()=>expect(messages.filter(x=>x.kind==='result')).toHaveLength(first/5+1));}
  const results=messages.filter(x=>x.kind==='result'),guards=results.flatMap(x=>x.guardDecisions);
  expect(guards).toHaveLength(1);expect(guards[0]).toMatchObject({audioTime:.12,evidence:{audioTime:.12,rms:.1},guard:{accept:true,wouldAccept:true}});
  expect(results.flatMap(x=>x.events)).toHaveLength(1);
  expect(results.flatMap(x=>x.preGuardEvents)).toEqual(results.flatMap(x=>x.events));
  expect(results.flatMap(x=>x.diagnostics).at(-1).evidence.rms).toBe(0);
});
it.each(['off','M1','shadow'])('rejects stale-source batches and bounds backlog while inference is pending (%s)',async hatLabelMapping=>{
  const {scope,messages}=await worker({hatLabelMapping});
  await scope.onmessage({data:batch(0,{...ownership,sourceGeneration:2})});
  expect(session.run).not.toHaveBeenCalled();
  let release;
  const original=session.run.getMockImplementation();
  session.run.mockImplementationOnce(input=>new Promise(resolve=>{release=async()=>resolve(await original(input));}));
  await scope.onmessage({data:batch(0)});
  for(let first=5;first<=25;first+=5)await scope.onmessage({data:batch(first)});
  expect(messages.filter(x=>x.kind==='backlog')).toHaveLength(2);
  await release();
  await vi.waitFor(()=>expect(messages.filter(x=>x.kind==='result')).toHaveLength(4));
  expect(messages.filter(x=>x.kind==='result').every(x=>x.queueDepth<=3)).toBe(true);
  expect(messages.filter(x=>x.kind==='failed')).toHaveLength(0);
});
it('keeps strict Worker output empty for a Cymbal-only score stream while retaining its provenance',async()=>{
  const {scope,messages}=await worker({hatLabelMapping:'M1',head:4});
  for(let first=0;first<50;first+=5){await scope.onmessage({data:batch(first)});await vi.waitFor(()=>expect(messages.filter(x=>x.kind==='result')).toHaveLength(first/5+1));}
  const result=messages.filter(x=>x.kind==='result');expect(result.flatMap(x=>x.events)).toHaveLength(0);
  expect(result.flatMap(x=>x.labelCandidates)).toEqual([expect.objectContaining({originalClassIndex:4,mapping:'M1',finalEmissionDecision:'suppressed-label-contract'})]);
});
it.each(['onset-guided','early-finalization'])('retains raw Cymbal head provenance and both shadow decisions (%s)',async classifier=>{
  const {scope,messages}=await worker({hatLabelMapping:'shadow',classifier,head:4});
  for(let first=0;first<50;first+=5){await scope.onmessage({data:batch(first)});await vi.waitFor(()=>expect(messages.filter(x=>x.kind==='result')).toHaveLength(first/5+1));}
  const result=messages.filter(x=>x.kind==='result'),audit=result.flatMap(x=>x.labelCandidates);
  expect(result.flatMap(x=>x.events)).toHaveLength(1);
  expect(audit.find(x=>x.mapping==='M0')).toMatchObject({...ownership,originalClassIndex:4,originalClassName:'cymbal',mappedSemanticKind:'hat',finalEmissionDecision:'emitted'});
  expect(audit.find(x=>x.mapping==='M1')).toMatchObject({originalClassIndex:4,mappedSemanticKind:null,finalEmissionDecision:'suppressed-label-contract'});
  const frame=result.flatMap(x=>x.diagnostics).find(x=>x.audioTime===.12);
  expect(frame.heads).toHaveLength(5);expect(frame.heads[4].rawClassScore).toBeCloseTo(.9);
});
