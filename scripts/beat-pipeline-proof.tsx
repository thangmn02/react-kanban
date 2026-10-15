// Private diagnostic entry point; real production modules, local PCM input.
import React from 'react';
import { createRoot } from 'react-dom/client';
import BeatPattern from '../src/features/music/BeatPattern';
import { useMusicBeatSync } from '../src/features/music/useMusicBeatSync';
import type { BeatEvent, BeatBand } from '../src/features/music/mediaBridge';
import { createCaptureEngine } from '../extensions/kanban-music/capture-engine.js';
import { createPercussionRuntime } from '../extensions/kanban-music/percussion-runtime.js';
import { playbackTiming, playbackTraces } from '../extensions/kanban-music/beat-timing.js';
import { beatTelemetry, type BeatTrace } from '../extensions/kanban-music/beat-telemetry.js';
import '../src/components/focus/floatingFocus.css';

const root=createRoot(document.getElementById('grid')!);
let subscription:string|undefined;
// This fixture replaces only browser-extension IPC and capture permissions.
// It still exercises the public envelope parser, engine, scheduler/controller.
window.addEventListener('message',event=>{
  const message=event.data;
  if(event.source!==window || message?.direction!=='app-to-extension')return;
  subscription=message.subscriptionId;
  window.postMessage({channel:message.channel,direction:'extension-to-app',requestId:message.requestId,ok:true},location.origin);
});
const onClock=()=>{};
const options={demand:false,capabilities:{tier:'tab-capture' as const,captureClock:'output-clock-capable' as const}};
export function Grid({id}:{id:string}) {
  const beat=useMusicBeatSync(id,onClock,options);
  return <BeatPattern session={{id,title:'Private PCM pipeline diagnostic',artist:'',source:'',playing:true,paused:false}}
    beat={beat}/>;
}

interface LearnedEvent {band:string;audioTime:number;confidence:number;classMargin:number;scores:number[]}
interface ObservedEvent extends LearnedEvent {
  excerptTime:number;modelReceiptAudioTime:number;traceId?:string;
  captureSentAudioTime?:number;mappedTargetPlaybackTime?:number;visibleAudioTime?:number;
}
interface DiagnosticResult {
  availableAudioTime:number;inferenceStartedAt:number;inferenceEndedAt:number;queueDepth:number;
  diagnostics:{events:LearnedEvent[]}[];
}
interface PercussionConfiguration {
  context:AudioContext;source:AudioNode;signal:AbortSignal;
  onEvent:(event:LearnedEvent)=>void;onFailure:(reason:string)=>void;onProgress:()=>void;
}
type OutputTiming = {targetOutputTime:number}|undefined;

