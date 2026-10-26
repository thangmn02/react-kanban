import {useEffect,useRef,useState} from 'react';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
import {beatRowDiagnostics} from './beat-row-diagnostics';
import {beatPresentationDiagnostics} from './beat-presentation-diagnostics';
import {captureLiveDiagnostics,MusicBridgeError} from './mediaBridge';
import type {BrowserMusicController} from './useBrowserMusic';

type Packet={recording?:{status?:string;complete?:boolean;startedAt?:number;endsAt?:number;counts?:{frames?:number};completeness?:unknown};source?:{videoId?:string;clockOverflow?:number;decisionOverflow?:number}};
type Job={id:string;sessionId:string;captureId?:string;generation?:number;epoch?:string;startedAt:number;records:Record<string,unknown>[];context:Record<string,unknown>;
  initialContext:Record<string,unknown>;initialVisual:ReturnType<typeof visualSnapshot>;finished?:boolean;
  frames:{at:number;performanceTime:number;hidden:boolean;gridHidden:boolean;flashes:{traceId:string;opacity:number;animation:string;hasRect:boolean}[]}[];visibility:{at:number;hidden:boolean}[];
  overflow:number;errors:string[];priorTelemetry:boolean;observationStartedAt:number;frameObservationStartedAt?:number;lastFrameSample?:number;sampledOutFrames:number;commonEnd?:number;companion?:Packet;timer?:ReturnType<typeof setTimeout>;cancelWait?:()=>void;raf?:number;unsubscribe?:()=>void;removeVisibility?:()=>void};
const stopObserving=(value:Job)=>{clearTimeout(value.timer);value.cancelWait?.();if(value.raf!==undefined)cancelAnimationFrame(value.raf);value.unsubscribe?.();value.removeVisibility?.();beatTelemetry.enable(value.priorTelemetry);};
const context=(music:BrowserMusicController)=>JSON.parse(JSON.stringify({source:music.source,captureStatus:music.selected?.syncState,
  playback:{playing:music.selected?.playing,paused:music.selected?.paused,currentTime:music.selected?.currentTime},
  controller:{mode:music.beat.mode,eventPath:music.beat.eventPath,onsets:music.beat.onsets,captureId:music.beat.captureId,
    sourceGeneration:music.beat.sourceGeneration,synchronizationEpoch:music.beat.synchronizationEpoch,
    visualAttacks:music.beat.visualAttacks?.slice(-8).map(a=>({key:a.key,band:a.band,deadlineMs:a.deadlineMs,durationMs:a.durationMs}))}})) as Record<string,unknown>;
function visualSnapshot(scope:ParentNode|undefined){
  const motion=scope?.querySelector<HTMLElement>('.semantic-motion');
  return motion?{profile:motion.dataset.motionProfile,reduced:motion.dataset.motionReduced,owner:motion.dataset.motionOwner,
    projectedInputs:motion.dataset.motionInputs,inspection:motion.dataset.motionInspection?JSON.parse(motion.dataset.motionInspection):null,diagnosticVersion:1}:null;
}
const generation=(music:BrowserMusicController)=>music.beat.sourceGeneration??music.selected?.syncState?.capability?.generation??music.selected?.generation;
const changedOwner=(value:Job,music:BrowserMusicController)=>music.selected?.id!==value.sessionId||music.selected?.syncState?.captureId!==value.captureId
  ||generation(music)!==value.generation
  ||[music.selected?.syncState?.capability?.generation,music.selected?.generation].some(g=>g!==undefined&&value.generation!==undefined&&g!==value.generation)
  ||value.epoch!==undefined&&music.beat.synchronizationEpoch!==value.epoch||Boolean(music.beta?.enabled);
