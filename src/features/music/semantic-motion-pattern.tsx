import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import type {BrowserMusicSession,BeatBand} from './mediaBridge';
import type {MusicBeatState} from './useMusicBeatSync';
import {activeSteps,reshuffleEpoch} from './beatVisuals';
import {burstIntervalMs,createSemanticMotion,instrumentMotion,motionDuration,lateLivePresentation,patternCells,patternNames,type MotionProfile} from './semantic-motion';
import {flashAttributes,recordCellFlash} from './beat-row-diagnostics';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
import {beatPresentationDiagnostics} from './beat-presentation-diagnostics';
import './semantic-motion.css';
import {BeatHeartbeat} from './beat-heartbeat';

const bands:BeatBand[]=['kick','clap','hat','bass','melody'];
const telemetry=beatTelemetry.at('beat-renderer');
export function SemanticMotionPattern({session,beat,profile,reduced=false,active=true,orientation='horizontal',melodyEnabled=false,semanticOnly=false,melodyEvents,lateLivePreview=false}: {
  session?:BrowserMusicSession;beat:MusicBeatState;profile:MotionProfile;reduced?:boolean;orientation?:'horizontal'|'vertical';
  melodyEnabled?:boolean;semanticOnly?:boolean;active?:boolean;melodyEvents?:readonly {id:string;duration:number}[];
  lateLivePreview?:boolean;
}){
  const root=useRef<HTMLDivElement>(null),renderer=useRef<ReturnType<typeof createSemanticMotion>|null>(null);
  const frames=useRef(new Set<number>());
  const motionInspection=useRef<{attempts:number;last:Record<string,unknown>[]}>({attempts:0,last:[]});
  const inspect=import.meta.env.DEV&&new URLSearchParams(window.location.search).has('musicDebug');
  const [forcedColors,setForcedColors]=useState(()=>window.matchMedia?.('(forced-colors: active)').matches===true);
  const reduce=reduced||forcedColors;
  const gate=useRef({owner:'',seen:new Set<string>(),melodyNote:undefined as number|undefined,initialized:false});
  const bursts=useRef({owner:'',next:undefined as number|undefined,index:0});
  const generation=beat.sourceGeneration??session?.generation;
  const generationMatches=beat.sourceGeneration===undefined||session?.generation===undefined||beat.sourceGeneration===session.generation;
  const owner=active&&session?.playing&&!session.paused&&!session.buffering&&!session.seeking&&beat.mode==='capture'&&beat.sessionId===session.id&&generationMatches
    ?`${session.id}:${beat.captureId}:${generation??''}:${beat.synchronizationEpoch||''}`:'';
  const latest=useRef(beat);useLayoutEffect(()=>{latest.current=beat;});
  useLayoutEffect(()=>{
    const element=root.current;if(!element)return;
    const query=element.ownerDocument.defaultView?.matchMedia?.('(forced-colors: active)');
    const update=()=>setForcedColors(query?.matches===true);query?.addEventListener?.('change',update);
    return()=>query?.removeEventListener?.('change',update);
  },[]);
  useLayoutEffect(()=>{
    const element=root.current;if(!element)return;
    const engine=createSemanticMotion(element,profile,reduce);renderer.current=engine;
    // Remount/visibility resets seed snapshots. Owner/profile changes retain
    // known IDs while allowing a fresh attack delivered atomically with them.
    const seed=(reason:string)=>{
      const seen=!gate.current.initialized||reason==='visibility-reset'?new Set([...(latest.current.visualAttacks||[]).map(a=>a.key),...Object.values(latest.current.telemetry||{}).map(t=>t.id)]):gate.current.seen;
      gate.current={owner,melodyNote:latest.current.melody?.note,seen,initialized:true};
      for(const attack of latest.current.visualAttacks||[])if(seen.has(attack.key))beatPresentationDiagnostics.record({key:attack.key,band:attack.band,
        stage:'seed',reason,deadlineMs:attack.deadlineMs,owner,profile,hidden:element.ownerDocument.hidden});
    };
    seed('mount-owner-or-profile');
    const clearFrames=()=>{frames.current.forEach(id=>element.ownerDocument.defaultView?.cancelAnimationFrame(id));frames.current.clear();};
    const visibility=()=>{engine.reset();clearFrames();seed('visibility-reset');};element.ownerDocument.addEventListener('visibilitychange',visibility);
    return()=>{beatPresentationDiagnostics.record({key:'renderer-lifecycle',band:'all',stage:'cleanup',reason:'dispose',owner,profile});engine.dispose();clearFrames();element.ownerDocument.removeEventListener('visibilitychange',visibility);renderer.current=null;};
  },[owner,profile,reduce,orientation,melodyEnabled,lateLivePreview]);
  useLayoutEffect(()=>{
    const element=root.current,engine=renderer.current;if(!element||!engine)return;
    const projected=[...(beat.visualAttacks||[])];
    for(const trace of Object.values(beat.telemetry||{})){
      const band=(trace.type==='snare'?'clap':trace.type==='melodic'?'melody':trace.type) as BeatBand;
      if(trace.source!=='onset'||!bands.includes(band)||!['cache','local'].includes(trace.eventSource||'')||trace.targetClock!=='epoch-ms')continue;
      if(!projected.some(a=>a.key===trace.id))projected.push({key:trace.id,band,deadlineMs:trace.targetTime,trace,
        durationMs:band==='melody'?(melodyEvents?.find(e=>e.id===trace.eventId)?.duration||0)*1000:beat.durations?.[band]?beat.durations[band]!*1000:undefined});
    }
    for(const attack of projected){
      if(gate.current.seen.has(attack.key))continue;
      gate.current.seen.add(attack.key);
      if(!owner||attack.band==='melody'&&!melodyEnabled){
        beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'gate',reason:!owner?'inactive-owner':'melody-disabled',
          deadlineMs:attack.deadlineMs,owner,profile,hidden:element.ownerDocument.hidden,active});
        continue;
      }
      const row=bands.indexOf(attack.band);
      const cellIndices=semanticOnly?[[...(attack.trace?.id||attack.key)].reduce((sum,c)=>sum+c.charCodeAt(0),0)%8]
        :activeSteps(session!.id,reshuffleEpoch(session?.currentTime||0,beat.tempo?.locked?beat.tempo.bpm:null),row).flatMap((selected,i)=>selected?[i]:[]);
      const cells=cellIndices.flatMap(index=>{
        const cell=element.querySelector<HTMLElement>(`[data-motion-band="${attack.band}"] [data-motion-cell="${index}"]`);return cell?[cell]:[];
      });
      const cell=cells[0],cellIndex=cellIndices[0];
      if(!cell){beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'gate',reason:'no-cell',deadlineMs:attack.deadlineMs,owner,profile,cells:0});continue;}
      const presentation=lateLivePresentation(attack,lateLivePreview);
      if(bursts.current.owner!==owner)bursts.current={owner,next:undefined,index:bursts.current.index};
      const interval=burstIntervalMs(beat.tempo?.locked?beat.tempo.bpm:null);
      if(attack.band==='kick'&&!semanticOnly&&!reduce){
        const gateBurst=bursts.current;
        if(gateBurst.next===undefined)gateBurst.next=presentation.deadlineMs+interval;
        else if(presentation.deadlineMs>=gateBurst.next){
          const name=patternNames[gateBurst.index%patternNames.length],visibleBands=bands.filter(b=>melodyEnabled||b!=='melody');
          const lit=patternCells(name,visibleBands.length).flatMap(({row,step,delay})=>{
            const target=element.querySelector<HTMLElement>(`[data-motion-band="${visibleBands[row]}"] [data-motion-cell="${step}"]`);return target?[{cell:target,delay}]:[];});
          const shown=engine.burst(name,presentation.deadlineMs,lit);
          beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'play',reason:shown==='pattern'?'pattern-burst:'+name:shown,deadlineMs:attack.deadlineMs,owner,profile,cells:lit.length});
          if(shown==='pattern'){gateBurst.index++;gateBurst.next=presentation.deadlineMs+interval;continue;}
        }
      }
      const result=engine.play(presentation,cells);
      beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'play',reason:result,deadlineMs:attack.deadlineMs,
        presentationTimeMs:presentation.deadlineMs,lateLivePreview:presentation!==attack,
        owner,profile,cells:cells.length,hidden:element.ownerDocument.hidden,active});
      if(inspect){
        const sample=Date.now(),view=element.ownerDocument.defaultView,layer=cell.querySelector<HTMLElement>('.motion-body');
        const animations=cell.getAnimations?.({subtree:true})||[],style=layer&&view?.getComputedStyle(layer);
        motionInspection.current.attempts++;
        motionInspection.current.last=[...motionInspection.current.last,{key:attack.key,band:attack.band,result,deadlineMs:attack.deadlineMs,
          sampledAt:sample,ageMs:sample-attack.deadlineMs,performanceTime:view?.performance.now(),timelineTime:element.ownerDocument.timeline?.currentTime,
          animations:animations.map(a=>({startTime:a.startTime,currentTime:a.currentTime,playState:a.playState,pending:a.pending})),
          layer:style?{display:style.display,visibility:style.visibility,opacity:style.opacity,backgroundImage:style.backgroundImage,width:style.width,height:style.height}:null}].slice(-8);
        element.dataset.motionInspection=JSON.stringify(motionInspection.current);
      }
      if(result==='expired'||result==='hidden-or-invalid'||result==='pattern-exclusive')continue;
      const traceElement=cell.querySelector<HTMLElement>('.motion-body')!;
      traceElement.dataset.presentationTime=String(presentation.deadlineMs);
      traceElement.dataset.originalDeadline=String(attack.deadlineMs);
      traceElement.dataset.lateLivePreview=String(presentation!==attack);
      for(const [key,value]of Object.entries(flashAttributes(attack.trace,row,cellIndex))){if(value===undefined)traceElement.removeAttribute(key);else traceElement.setAttribute(key,String(value));}
      cell.dataset.visualAttack=attack.key;
      if(attack.trace){recordCellFlash(traceElement,'commit');telemetry.record('EVENT_COMMITTED',attack.trace,{semantic:true});
        if(result==='animated'&&beatTelemetry.enabled){
          // Sample a positive compositor opacity at RAF, separately from commit.
          // This is a software observation, not physical scan-out.
          const view=element.ownerDocument.defaultView;
          const observe=()=>{
            if(!view)return;
            const id=view.requestAnimationFrame(()=>{
              frames.current.delete(id);
              if(element.ownerDocument.hidden||cell.dataset.visualAttack!==attack.key){
                beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'frame',reason:element.ownerDocument.hidden?'hidden':'superseded',deadlineMs:attack.deadlineMs,owner,profile});return;
              }
              const layers=[...cell.querySelectorAll<HTMLElement>('.instrument-motion-layer')];
              if(layers.some(layer=>Number(view.getComputedStyle(layer).opacity)>.001)){
                recordCellFlash(traceElement,'animation');telemetry.record('EVENT_RENDERED',attack.trace,{semantic:true});
                beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'frame',reason:'positive-opacity',deadlineMs:attack.deadlineMs,owner,profile});
              }else if(Date.now()<presentation.deadlineMs+motionDuration(attack))observe();
              else beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'frame',reason:'expired-without-positive-sample',deadlineMs:attack.deadlineMs,owner,profile});
            });frames.current.add(id);
          };observe();
        }
      }
    }
    if(gate.current.seen.size>512)gate.current.seen=new Set(projected.map(a=>a.key));
    const melody=[...element.querySelectorAll<HTMLElement>('[data-motion-band="melody"] :is([data-motion-active],[data-motion-sustain])')];
    if(!melody.length){
      const selected=semanticOnly?[0]:activeSteps(session?.id||'empty',reshuffleEpoch(session?.currentTime||0,beat.tempo?.locked?beat.tempo.bpm:null),4).flatMap((on,i)=>on?[i]:[]);
      selected.forEach(index=>{const cell=element.querySelector<HTMLElement>(`[data-motion-band="melody"] [data-motion-cell="${index}"]`);if(cell)melody.push(cell);});
    }
    engine.sustainMelody(melody,Boolean(owner)&&melodyEnabled&&beat.melody?.active&&beat.melody.note!==gate.current.melodyNote?beat.melody.level:0);
  },[beat,owner,melodyEnabled,semanticOnly,session,melodyEvents,profile,inspect,active,lateLivePreview,reduce]);
  const visible=bands.filter(b=>melodyEnabled||b!=='melody');
  return <div ref={root} className={`music-pattern semantic-motion ${orientation}${semanticOnly?' semantic-only':''}`} data-motion-profile={profile}
    data-motion-variant="kinetic"
    data-late-live-preview={lateLivePreview}
    data-optical={profile==='focus'?'hybrid':'eclipse'}
    data-motion-owner={owner?'active':!active?'inactive-view':!session?.playing||session.paused?'not-playing':beat.mode!=='capture'?'not-capturing':'wrong-session'}
    data-motion-inputs={beat.visualAttacks?.length||0}
    data-motion-reduced={reduce} style={{'--beat-rows':visible.length} as CSSProperties} role="img"
    aria-label={`Instrument activity: ${visible.map(b=>instrumentMotion[b].name).join(', ')}. Cells are not rhythmic subdivisions.`}>
    {!semanticOnly&&<BeatHeartbeat owner={owner} beat={beat} reduced={reduce}/>}
    {visible.map(band=><div key={band} className="beat-channel" data-channel={band==='kick'?'drum':band} data-track={instrumentMotion[band].name}
      data-motion-band={band} style={{'--instrument-color':instrumentMotion[band].color,'--c-deep':instrumentMotion[band].deep,'--c-mid':instrumentMotion[band].color,
        '--c-bright':instrumentMotion[band].bright,'--c-hot':instrumentMotion[band].hot,'--c-glow':instrumentMotion[band].glow} as CSSProperties}>
      <span className="channel-icon" title={instrumentMotion[band].name}>{({kick:'●',clap:'⌁',hat:'⌃',bass:'∿',melody:'~'})[band]}</span>
      {Array.from({length:8},(_,i)=><span key={i} className="beat-square" data-motion-cell={i}>
        <span className="motion-shock"/>
        <span className="motion-clip">
          <span className="instrument-motion-layer motion-body"/>
          <span className="instrument-motion-layer motion-edge"/>
          <span className="instrument-motion-layer motion-rim"/>
        </span>
      </span>)}
    </div>)}
  </div>;
}
