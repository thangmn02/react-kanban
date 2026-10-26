import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {BeatTrace} from '../../../extensions/kanban-music/beat-telemetry.js';
import type {VisualAttack} from './semantic-motion';
import {beatPresentationDiagnostics} from './beat-presentation-diagnostics';

export function attackLifetime(attack:VisualAttack){
  return attack.band==='bass'?Math.max(150,Math.min(2000,attack.durationMs||0))
    :attack.band==='melody'?Math.max(150,Math.min(450,attack.durationMs||0)):150;
}

/** Consume the existing bounded accepted-event projection, never row counter deltas. */
export function usePresentationAttacks(rawInput:readonly VisualAttack[]|undefined,owner:string,profile:string,suppression?:string,melodyEnabled=false,leadTrace?:BeatTrace,leadDurationMs=150){
  const normalizedLead=leadTrace?.source==='onset'&&leadTrace.type==='melodic'&&['cache','local'].includes(leadTrace.eventSource||'')
    &&leadTrace.targetClock==='epoch-ms'&&Number.isFinite(leadTrace.targetTime)&&Number.isFinite(leadTrace.targetPlaybackTime)?leadTrace:undefined;
  // Cached Lead uses the existing accepted melody.state contract, rather than
  // the percussion projection. Retain its trace without inventing an onset.
  const input=useMemo(()=>{
    if(rawInput===undefined||!normalizedLead||rawInput.some(a=>a.key===normalizedLead.id))return rawInput;
    return [...rawInput,{key:normalizedLead.id,band:'melody' as const,deadlineMs:normalizedLead.targetTime,durationMs:leadDurationMs,trace:normalizedLead}];
  },[rawInput,normalizedLead,leadDurationMs]);
  const gate=useRef({owner:'',seen:new Set<string>(),initialized:false});
  const [state,setState]=useState<{owner:string;attacks:VisualAttack[]}>({owner:'',attacks:[]});
  const [visible,setVisible]=useState(()=>!document.hidden);
  useLayoutEffect(()=>{
    const update=()=>setVisible(!document.hidden);
    document.addEventListener('visibilitychange',update);
    return()=>document.removeEventListener('visibilitychange',update);
  },[]);
  const effectiveOwner=visible?owner:'';
  useLayoutEffect(()=>{
    if(!gate.current.initialized){
      gate.current={owner:effectiveOwner,seen:new Set([...(input||[]).map(a=>a.key),...(input===undefined&&normalizedLead?[normalizedLead.id]:[])]),initialized:true};
      for(const attack of input||[])beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'seed',reason:'mount-snapshot',owner:effectiveOwner,profile});
      setState({owner:effectiveOwner,attacks:[]});return;
    }
    const ownerChanged=gate.current.owner!==effectiveOwner;
    if(ownerChanged){
      for(const attack of state.attacks)beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'gate',reason:'owner-reset',owner:state.owner,profile});
      gate.current.owner=effectiveOwner;
    }
    if(input===undefined){
      if(normalizedLead&&!gate.current.seen.has(normalizedLead.id)){
        gate.current.seen.add(normalizedLead.id);
        if(gate.current.seen.size>1024)gate.current.seen=new Set([normalizedLead.id]);
        beatPresentationDiagnostics.record({key:normalizedLead.id,band:'melody',stage:'seed',reason:effectiveOwner?'legacy-owned':'inactive-owner',owner:effectiveOwner,profile,deadlineMs:normalizedLead.targetTime});
      }
      if(ownerChanged)setState({owner:effectiveOwner,attacks:[]});return;
    }
    const fresh:VisualAttack[]=[];
    for(const attack of input){
      if(gate.current.seen.has(attack.key))continue;
      gate.current.seen.add(attack.key);
      const reason=(!effectiveOwner?'inactive-owner':undefined)||suppression||(attack.band==='melody'&&!melodyEnabled?'melody-disabled':undefined)
        ||(!Number.isFinite(attack.deadlineMs)?'invalid-deadline':Date.now()>=attack.deadlineMs+attackLifetime(attack)?'expired':undefined);
      beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'gate',reason:reason||'present',deadlineMs:attack.deadlineMs,owner:effectiveOwner,profile});
      if(!reason)fresh.push(attack);
    }
    if(gate.current.seen.size>1024)gate.current.seen=new Set(input.map(a=>a.key));
    if(suppression||!effectiveOwner){
      if(state.attacks.length){
        for(const attack of state.attacks)beatPresentationDiagnostics.record({key:attack.key,band:attack.band,stage:'cleanup',reason:suppression||'inactive-owner',owner:effectiveOwner,profile});
        setState({owner:effectiveOwner,attacks:[]});
      }
    }else if(fresh.length||ownerChanged)setState(previous=>({owner:effectiveOwner,attacks:[...(previous.owner===effectiveOwner?previous.attacks:[]),...fresh]}));
    // State is output, not an input: reprocessing it would re-seed or duplicate events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[input,effectiveOwner,suppression,melodyEnabled,profile,normalizedLead]);
  useLayoutEffect(()=>{
    if(!state.attacks.length)return;
    const next=Math.min(...state.attacks.map(a=>a.deadlineMs+attackLifetime(a)));
    const timer=setTimeout(()=>setState(previous=>({...previous,attacks:previous.attacks.filter(a=>a.deadlineMs+attackLifetime(a)>Date.now())})),Math.max(0,next-Date.now()));
    return()=>clearTimeout(timer);
  },[state]);
  return !suppression&&state.owner===effectiveOwner&&effectiveOwner?state.attacks:[];
}
