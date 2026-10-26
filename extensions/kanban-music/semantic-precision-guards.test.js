import {expect,it} from 'vitest';
import {PercussionFeatures} from './percussion-features.js';
import {PercussionEvidence,PrecisionEvidenceRing,precisionConfiguration,precisionDecision} from './semantic-precision-guards.js';
const owner={captureId:'c',sourceId:'s',sourceGeneration:1,synchronizationEpoch:'e'};
const event={band:'hat',audioTime:1,confidence:.9,scores:[.8,.8,0,.9,.5]};
const evidence={audioTime:1,complete:true,valid:true,rms:.1,backgroundRms:.05,flux:[1,1,1,1],contrast:[2,2,2,2]};
it('defaults OFF and refuses promotion of unqualified enabled rules',()=>{
  expect(precisionConfiguration().mode).toBe('off');expect(()=>precisionConfiguration({mode:'enabled'})).toThrow('INSUFFICIENT_EVIDENCE');
  expect(()=>precisionConfiguration({mode:'enabled',rules:[]})).toThrow('INSUFFICIENT_EVIDENCE');
  expect(()=>precisionConfiguration({mode:'shadow',floorRms:NaN})).toThrow();expect(()=>precisionConfiguration({mode:'nope'})).toThrow();
});
it('preserves raw scores and events in shadow even when it would reject true silence',()=>{
  const original=JSON.stringify(event),guard=precisionDecision(event,{...evidence,rms:0},{mode:'shadow'});
  expect(guard).toMatchObject({accept:true,wouldAccept:false,reasons:['fixed-activity']});expect(JSON.stringify(event)).toBe(original);
  expect(precisionDecision(event,undefined,{mode:'off'}).accept).toBe(true);
});
it.each([undefined,{...evidence,complete:false},{...evidence,valid:false}])('abstains rather than vetoing missing, partial or invalid evidence',row=>{
  expect(precisionDecision(event,row,{mode:'shadow'})).toMatchObject({accept:true,wouldAccept:null});
});
it.each(['kick','clap','hat'])('does not apply global mutual exclusion or high-to-low veto (%s)',band=>{
  const row={...evidence,energy:[1000,1000,.001,.001],flux:[1,1,.1,.1],contrast:[2,2,2,2]};
  expect(precisionDecision({...event,band},row,{mode:'shadow',rules:['spectral-onset']}).wouldAccept).toBe(true);
});
it('uses exact candidate timestamps instead of the latest frame and rejects stale owners and gaps',()=>{
  expect(precisionDecision(event,{...evidence,flux:undefined},{mode:'shadow',rules:['spectral-onset']})).toMatchObject({wouldAccept:null,accept:true});
  expect(precisionDecision(event,{...evidence,rms:NaN},{mode:'shadow'})).toMatchObject({wouldAccept:null,accept:true});
  const ring=new PrecisionEvidenceRing(owner,{capacity:16});
  ring.add([evidence,{...evidence,audioTime:1.01,rms:0}],owner);
  expect(ring.lookup(1,owner).rms).toBe(.1);expect(ring.lookup(1.005,owner)).toBeUndefined();
  expect(ring.lookup(1,{...owner,sourceGeneration:2})).toBeUndefined();
  ring.add([{...evidence,audioTime:1.5}],owner);expect(ring.lookup(1,owner)).toBeUndefined();
  for(let i=0;i<50;i++)ring.add([{...evidence,audioTime:2+i*.01}],owner);
  expect(ring.entries.size).toBe(16);ring.clear();expect(ring.entries.size).toBe(0);
});
it('measures actual silence, invalid samples, clipping and Nyquist limits without normalizing them into activity',()=>{
  const measure=new PercussionEvidence(22050,1024),samples=new Float32Array(1024),spectrum=new Float64Array(512);
  const zero=measure.measure(samples,spectrum,1024,1);expect(zero.rms).toBe(0);expect(zero.flux).toEqual([0,0,0,0]);expect(zero.valid).toBe(true);
  expect(zero.bands[3][1]).toBe(11025);samples[0]=NaN;expect(measure.measure(samples,spectrum,1024,2).valid).toBe(false);
  samples.fill(1);expect(measure.measure(samples,spectrum,1024,3).clippedFraction).toBe(1);
});
it('keeps model tensors byte-identical with shadow measurements on low-volume, high-gain and rapid polyphony',()=>{
  const config={fftSize:64,hopSize:16,sampleRate:44100,stepFrames:5,bins:1,filterbank:[{first:0,weights:Array(32).fill(1)}]};
  const off=new PercussionFeatures(config),shadow=new PercussionFeatures({...config,semanticPrecisionGuards:{mode:'shadow'}});
  const a=[],b=[];for(let block=0;block<80;block++) {
    const samples=Float32Array.from({length:128},(_,i)=>(block%3===0?1e-7:1)*(Math.sin((block*128+i)*.2)+Math.sin(i*2))*.2);
    const time=block*128/44100;off.push([samples],time,x=>a.push(x));shadow.push([samples],time,x=>b.push(x));
  }
  expect(a.length).toBe(b.length);for(let i=0;i<a.length;i++){expect(a[i].data).toEqual(b[i].data);expect(a[i].times).toEqual(b[i].times);expect(b[i].evidence).toHaveLength(5);}
});
