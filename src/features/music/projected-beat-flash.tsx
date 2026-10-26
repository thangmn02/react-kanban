import {memo,useLayoutEffect,useRef,type CSSProperties} from 'react';
import type {VisualAttack} from './semantic-motion';
import {attackLifetime} from './use-presentation-attacks';
import {flashAttributes,recordCellFlash} from './beat-row-diagnostics';
import {beatPresentationDiagnostics} from './beat-presentation-diagnostics';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
const telemetry=beatTelemetry.at('beat-renderer');

/** Existing semantic flash material, independently keyed by accepted identity. */
export const ProjectedBeatFlash=memo(function ProjectedBeatFlash({attack,row,cell,semanticOnly=false,reduced=false}: {
  attack:VisualAttack;row:number;cell:number;semanticOnly?:boolean;reduced?:boolean;
}){
  const element=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>{
    const node=element.current;if(!node)return;
    const remaining=attack.deadlineMs-Date.now();
    node.style.animationDelay=`${remaining}ms`;
    let startTimer:ReturnType<typeof setTimeout>|undefined;
    if(remaining>0){node.style.visibility='hidden';startTimer=setTimeout(()=>{node.style.visibility='';},remaining);}
    recordCellFlash(node,'commit');
    telemetry.record('EVENT_COMMITTED',attack.trace,{semantic:true,row:row+1,cell:cell+1});
    beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'commit',reason:'dom-commit',deadlineMs:attack.deadlineMs,profile:semanticOnly?'semantic-only':'normal'});
    if(!beatTelemetry.enabled)return()=>clearTimeout(startTimer);
    const view=node.ownerDocument.defaultView!;let frame:number;
    let observed=false;
    const sample=()=>{
      if(!node.isConnected||node.ownerDocument.hidden)return;
      const at=Date.now(),style=view.getComputedStyle(node);
      if(at>=attack.deadlineMs&&Number(style.opacity)>.001&&style.display!=='none'&&style.visibility!=='hidden'){
        observed=true;recordCellFlash(node,'frame');
        beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'frame',reason:reduced?'reduced-static':'positive-opacity',deadlineMs:attack.deadlineMs,profile:semanticOnly?'semantic-only':'normal'});
      }else if(at<attack.deadlineMs+attackLifetime(attack))frame=view.requestAnimationFrame(sample);
    };
    frame=view.requestAnimationFrame(sample);
    return()=>{
      view.cancelAnimationFrame(frame);
      clearTimeout(startTimer);
      if(!observed)beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'frame',reason:Date.now()<attack.deadlineMs+attackLifetime(attack)?'canceled-before-frame':'expired-without-frame',deadlineMs:attack.deadlineMs,profile:semanticOnly?'semantic-only':'normal'});
    };
  },[attack,row,cell,semanticOnly,reduced]);
  const trace=attack.trace;
  return <span ref={element} className={`semantic-beat-flash projected-beat-flash${reduced?' reduced':''}`}
    {...flashAttributes(trace,row,cell)} data-beat-trace={trace?.id||attack.key} data-event-id={trace?.eventId||attack.key}
    data-event-type={attack.band==='clap'?'snare':attack.band} data-semantic="true" data-presentation="semantic-hit"
    style={{'--semantic-flash-duration':`${attackLifetime(attack)}ms`,animationFillMode:'forwards'} as CSSProperties}
    onAnimationStart={event=>{if(event.target!==event.currentTarget)return;recordCellFlash(event.currentTarget,'animation');
      telemetry.record('EVENT_RENDERED',trace,{semantic:true,row:row+1,cell:cell+1});}}/>;
});
