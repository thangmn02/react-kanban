import {it,expect} from 'vitest';
import {BassSourceProcessor} from './bass-source-core.js';
import {BeatDetector} from './beat-detector.js';
import {BassSourceStream} from '../../scripts/bass-recovery-core.mjs';
const ownership={captureId:'capture',sourceId:'source',sourceGeneration:2,synchronizationEpoch:'epoch'};
const signal=rate=>Float32Array.from({length:5*rate},(_,i)=>{
  const t=i/rate,onset=Math.floor(t);return onset>=1&&onset<=4?.4*Math.exp(-(t-onset)*8)*Math.sin(2*Math.PI*220*(t-onset)):0;
});
it.each([44100,48000])('keeps exact baseline frame endpoints and proposals across PCM chunk sizes at %i Hz',rate=>{
  const mono=signal(rate),reference=[];
  const baseline=new BassSourceStream(new BeatDetector(rate),{sourceClock:{fftSize:2048,hopSamplesAt44100:735},candidates:[]},rate);
  baseline.push(mono,0,frame=>reference.push(frame));
  let previous;
  for(const size of [128,256,735,4096]){
    const processor=new BassSourceProcessor(ownership,rate),frames=[];let sequence=0;
    for(let start=0;start<mono.length;start+=size){const data=mono.slice(start,start+size);
      frames.push(...processor.push({ownership,sampleRate:rate,sequence:++sequence,mono:data,sourceStartSample:start+10000,sourceEndSample:start+10000+data.length}).frames);}
    expect(frames.map(f=>f.endpointSample)).toEqual(reference.map(f=>f.endpointSample+10000));
    expect(frames.flatMap(f=>f.events).map(e=>e.sourceFrame)).toEqual(reference.filter(f=>f.events.length).map(f=>f.endpointSample+10000));
    expect(frames.flatMap(f=>f.events)).toHaveLength(4);
    if(previous)expect(frames).toEqual(previous);previous=frames;
  }
});
it('rejects genuine gaps/duplicate input and never accepts a stale owner',()=>{
  const processor=new BassSourceProcessor(ownership,44100),packet={ownership,sampleRate:44100,sequence:1,mono:new Float32Array(256),sourceStartSample:500,sourceEndSample:756};
  expect(processor.push({...packet,ownership:{...ownership,synchronizationEpoch:'old'}}).kind).toBe('stale');
  expect(processor.sequence).toBe(0);processor.push(packet);
  expect(()=>processor.push(packet)).toThrow('Noncontiguous');
  expect(()=>processor.push({...packet,sequence:2,sourceStartSample:800,sourceEndSample:1056})).toThrow('Noncontiguous');
});
it('excludes only declared pre-analysis warm-up gaps and still rejects gaps in the selected PCM',()=>{
  const p=new BassSourceProcessor(ownership,44100,{windowStartSample:1000});
  const packet=(sequence,start,length)=>({ownership,sampleRate:44100,sequence,sourceStartSample:start,sourceEndSample:start+length,mono:new Float32Array(length)});
  p.push(packet(1,0,128));expect(p.push(packet(2,640,512))).toMatchObject({discontinuity:{excludedBeforeDeclaredWindow:true},frames:[]});
  expect(p.stream.received).toBe(152);expect(()=>p.push(packet(3,1200,256))).toThrow('Noncontiguous Bass PCM');
  const live=new BassSourceProcessor(ownership,44100);live.push(packet(1,0,128));
  expect(()=>live.push(packet(2,640,512))).toThrow('Noncontiguous Bass PCM');
});
