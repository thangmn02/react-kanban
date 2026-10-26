// Task-only qualification surface. Never imported by product routes.
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import BeatPattern from '../../src/features/music/BeatPattern';
import BaselineBeatPattern from '../../scratch/p3-p4-261026-1706/baseline-beat-pattern';
import type {MusicBeatState} from '../../src/features/music/useMusicBeatSync';
import type {BeatBand,BrowserMusicSession} from '../../src/features/music/mediaBridge';
import type {BeatTrace} from '../../extensions/kanban-music/beat-telemetry.js';
import {beatTelemetry} from '../../extensions/kanban-music/beat-telemetry.js';
import {beatRowDiagnostics} from '../../src/features/music/beat-row-diagnostics';
import {beatPresentationDiagnostics} from '../../src/features/music/beat-presentation-diagnostics';
import '../../src/components/focus/floatingFocus.css';

type Input={at:number;bands:BeatBand[];duration?:number};
type Configuration={name:string;input:Input[];baseline?:boolean;semanticOnly?:boolean;reduced?:boolean;profile?:'legacy'|'focus'|'dynamic';
  milliseconds?:number;exclusive?:boolean;stress?:boolean;lifecycle?:boolean;degraded?:boolean;active?:boolean;stateLead?:boolean;splitLead?:boolean};
