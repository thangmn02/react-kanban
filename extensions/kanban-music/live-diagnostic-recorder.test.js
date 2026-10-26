import {expect,it} from 'vitest';
import {LiveDiagnosticRecorder,cnnFrameCoverage} from './live-diagnostic-recorder.js';
it.each([30,60,90])('retains exact coverage and bounded storage for a %i second private recording',seconds=>{
  const r=new LiveDiagnosticRecorder({recordingId:'duration',audioContextStart:0,durationSeconds:seconds,hybridMode:'H-LIVE'},()=>1000);
  r.workerStart={};r.cnnWorkerStart={};
  for(let i=0;i<seconds*100;i++)r.append('frames',{audioTime:i/100});
  for(let i=0;i<Math.ceil(seconds*22050/256);i++)r.append('cnnFrames',{frame:i,segmentOrigin:0,audioTime:i*256/22050});
  r.finish();expect(r.endsAt-r.startedAt).toBe(seconds*1000);expect(r.snapshot().complete).toBe(true);
  expect(r.snapshot().completeness.cnnExpectedRange.expectedFrames).toBe(Math.ceil(seconds*22050/256));
  r.buffers.cnnFrames.splice(1,1);expect(r.snapshot().complete).toBe(false);
});
it('preserves the default recording duration and rejects unbounded requests',()=>{
  expect(new LiveDiagnosticRecorder({}).seconds).toBe(30);
  for(const durationSeconds of [0,31,120,Infinity,'60'])expect(()=>new LiveDiagnosticRecorder({durationSeconds})).toThrow();
});
it('requires actual continuous frame coverage and worker acknowledgement for completeness',()=>{
  let now=1000;const r=new LiveDiagnosticRecorder({recordingId:'case',audioContextStart:10},()=>now);
  r.workerStart={at:1000};for(let i=0;i<3000;i++)r.append('frames',{audioTime:10+i*.01,scores:[0,0,0,0,0]});
  now=32000;r.finish();expect(r.snapshot().complete).toBe(true);expect(r.snapshot().completeness.selectedFrames).toBe(3000);
  expect(r.snapshot(false)).not.toHaveProperty('frames');
  const empty=new LiveDiagnosticRecorder({audioContextStart:10},()=>now);empty.finish();expect(empty.snapshot().complete).toBe(false);
});
it('bounds long-running storage, marks gaps and overflow, and retains immutable snapshots',()=>{
  const r=new LiveDiagnosticRecorder({audioContextStart:0});r.workerStart={at:0};
  for(let i=0;i<5000;i++)r.append('frames',{audioTime:i*.02,scores:[0,0,0,0,0]});
  r.finish();const snapshot=r.snapshot();expect(snapshot.frames).toHaveLength(4000);expect(snapshot.overflow.frames).toBe(1000);
  expect(snapshot.complete).toBe(false);snapshot.frames[0].scores[0]=1;expect(r.snapshot().frames[0].scores[0]).toBe(0);
  r.append('frames',{audioTime:99});expect(r.snapshot().frames).toHaveLength(4000);
});
it('preserves interruption as distinct from a model miss',()=>{
  const r=new LiveDiagnosticRecorder({audioContextStart:0});r.finish('source-changed');
  expect(r.snapshot()).toMatchObject({status:'INTERRUPTED',reason:'source-changed',complete:false,audioStored:false});
});
it('requires the exact declared CNN hop range, not approximate raw counts',()=>{
  const hop=256/22050,origin=2;
  const frames=Array.from({length:4000},(_,frame)=>({frame,segmentOrigin:origin,audioTime:origin+frame*hop}));
  const start=10,end=40,range=cnnFrameCoverage(frames,start,end);
  expect(range).toMatchObject({complete:true,duplicates:0,aligned:true,contiguous:true});
  const first=range.expectedFirstFrame,last=range.expectedLastFrame;
  expect(first).toBe(Math.ceil((start-origin)/hop));expect(last).toBe(Math.ceil((end-origin)/hop)-1);
  expect(cnnFrameCoverage(frames.filter(f=>f.frame!==first),start,end).complete).toBe(false);
  expect(cnnFrameCoverage(frames.filter(f=>f.frame!==first+2),start,end).complete).toBe(false);
  expect(cnnFrameCoverage([...frames,frames[first+2]],start,end).duplicates).toBe(1);
  expect(cnnFrameCoverage([...frames,frames[first+2]],start,end).complete).toBe(false);
  const relabeled=frames.map(f=>f.frame>1000?{...f,segmentOrigin:origin+.001}:f);
  expect(cnnFrameCoverage(relabeled,start,end).complete).toBe(false);
});