export default function LivePipelineTraceControl({music}:{music:BrowserMusicController}){
  const job=useRef<Job|null>(null),current=useRef(music),panel=useRef<HTMLElement|null>(null);
  useEffect(()=>{current.current=music;},[music]);
  const [status,setStatus]=useState('Ready to record continuous scores and the live grid. No audio is stored.');
  const [busy,setBusy]=useState(false),[ready,setReady]=useState(false);
  useEffect(()=>{
    const value=job.current;if(!value||value.finished||!changedOwner(value,music))return;
    value.finished=true;value.errors.push('Source, generation, synchronization epoch or playback owner changed during recording.');
    value.context={...context(music),ownershipChange:{at:Date.now(),expected:{sessionId:value.sessionId,captureId:value.captureId,generation:value.generation,epoch:value.epoch},
      observed:{sessionId:music.selected?.id,captureId:music.selected?.syncState?.captureId,generation:generation(music),epoch:music.beat.synchronizationEpoch,
        capabilityGeneration:music.selected?.syncState?.capability?.generation,sessionGeneration:music.selected?.generation}}};
    stopObserving(value);beatRowDiagnostics.stop();setBusy(false);setReady(true);setStatus('INCOMPLETE: source ownership changed. Export the partial bundle before recording again.');
    void captureLiveDiagnostics(value.sessionId,{operation:'stop',recordingId:value.id}).catch(()=>{});
  },[music]);
  useEffect(()=>()=>{const value=job.current;job.current=null;if(value){stopObserving(value);void captureLiveDiagnostics(value.sessionId,{operation:'stop',recordingId:value.id}).catch(()=>{});}},[]);
  const start=async()=>{
    const selected=current.current.selected;
    if(!selected||current.current.beta?.enabled||selected.syncState?.mode!=='capture'||!selected.playing){setStatus('Play one Companion source with Hybrid Beta OFF before recording.');return;}
    if(job.current)stopObserving(job.current);
    const value:Job={id:crypto.randomUUID(),sessionId:selected.id,captureId:selected.syncState.captureId,
      generation:generation(current.current),epoch:current.current.beat.synchronizationEpoch,
      startedAt:Date.now(),observationStartedAt:Date.now(),priorTelemetry:beatTelemetry.enabled,sampledOutFrames:0,records:[],frames:[],visibility:[],overflow:0,errors:[],context:context(current.current),
      initialContext:context(current.current),initialVisual:visualSnapshot(panel.current?.getRootNode() as Document|ShadowRoot)};
    job.current=value;setBusy(true);setReady(false);beatTelemetry.clear();beatTelemetry.enable();beatPresentationDiagnostics.clear();beatRowDiagnostics.start(30);
    value.unsubscribe=beatTelemetry.subscribe(record=>{if(value.records.length<20000)value.records.push(record);else value.overflow++;});
    const visibility=()=>{if(value.visibility.length<128)value.visibility.push({at:Date.now(),hidden:document.hidden});else value.overflow++;};
    document.addEventListener('visibilitychange',visibility);value.removeVisibility=()=>document.removeEventListener('visibilitychange',visibility);visibility();
    const frame=(performanceTime:number)=>{
      if(job.current!==value||value.finished)return;
      if(value.lastFrameSample!==undefined&&performanceTime-value.lastFrameSample<16){
        value.sampledOutFrames++;if(Date.now()<(value.commonEnd??value.startedAt+30000)+1000)value.raf=requestAnimationFrame(frame);return;
      }
      value.lastFrameSample=performanceTime;
      const elements=[...(panel.current?.getRootNode() as Document|ShadowRoot)?.querySelectorAll<HTMLElement>('.semantic-beat-flash[data-beat-trace], .instrument-motion-layer[data-beat-trace]')||[]];
      if(elements.length>16)value.overflow++;
      if(value.frames.length<Math.max(2200,Math.ceil(((value.commonEnd??value.startedAt+30000)-value.startedAt+1000)/16)+128))value.frames.push({at:Date.now(),performanceTime,hidden:document.hidden,
        gridHidden:panel.current?.closest('[role="tabpanel"]')?.getAttribute('aria-hidden')==='true',
        flashes:elements.slice(0,16).map(cell=>{const style=getComputedStyle(cell);return {traceId:cell.dataset.beatTrace!,
          opacity:Number(style.opacity),animation:style.animationName,hasRect:cell.getClientRects().length>0};})});else value.overflow++;
      if(Date.now()<(value.commonEnd??value.startedAt+30000)+1000)value.raf=requestAnimationFrame(frame);
    };
    const finish=async()=>{
      if(job.current!==value)return;
      try{
        const packet=await captureLiveDiagnostics(value.sessionId,{operation:'read',recordingId:value.id}) as Packet;
        if(job.current!==value||value.finished)return;
        value.companion=packet;
        if(packet.recording?.status==='RECORDING'&&Date.now()<(value.commonEnd??value.startedAt+30000)+5000){value.timer=setTimeout(()=>void finish(),400);return;}
        if(!packet.recording?.complete)value.errors.push('Companion raw-score capture is incomplete; inspect coverage, interruptions and overflow.');
      }catch{value.errors.push('Companion read failed or source ownership changed. Raw evidence is unavailable; no missing score is a detector miss.');}
      value.finished=true;value.context=context(current.current);stopObserving(value);beatRowDiagnostics.stop();setBusy(false);setReady(true);
      setStatus(value.errors.length?`INCOMPLETE: ${value.errors.join(' ')}`:`Capture ready: ${value.companion?.recording?.counts?.frames??0} raw frames. Export one synchronized bundle.`);
    };
    setStatus('Recording 30 seconds. Listen normally; raw scores include periods without emitted Hats.');
    try{
      let packet:Packet;
      while(true){
        if(job.current!==value||value.finished)return;
        try{packet=await captureLiveDiagnostics(value.sessionId,{operation:'start',recordingId:value.id}) as Packet;break;}
        catch(error){
          if(!(error instanceof MusicBridgeError)||error.diagnosticReason!=='detector-not-ready'||Date.now()-value.observationStartedAt>8000)throw error;
          setStatus('Waiting for the detector to finish startup. Recording will begin automatically.');
          await new Promise<void>(resolve=>{value.cancelWait=resolve;value.timer=setTimeout(()=>{value.cancelWait=undefined;resolve();},300);});
        }
      }
      if(job.current!==value||value.finished)return;value.companion=packet;
      const acknowledgedStart=packet.recording?.startedAt,acknowledgedEnd=packet.recording?.endsAt;
      if(!Number.isFinite(acknowledgedStart)||!Number.isFinite(acknowledgedEnd)||![30000,60000,90000].includes(acknowledgedEnd!-acknowledgedStart!))throw Error('Missing synchronized recording boundary');
      value.startedAt=acknowledgedStart!;value.commonEnd=acknowledgedEnd!;
      value.frameObservationStartedAt=Date.now();
      if(value.frameObservationStartedAt>value.startedAt)value.errors.push('The common-window acknowledgement arrived after its start; the leading visual observation is incomplete.');
      value.raf=requestAnimationFrame(frame);
      beatRowDiagnostics.alignWindow(value.startedAt,value.commonEnd+1000);
      setStatus(`Recording source video ${packet.source?.videoId||'UNVERIFIED'}. Listen normally for ${(value.commonEnd-value.startedAt)/1000} seconds; export unlocks after the final context drains.`);
      value.timer=setTimeout(()=>void finish(),Math.max(0,value.commonEnd+1300-Date.now()));
    }catch(error){
      if(job.current!==value||value.finished)return;value.finished=true;value.errors.push(error instanceof MusicBridgeError&&error.diagnosticReason==='detector-not-ready'
        ?'Detector startup did not finish within 8 seconds. The partial bundle does not establish model misses.'
        :'Private Companion continuous diagnostics unavailable. Rebuild/reload the diagnostic candidate; the row-only export cannot explain model misses.'+(error instanceof MusicBridgeError&&error.diagnosticReason?' Reason: '+error.diagnosticReason:''));
      void captureLiveDiagnostics(value.sessionId,{operation:'stop',recordingId:value.id}).catch(()=>{});
      stopObserving(value);beatRowDiagnostics.stop();setBusy(false);setReady(true);setStatus('INCOMPLETE: '+value.errors[0]);
    }
  };
  const exportTrace=()=>{
    const value=job.current;if(!value||busy)return;
    const rows=beatRowDiagnostics.snapshot();
    const complete=Boolean(value.companion?.recording?.complete&&rows.complete&&!value.errors.length&&!value.overflow&&!value.companion?.source?.clockOverflow&&!value.companion?.source?.decisionOverflow);
    const visualPresentation=visualSnapshot(panel.current?.getRootNode() as Document|ShadowRoot);
    const snapshot={...rows,...value.context,complete,visualPresentation,presentationDecisions:beatPresentationDiagnostics.snapshot(),telemetry:{enabled:true,evicted:value.overflow,records:value.records},
      liveDiagnostics:{version:1,id:value.id,startedAt:value.startedAt,companion:value.companion,errors:value.errors,
        initialContext:value.initialContext,initialVisualPresentation:value.initialVisual,
        commonWindow:{epochStart:value.startedAt,epochEnd:value.commonEnd},applicationObservationStartedAt:value.observationStartedAt,frameObservationStartedAt:value.frameObservationStartedAt,
        applicationRecordsScope:`Includes startup and drain context. Select event roots by sourceAudioTime within the Companion audioContextStart + ${((value.commonEnd??value.startedAt+30000)-value.startedAt)/1000} seconds, then join later stages by exact identity.`,
        frameSamples:value.frames,visibility:value.visibility,applicationOverflow:value.overflow,
        frameSampling:{minimumIntervalMs:16,notStoredAnimationFrames:value.sampledOutFrames},
        acousticReference:'UNVERIFIED',physicalPixelIllumination:'UNVERIFIED',audioStored:false,hybridBetaEnabled:false}};
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`kora-live-diagnostic-${value.companion?.source?.videoId||'unbound'}-${value.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section ref={panel} aria-label="Private Live failure capture"><p role="status">{status}</p>
    <button type="button" className="text-button" disabled={busy} onClick={()=>void start()}>Record 30 seconds</button>{' '}
    <button type="button" className="text-button" disabled={busy||!ready} onClick={exportTrace}>Export row trace</button>
    <p>One metadata bundle includes raw heads, original classes, clock anchors, postprocessing, transport and grid records. Animation callbacks and sampled DOM state do not prove physical flashes.</p>
  </section>;
}