async function prove(url:string,monitorOnly=true,delaySeconds=0) {
  if(!Number.isFinite(delaySeconds)||delaySeconds<0||delaySeconds>.5)throw Error('Diagnostic delay must be 0–500 ms');
  const context=new AudioContext({sampleRate:44100});
  await context.resume();
  const pcm=new Float32Array(await (await fetch(url)).arrayBuffer());
  const buffer=context.createBuffer(2,pcm.length/2,44100);
  for(let channel=0;channel<2;channel++) {
    const samples=buffer.getChannelData(channel);
    for(let i=0;i<samples.length;i++)samples[i]=pcm[2*i+channel];
  }
  const source=context.createBufferSource();source.buffer=buffer;
  const stream=context.createMediaStreamDestination();source.connect(stream);
  // The fixture owns this audio-only output. Delay the audible branch, while
  // analysis receives the original PCM immediately. No video/provider is used.
  const outputDelay=context.createDelay(.5);outputDelay.delayTime.value=delaySeconds;
  source.connect(outputDelay);outputDelay.connect(context.destination);
  const sessionId=crypto.randomUUID(),captureId=crypto.randomUUID();
  let origin=Infinity,sequence=0,running=true,timer:ReturnType<typeof setInterval>|undefined;
  const raw:ObservedEvent[]=[],records:Record<string,unknown>[]=[],failures:string[]=[],diagnostics:Record<string,unknown>[]=[];
  const seen=new Set<string>();
  let evicted=0,resolveReady:(value:unknown)=>void=()=>{};
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  const clock=()=>{
    const advancing=Number.isFinite(origin),position=context.currentTime-origin-delaySeconds;
    return {currentTime:Math.max(0,position),sampledAt:Date.now()+(advancing?Math.max(0,-position)*1000:0),
      playbackRate:1,playing:advancing,paused:!advancing};
  };
  const audibleTiming=(timing:OutputTiming)=>timing?{targetOutputTime:timing.targetOutputTime+delaySeconds*1000}:undefined;
  const send=(event:BeatEvent)=>window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,
    data:{channel:'kanban-music-v1',direction:'extension-event',event:'beat',sessionId,
      subscriptionId:subscription,emittedAt:Date.now(),...event,...(event.kind==='onset'?{sequence:++sequence}:{})}}));
  const collect=()=>{const sample=beatTelemetry.snapshot();records.push(...sample.records);evicted+=sample.evicted;beatTelemetry.clear();};
  const capture=createCaptureEngine({monitorOnly,getUserMedia:async()=>stream.stream,createAudioContext:()=>context,
    onStop:()=>{},onAudible:()=>send({kind:'sync.state',mode:'capture',captureId}),
    onTempo:(id:string,tempo:Extract<BeatEvent,{kind:'tempo.state'}>['tempo'],traces:BeatTrace[]|undefined,timing:OutputTiming)=>send({kind:'tempo.state',captureId:id,tempo,
      telemetry:playbackTraces(traces,playbackTiming(clock(),audibleTiming(timing)),audibleTiming(timing)?.targetOutputTime),...playbackTiming(clock(),audibleTiming(timing))}),
    onBeat:(id:string,bands:BeatBand[],traces:BeatTrace[]|undefined,timing:OutputTiming)=>{
      const receivedAudioTime=context.currentTime;
      const adjustment=monitorOnly?0:(context.baseLatency||0)+(context.outputLatency||0);
      for(const trace of traces||[]) {
        const event=raw.find(e=>!e.traceId&&(e.band==='clap'?'snare':e.band)===trace.type
          &&Math.abs(e.audioTime-(trace.targetTime-adjustment))<1e-7);
        if(event)Object.assign(event,{traceId:trace.id,captureSentAudioTime:receivedAudioTime,
          mappedTargetPlaybackTime:playbackTiming(clock(),audibleTiming(timing))?.targetPlaybackTime});
      }
      send({kind:'onset',captureId:id,bands,telemetry:playbackTraces(traces,playbackTiming(clock(),audibleTiming(timing)),audibleTiming(timing)?.targetOutputTime),
        ...playbackTiming(clock(),audibleTiming(timing))});
    },
    createPercussion:async(configuration:PercussionConfiguration)=>{
      const runtime=await createPercussionRuntime({...configuration,
        onDiagnostic:(result:DiagnosticResult)=>{diagnostics.push({receivedAudioTime:context.currentTime,
          availableAudioTime:result.availableAudioTime,inferenceMs:result.inferenceEndedAt-result.inferenceStartedAt,
          queueDepth:result.queueDepth,events:result.diagnostics.flatMap(f=>f.events)});},
        onFailure:(reason:string)=>{failures.push(reason);configuration.onFailure(reason);},
        onEvent:(event:LearnedEvent)=>{
          if(event.audioTime>=origin&&event.audioTime<origin+buffer.duration)
            raw.push({...event,excerptTime:event.audioTime-origin,modelReceiptAudioTime:context.currentTime});
          configuration.onEvent(event);
        }});
      resolveReady(runtime);return runtime;
    }});
  const frame=()=>{
    if(!running)return;
    for(const cell of document.querySelectorAll<HTMLElement>('.semantic-beat-flash[data-beat-trace]')) {
      const id=cell.dataset.beatTrace!;
      if(seen.has(id)||Number(getComputedStyle(cell).opacity)<.5)continue;
      const event=raw.find(e=>e.traceId===id);
      if(event){event.visibleAudioTime=context.currentTime;seen.add(id);}
    }
    requestAnimationFrame(frame);
  };
  beatTelemetry.enable();beatTelemetry.clear();subscription=undefined;
  root.render(<Grid key={sessionId} id={sessionId}/>);
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try {
    const deadline=performance.now()+3000;
    while(!subscription&&performance.now()<deadline)await new Promise(done=>setTimeout(done,10));
    if(!subscription)throw Error('Production hook did not subscribe');
    if(!await capture.start('local-pcm',captureId))throw Error('Real capture engine failed to start');
    const initialized=await Promise.race([ready,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Model initialization timeout')),10000);})]);
    clearTimeout(timeout);
    if(!initialized)throw Error('Real production percussion unavailable');
    origin=context.currentTime+.1;
    source.start(origin);source.stop(origin+buffer.duration);
    timer=setInterval(()=>{capture.renew(captureId);send({kind:'clock',clock:clock()});collect();},25);
    requestAnimationFrame(frame);
    await new Promise(done=>setTimeout(done,(buffer.duration+delaySeconds+.7)*1000));
    collect();
    const summaries=raw.map(event=>{
      const trace=records.filter(r=>r.id===event.traceId);
      return {...event,audibleTargetAudioTime:event.audioTime+delaySeconds,
        stages:trace.map(({stage,component,reason,at,offsetMs,targetPlaybackTime})=>({stage,component,reason,at,offsetMs,targetPlaybackTime})),
        firstDrop:trace.find(r=>r.stage==='EVENT_DROPPED')||null};
    });
    return {url,monitorOnly,delaySeconds,seconds:buffer.duration,audioOrigin:origin,events:summaries,diagnostics,failures,
      telemetryEvicted:evicted,records,
      scope:'Real PCM stream, capture engine, worklet/model/classifier, public envelope parser, event engine, scheduler, controller, normal renderer. In-process IPC adapter; no Chrome IPC, native capture, provider clock or physical presentation.',
      tailPolicy:'Playback clock continues during 600 ms silence drain; does not validate end/pause behavior.'};
  } finally {
    running=false;clearTimeout(timeout);clearInterval(timer);capture.stop();
    try{source.stop();}catch{/* Already stopped at end. */}source.disconnect();stream.disconnect();outputDelay.disconnect();
    root.render(null);if(context.state!=='closed')await context.close();
  }
}
Object.assign(window,{provePipeline:prove});