const empty:MusicBeatState={sessionId:'qualification',mode:'capture',captureId:'fixture',sourceGeneration:1,synchronizationEpoch:'fixture',onsets:{},visualAttacks:[]};
const session:BrowserMusicSession={id:'qualification',title:'Kora presentation qualification',artist:'',source:'test-only',generation:1,playing:true,paused:false,currentTime:0};
let update:(beat:MusicBeatState,session:BrowserMusicSession,configuration:Configuration)=>void;
export function Surface(){
  const [state,setState]=useState({beat:empty,session,configuration:{name:'idle',input:[]} as Configuration});
  useEffect(()=>{update=(beat,session,configuration)=>flushSync(()=>setState({beat,session,configuration}));},[]);
  const Component=state.configuration.baseline?BaselineBeatPattern:BeatPattern;
  return <main style={{width:620,padding:40,fontFamily:'system-ui'}}><h1>Kora presentation qualification</h1>
    <p>Test inputs; software observations. No acoustic or physical synchronization claim.</p>
    <Component session={state.session} beat={state.beat} semanticOnly={state.configuration.semanticOnly} melodyEnabled independentRows
      motionReduced={state.configuration.reduced} motionProfile={state.configuration.profile||'legacy'} motionActive={state.configuration.active!==false}/></main>;
}
createRoot(document.getElementById('root')!).render(<Surface/>);
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
let serial=0;
async function run(configuration:Configuration){
  while(!update)await sleep(10);
  const context=new AudioContext();await context.resume();
  // Keep the real test audio clock advancing; an empty graph may sleep in Chrome.
  const clockSource=context.createConstantSource();clockSource.offset.value=0;clockSource.connect(context.destination);clockSource.start();
  await sleep(40);
  const originalRandom=Math.random;if(configuration.exclusive)Math.random=()=>0;
  const generation=++serial,owner={...session,generation},config={...configuration},rows:Input[]=structuredClone(configuration.input);
  let beat={...empty,sourceGeneration:generation,synchronizationEpoch:`run-${generation}`} as MusicBeatState;
  if(configuration.splitLead)beat={...beat,visualAttacks:undefined};
  let current={...owner};
  update(beat,current,config);await sleep(40);
  beatTelemetry.enable();beatTelemetry.clear();beatPresentationDiagnostics.clear();beatRowDiagnostics.start(30);
  const started=Date.now()+80,origin=context.currentTime+.08;
  const frames:number[]=[],longTasks:number[]=[],sampledFrames:{at:number;ids:string[]}[]=[];
  const sourceAvailability:{at:number;audioTime:number;epochMs:number}[]=[];
  const presentationStates:{at:number;state:string}[]=[];
  let last:number|undefined,frame:number,stopped=false;
  const observe=(time:number)=>{
    if(stopped)return;
    if(last!==undefined)frames.push(time-last);last=time;
    const state=document.querySelector<HTMLElement>('[data-presentation-state]')?.dataset.presentationState;
    if(state&&presentationStates.at(-1)?.state!==state)presentationStates.push({at:Date.now(),state});
    const ids=[...document.querySelectorAll<HTMLElement>('[data-semantic="true"][data-event-id][data-beat-trace]')]
      .filter(e=>getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'&&Number(getComputedStyle(e).opacity)>.001)
      .map(e=>e.dataset.eventId!);
    if(ids.length&&sampledFrames.length<10000)sampledFrames.push({at:Date.now(),ids:[...new Set(ids)]});
    frame=requestAnimationFrame(observe);
  };frame=requestAnimationFrame(observe);
  const observer=new PerformanceObserver(list=>list.getEntries().forEach(e=>longTasks.push(e.duration)));observer.observe({type:'longtask'});
  let stress:ReturnType<typeof setInterval>|undefined;
  if(configuration.stress)stress=setInterval(()=>{const end=performance.now()+35;while(performance.now()<end){/* bounded busy UI task */}},180);
  const accepted:{id:string;key:string;band:BeatBand;target:number;at:number;audioTime:number}[]=[];
  const lifecycle:{action:string;semanticElements:number;animations:number}[]=[];
  try{
    for(const input of rows){
      const target=origin+input.at/1000;
      await sleep(Math.max(0,(target-context.currentTime)*1000));
      const now=Date.now();sourceAvailability.push({at:input.at,audioTime:context.currentTime,epochMs:now});
      const attacks=input.bands.map((band,j)=>{
        const eventId=`${configuration.name}:${accepted.length+j}`,id=`run-${generation}:${eventId}`;
        const trace:BeatTrace={id,eventId,source:'onset',type:band==='clap'?'snare':band==='melody'?'melodic':band,confidence:1,detectedAt:now,
          targetTime:started+input.at,targetClock:'epoch-ms',targetPlaybackTime:input.at/1000,eventSource:'local',captureId:'fixture'};
        beatTelemetry.at('presentation-fixture').record('EVENT_ACCEPTED',trace,{testFixture:true});
        return Object.freeze({key:id,band,deadlineMs:trace.targetTime,durationMs:(input.duration||0)*1000,trace:Object.freeze(trace)});
      });
      const onsets={...beat.onsets},telemetry={...beat.telemetry},durations={...beat.durations};
      for(const attack of attacks){onsets[attack.band]=(onsets[attack.band]||0)+1;telemetry[`onset:${attack.trace.type}`]=attack.trace;durations[attack.band]=input.duration||0;
        accepted.push({id:attack.trace.eventId!,key:attack.key,band:attack.band,target:attack.deadlineMs,at:now,audioTime:context.currentTime});}
      beat={...beat,onsets,telemetry,durations,visualAttacks:configuration.splitLead&&beat.visualAttacks===undefined&&input.bands.every(b=>b==='melody')?undefined
        :[...(beat.visualAttacks||[]),...attacks.filter(a=>!configuration.stateLead||a.band!=='melody')].slice(-64),
        ...(input.bands.includes('melody')?{melody:{active:true,level:.7,note:accepted.length}}:{})};
      current={...current,currentTime:configuration.exclusive?36+input.at/1000:input.at/1000};
      update(beat,current,config);
    }
    if(configuration.degraded){
      beat={...beat,eventPath:'degraded',tempo:{locked:true,bpm:120,confidence:1},tickCount:0};update(beat,current,config);await sleep(20);
      beat={...beat,tickCount:1};update(beat,current,config);await sleep(80);
    }
    if(configuration.lifecycle){
      await sleep(35);
      const sample=(action:string)=>lifecycle.push({action,semanticElements:document.querySelectorAll('[data-semantic="true"][data-beat-trace]').length,animations:document.getAnimations().length});
      for(const [action,patch]of [['pause',{playing:false,paused:true}],['seek',{seeking:true}],['buffering',{buffering:true}],['source-replacement',{generation:generation+1}]] as const){
        update(beat,{...current,...patch},config);await sleep(20);sample(action);
        update(beat,current,config);await sleep(20);sample(action+'-resume-no-replay');
      }
      update(beat,current,{...config,active:false});await sleep(20);sample('inactive-view');
      update(beat,current,config);await sleep(20);sample('active-view-no-replay');
      beat={...beat,captureId:'replacement'};update(beat,current,config);await sleep(20);sample('capture-replacement');
      beat={...beat,synchronizationEpoch:'replacement-epoch'};update(beat,current,config);await sleep(20);sample('epoch-replacement');
    }
    await sleep(configuration.milliseconds||500);
    const result={name:configuration.name,configuration,accepted,sourceAvailability,
      audioClock:{origin,startEpoch:started,sampleRate:context.sampleRate,clockSource:'Silent source keeps the test clock running; it produces no semantic events',clockMapping:'AudioContext and Date sampled together; uncertainty includes JS scheduling, not calibrated'},
      rows:beatRowDiagnostics.snapshot(),decisions:beatPresentationDiagnostics.snapshot(),telemetry:beatTelemetry.snapshot(),
      rafGaps:frames,longTasks,sampledFrames,lifecycle,presentationStates,activeAnimations:document.getAnimations().length,domNodes:document.querySelectorAll('*').length};
    update({...beat,mode:'clock',visualAttacks:[],onsets:{}},{...current,playing:false,paused:true},config);
    await sleep(450);
    return {...result,animationsAfterStop:document.getAnimations().length,staleAfterStop:document.querySelectorAll('[data-semantic="true"][data-beat-trace]').length};
  }finally{
    stopped=true;cancelAnimationFrame(frame!);observer.disconnect();clearInterval(stress);Math.random=originalRandom;clockSource.stop();clockSource.disconnect();await context.close();
    update({...empty,mode:'clock'},{...session,playing:false,paused:true},config);
  }
}
Object.assign(window,{__p3Qualification:{run}});
