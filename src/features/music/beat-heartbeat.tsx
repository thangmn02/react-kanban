import {useLayoutEffect,useRef,type CSSProperties} from 'react';
import type {MusicBeatState} from './useMusicBeatSync';

/** A frame-level breath from released structural ticks. It never schedules a beat. */
export function BeatHeartbeat({owner,beat,reduced=false}: {owner:string;beat:MusicBeatState;reduced?:boolean}){
  const element=useRef<HTMLSpanElement>(null);
  const gate=useRef({owner:'',tick:0});
  const bpm=beat.tempo?.bpm;
  const tickDeadline=beat.telemetry?.['tempo:generic']?.targetClock==='epoch-ms'?beat.telemetry['tempo:generic'].targetTime:undefined;
  const valid=Boolean(owner)&&!reduced&&beat.eventPath!=='degraded'&&beat.tempo?.locked===true&&beat.tempo.confidence>0&&Number.isFinite(bpm)&&bpm!>0;
  useLayoutEffect(()=>{
    const node=element.current;if(!node)return;
    const previous=gate.current;gate.current={owner:valid?owner:'',tick:beat.tickCount||0};
    if(!valid||previous.owner!==owner||(beat.tickCount||0)<=previous.tick||node.ownerDocument.hidden)return;
    const duration=60000/bpm!;
    const elapsed=tickDeadline!==undefined?Math.max(0,Date.now()-tickDeadline):0;
    if(elapsed>=duration||typeof node.animate!=='function')return;
    const animation=node.animate([{opacity:0,transform:'scale(.997)'},{opacity:.22,transform:'scale(1.003)',offset:.3},{opacity:0,transform:'scale(1)'}],
      {duration,easing:'ease-in-out',fill:'none'});
    animation.currentTime=elapsed;
    const hide=()=>animation.cancel();node.ownerDocument.addEventListener('visibilitychange',hide);
    return()=>{animation.cancel();node.ownerDocument.removeEventListener('visibilitychange',hide);};
  },[owner,beat.tickCount,beat.tempo?.locked,bpm,tickDeadline,valid]);
  return <span ref={element} className="kinetic-heartbeat" data-semantic="false" data-presentation="decorative-global"
    data-detector-origin="structural-tempo" data-heartbeat-active={valid} style={{'--heartbeat-bpm':bpm||0} as CSSProperties} aria-hidden="true"/>;
}
