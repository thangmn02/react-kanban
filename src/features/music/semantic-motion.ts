import type {BeatTrace} from '../../../extensions/kanban-music/beat-telemetry.js';
import type {BeatBand} from './mediaBridge';

export type MotionProfile = 'focus' | 'dynamic';
export type MotionReduction = 'system' | 'reduced';
export const motionProfileNames:Record<MotionProfile,string>={focus:'Kinetic · Horizon Eclipse',dynamic:'Kinetic · Eclipse Halo'};
export const motionPreviewAllowed=(privateCandidate=false)=>privateCandidate||import.meta.env.DEV&&new URLSearchParams(window.location.search).get('musicMotion')==='1';
export interface VisualAttack {
  /** Presentation identity for an already accepted event; never an emitted beat. */
  key:string; band:BeatBand; deadlineMs:number; durationMs?:number; trace?:BeatTrace;
}
type Frame=Keyframe;
const ease={kick:'cubic-bezier(0.16,1,0.3,1)',clap:'cubic-bezier(0.18,1,0.32,1)',hat:'cubic-bezier(0.2,1,0.3,1)',bass:'cubic-bezier(0.22,0.8,0.2,1)',melody:'cubic-bezier(0.2,0.9,0.25,1)'};
const none='0 0 0 0 transparent';
/** Kinetic Grid pads: each row owns a five-step palette and a signature pulse. */
export const instrumentMotion = {
  kick:{name:'Kick',color:'#f43f5e',deep:'#7f1d1d',bright:'#fda4af',hot:'#fff1f2',glow:'rgba(244,63,94,.62)',duration:520,signature:'impact',
    cell:[{transform:'scale(.92)',boxShadow:`${none},${none}`},{offset:.16,transform:'scale(1.135)',boxShadow:'0 8px 26px -6px var(--c-glow),0 0 30px -4px var(--c-glow)'},{offset:.42,transform:'scale(1.04)'},{transform:'scale(1)',boxShadow:`${none},${none}`}] as Frame[]},
  clap:{name:'Snare / Clap',color:'#f59e0b',deep:'#78350f',bright:'#fde68a',hot:'#fffbeb',glow:'rgba(245,158,11,.62)',duration:440,signature:'snap',
    cell:[{transform:'scale(.94)',boxShadow:none},{offset:.14,transform:'scale(1.1,1.08)',boxShadow:'0 8px 24px -4px var(--c-glow)'},{transform:'scale(1)',boxShadow:none}] as Frame[]},
  hat:{name:'Hi-Hat',color:'#06b6d4',deep:'#0c4a6e',bright:'#a5f3fc',hot:'#ecfeff',glow:'rgba(6,182,212,.58)',duration:220,signature:'glint',
    cell:[{transform:'scale(.96)',boxShadow:none},{offset:.2,transform:'scale(1.055)',boxShadow:'0 0 14px var(--c-glow)'},{transform:'scale(1)',boxShadow:none}] as Frame[]},
  bass:{name:'Bass',color:'#9333ea',deep:'#3b0764',bright:'#e879f9',hot:'#fdf4ff',glow:'rgba(168,85,247,.6)',duration:780,signature:'resonance',
    cell:[{transform:'scale(.96)',boxShadow:none},{offset:.24,transform:'scale(1.085,1.06)',boxShadow:'0 8px 26px -2px var(--c-glow)'},{transform:'scale(1)',boxShadow:none}] as Frame[]},
  melody:{name:'Melody / Lead',color:'#10b981',deep:'#064e3b',bright:'#6ee7b7',hot:'#ecfdf5',glow:'rgba(16,185,129,.58)',duration:640,signature:'flow',
    cell:[{transform:'scale(.95) translateY(0)',boxShadow:none},{offset:.22,transform:'scale(1.08) translateY(-2px)',boxShadow:'0 10px 22px -4px var(--c-glow)'},{transform:'scale(1) translateY(0)',boxShadow:none}] as Frame[]},
} as const;
/** Inner layers: aura (color), hotspot (core light), rim (edge). Hat and Bass reuse their row duration. */
const layerFrames:Frame[][]=[
  [{opacity:1,transform:'scale(.92)',filter:'brightness(1.52) saturate(1.12)'},{offset:.18,opacity:1,transform:'scale(1.04)'},{opacity:0,transform:'scale(.96)',filter:'brightness(1) saturate(1)'}],
  [{opacity:1,transform:'scale(1.06)'},{offset:.3,opacity:.8},{opacity:0,transform:'scale(.9)'}],
  [{opacity:1},{offset:.35,opacity:.85},{opacity:0}],
];
const shockFrames:Frame[]=[{opacity:.95,transform:'scale(.96)'},{opacity:0,transform:'scale(1.24)'}];
function layerTiming(band:BeatBand,index:number){
  if(band==='hat'||band==='bass')return {duration:instrumentMotion[band].duration,easing:index===0?ease.kick:'ease-out'};
  return {duration:[520,440,480][index],easing:index===0?ease.kick:'ease-out'};
}
export function motionDuration(attack:Pick<VisualAttack,'band'>){
  const band=attack.band;return band==='hat'||band==='bass'?instrumentMotion[band].duration:Math.max(520,instrumentMotion[band].duration);
}
/** Optional presentation only; retain the original attack and acoustic trace. */
export function lateLivePresentation(attack:VisualAttack,enabled:boolean,now=Date.now()):VisualAttack {
  const age=now-attack.deadlineMs;
  return enabled&&['kick','clap','hat'].includes(attack.band)&&attack.trace?.source==='onset'
    &&attack.trace.eventSource==='local'&&Number.isFinite(age)&&age>=motionDuration(attack)&&age<=600
    ?{...attack,deadlineMs:now}:attack;
}

export type PatternName='heart'|'star'|'diamond'|'nova'|'wave';
export const patternNames:PatternName[]=['heart','star','diamond','nova','wave'];
/** 5×8 silhouettes and 4×8 variants for the default four-row grid. Center is the ripple origin. */
export const geometricPatterns:Record<PatternName,{theme:'heart'|'star'|'diamond'|'nova';glow:string;five:string[];four:string[];center:[number,number]}>={
  heart:{theme:'heart',glow:'rgba(236,72,153,.75)',center:[2,3.5],five:['00100100','01111110','01111110','00111100','00011000'],four:['01100110','11111111','01111110','00011000']},
  star:{theme:'star',glow:'rgba(250,204,21,.75)',center:[2,3.5],five:['00011000','01111110','00111100','01100110','10000001'],four:['00011000','11111111','00111100','01100110']},
  diamond:{theme:'diamond',glow:'rgba(56,189,248,.75)',center:[2,3.5],five:['00011000','00111100','01100110','00111100','00011000'],four:['00111100','01100110','01100110','00111100']},
  nova:{theme:'nova',glow:'rgba(192,132,252,.75)',center:[2,3.5],five:['11000011','01100110','00011000','01100110','11000011'],four:['11000011','00111100','00111100','11000011']},
  wave:{theme:'diamond',glow:'rgba(56,189,248,.75)',center:[2,0],five:['00110000','01111001','11001111','10000110','00000000'],four:['00110000','01111001','11001111','10000110']},
};
export const PATTERN_CELL_MS=720,PATTERN_RIPPLE_MS=24;
/** Shape bursts land on a real Kick every 16 beats of a locked tempo, else every 8 s. */
export const burstIntervalMs=(bpm?:number|null)=>bpm&&bpm>=60&&bpm<=200?16*60000/bpm:8000;
/** Lit cells of a shape with their center-out ripple delays. */
export function patternCells(name:PatternName,rowCount:number){
  const pattern=geometricPatterns[name],grid=rowCount>=5?pattern.five:pattern.four;
  const [cr,cc]=rowCount>=5?pattern.center:[pattern.center[0]*.75,pattern.center[1]];
  return grid.flatMap((line,row)=>[...line].flatMap((bit,step)=>bit==='1'?[{row,step,delay:Math.round(Math.hypot(row-cr,step-cc)*PATTERN_RIPPLE_MS)}]:[]));
}
const patternLayers:Frame[][]=[
  [{opacity:1,filter:'brightness(1.62) saturate(1.15)'},{offset:.48,opacity:.95,filter:'brightness(1.3) saturate(1.08)'},{opacity:0,filter:'brightness(.9) saturate(1)'}],
  [{opacity:1,transform:'scale(1.06)'},{offset:.5,opacity:.88},{opacity:0,transform:'scale(.92)'}],
  [{opacity:1},{offset:.45,opacity:1},{opacity:0}],
];
const patternCell:Frame[]=[{transform:'scale(.88)',boxShadow:`${none},${none}`},{offset:.2,transform:'scale(1.13)',boxShadow:'0 10px 28px -6px var(--c-glow),0 0 32px -4px var(--c-glow)'},
  {offset:.52,transform:'scale(1.06)',boxShadow:`0 6px 18px -2px var(--c-glow),${none}`},{transform:'scale(1)',boxShadow:`${none},${none}`}];

export function createSemanticMotion(root:HTMLElement,profile:MotionProfile,reduced:boolean,now=Date.now){
  const clearTrace=(element:HTMLElement)=>{
    for(const attribute of ['data-beat-trace','data-beat-row','data-beat-cell','data-event-id','data-event-type','data-event-source','data-target-playback-time','data-semantic','data-presentation','data-detector-origin','data-capture-id','data-parent-id','data-presentation-time','data-original-deadline','data-late-live-preview'])element.removeAttribute(attribute);
  };
  const rows=new Map<BeatBand,{cells:readonly HTMLElement[];animations:Animation[]}>(),timers=new Set<ReturnType<typeof setTimeout>>();
  const asCells=(target:HTMLElement|readonly HTMLElement[]):readonly HTMLElement[]=>Array.isArray(target)?target:[target as HTMLElement];
  const sameCells=(left:readonly HTMLElement[]|undefined,right:readonly HTMLElement[])=>left?.length===right.length&&left.every((cell,i)=>cell===right[i]);
  const later=(ms:number,fn:()=>void)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},Math.max(0,ms));timers.add(timer);return timer;};
  let disposed=false;
  let melodyLevel=0;
  let melodyRelease:ReturnType<typeof setTimeout>|undefined;
  /** A shape owns the whole grid between its deadline and its last cell's fade. */
  let exclusive:{start:number;end:number;animations:Animation[];cells:HTMLElement[]}|undefined;
  const cancelMelodyRelease=()=>{if(melodyRelease!==undefined){clearTimeout(melodyRelease);timers.delete(melodyRelease);melodyRelease=undefined;}};
  const layers=(cell:HTMLElement)=>[...cell.querySelectorAll<HTMLElement>('.instrument-motion-layer')];
  // The default document timeline and performance.now share timeOrigin.
  // timeline.currentTime can still be the previous refresh's timestamp.
  const schedule=(animation:Animation,deadlineMs:number)=>{
    if(typeof root.ownerDocument.timeline?.currentTime==='number')animation.startTime=root.ownerDocument.defaultView!.performance.now()+(deadlineMs-now());
    else animation.currentTime=Math.max(0,now()-deadlineMs);
    return animation;
  };
  const clearRow=(band:BeatBand,preserveTrace=false)=>{
    if(band==='melody')cancelMelodyRelease();
    const row=rows.get(band);if(!row)return;
    row.animations.forEach(a=>{a.onfinish=null;a.cancel();});
    for(const cell of row.cells){
      layers(cell).forEach(e=>{e.style.transition='none';e.style.opacity='0';if(!preserveTrace)clearTrace(e);});
      cell.removeAttribute('data-motion-active');cell.removeAttribute('data-motion-sustain');
      cell.removeAttribute('data-visual-attack');
    }
    rows.delete(band);
  };
  const clearExclusive=()=>{
    if(!exclusive)return;
    exclusive.animations.forEach(a=>{a.onfinish=null;a.cancel();});
    exclusive.cells.forEach(cell=>{cell.removeAttribute('data-pat-theme');cell.removeAttribute('data-pattern-hit');});
    root.removeAttribute('data-presentation-state');root.removeAttribute('data-pattern');exclusive=undefined;
  };
  const owned=(deadlineMs:number)=>exclusive!==undefined&&deadlineMs>=exclusive.start&&deadlineMs<exclusive.end;
  const reset=()=>{
    melodyLevel=0;
    timers.forEach(clearTimeout);timers.clear();for(const band of [...rows.keys()])clearRow(band);clearExclusive();
    root.querySelectorAll('[data-reduced-marker]').forEach(e=>e.removeAttribute('data-reduced-marker'));
    root.querySelectorAll<HTMLElement>('[data-beat-trace],[data-semantic]').forEach(clearTrace);
    root.querySelectorAll('[data-visual-attack]').forEach(e=>e.removeAttribute('data-visual-attack'));
  };
  return {
    reset,
    /** True while a shape owns the grid at this deadline. */
    exclusiveAt:owned,
    sustainMelody(target:HTMLElement|readonly HTMLElement[]|undefined,level:number){
      if(!target||disposed||root.ownerDocument.hidden)return;
      const cells=asCells(target);if(!cells.length)return;
      const next=Number.isFinite(level)&&!owned(now())?Math.max(0,Math.min(1,level)):0;
      if(reduced){if(next>0&&!root.querySelector('[data-motion-band="melody"] [data-reduced-marker]'))cells[0].setAttribute('data-reduced-marker','true');return;}
      const continuing=sameCells(rows.get('melody')?.cells,cells)&&cells.every(cell=>cell.dataset.motionSustain==='true');
      // A finite attack may have replaced the held row at the same level.
      if(next===melodyLevel&&(next===0||continuing))return;
      const previous=melodyLevel;melodyLevel=next;
      if(next>0){
        cancelMelodyRelease();
        if(!continuing)clearRow('melody',true);
        const animations:Animation[]=[];
        for(const cell of cells){
          for(const [selector,gain]of [['.motion-body',.94],['.motion-edge',.55],['.motion-rim',.4]] as const){
            const layer=cell.querySelector<HTMLElement>(selector);if(layer){layer.style.transition='none';layer.style.opacity=String(gain*next);}
          }
          if(!continuing){
            // A held Lead floats gently instead of strobing.
            const edge=cell.querySelector<HTMLElement>('.motion-edge'),travel=profile==='focus'?2:3;
            if(edge&&typeof edge.animate==='function')animations.push(edge.animate([{transform:`translateY(${travel}px)`},{transform:`translateY(${-travel}px)`}],
              {duration:1800,iterations:Infinity,direction:'alternate',easing:'ease-in-out'}));
            cell.dataset.motionSustain='true';
          }
        }
        if(!continuing)rows.set('melody',{cells:[...cells],animations});
      }
      else if(previous>0){
        for(const cell of cells)layers(cell).forEach(layer=>{layer.style.transition='opacity 240ms ease-out';layer.style.opacity='0';});
        const releasing=rows.get('melody');
        melodyRelease=later(240,()=>{melodyRelease=undefined;if(melodyLevel===0&&rows.get('melody')===releasing)clearRow('melody');});
      }
    },
    play(attack:VisualAttack,target:HTMLElement|readonly HTMLElement[]){
      if(disposed||root.ownerDocument.hidden||!Number.isFinite(attack.deadlineMs))return 'hidden-or-invalid';
      const cells=asCells(target);if(!cells.length)return 'hidden-or-invalid';
      const elapsed=now()-attack.deadlineMs,duration=motionDuration(attack);
      if(elapsed>=duration)return 'expired';
      if(owned(attack.deadlineMs))return 'pattern-exclusive';
      if(reduced||typeof cells[0].animate!=='function'){
        const band=root.querySelector(`[data-motion-band="${attack.band}"]`);
        band?.querySelectorAll<HTMLElement>('.instrument-motion-layer').forEach(clearTrace);
        band?.querySelectorAll('[data-visual-attack]').forEach(e=>e.removeAttribute('data-visual-attack'));
        const indicate=()=>{
          if(disposed||root.ownerDocument.hidden||now()-attack.deadlineMs>=duration)return;
          // A steady marker stays on its first cell; rapid events do not toggle it.
          if(!root.querySelector(`[data-motion-band="${attack.band}"] [data-reduced-marker]`))cells[0].setAttribute('data-reduced-marker','true');
        };
        if(elapsed>=0)indicate();else later(-elapsed,indicate);
        return 'steady';
      }
      clearRow(attack.band);
      const token=instrumentMotion[attack.band];
      const animations=cells.flatMap(cell=>{
        const own=[schedule(cell.animate(token.cell,{duration:token.duration,easing:ease[attack.band],fill:'none'}),attack.deadlineMs),
          ...layers(cell).map((element,index)=>schedule(element.animate(layerFrames[index],{...layerTiming(attack.band,index),fill:'forwards'}),attack.deadlineMs))];
        const shock=attack.band==='kick'?cell.querySelector<HTMLElement>('.motion-shock'):null;
        if(shock&&typeof shock.animate==='function')own.push(schedule(shock.animate(shockFrames,{duration:520,easing:ease.kick,fill:'none'}),attack.deadlineMs));
        return own;
      });
      cells.forEach(cell=>{cell.dataset.motionActive=attack.key;});rows.set(attack.band,{cells:[...cells],animations});
      // Completion is owned by this attack; a canceled old effect cannot clear a retrigger.
      const last=animations.at(-1);
      if(last)last.onfinish=()=>{if(rows.get(attack.band)?.animations===animations)clearRow(attack.band);};
      return 'animated';
    },
    /** Shape burst from a real accepted attack; individual rows yield the grid until it fades. */
    burst(name:PatternName,deadlineMs:number,cells:readonly {cell:HTMLElement;delay:number}[]){
      if(disposed||reduced||root.ownerDocument.hidden||!cells.length||typeof cells[0].cell.animate!=='function'||owned(deadlineMs))return 'skipped';
      if(now()-deadlineMs>=PATTERN_CELL_MS)return 'expired';
      clearExclusive();
      const pattern=geometricPatterns[name],end=deadlineMs+Math.max(...cells.map(c=>c.delay))+PATTERN_CELL_MS+20;
      const state={start:deadlineMs,end,animations:[] as Animation[],cells:cells.map(c=>c.cell)};exclusive=state;
      // Rows lose their in-flight pulses exactly when the shape takes over.
      later(deadlineMs-now(),()=>{if(exclusive!==state)return;for(const band of [...rows.keys()])clearRow(band);
        root.dataset.presentationState='EXCLUSIVE_ACTIVE';root.dataset.pattern=name;});
      for(const {cell,delay}of cells){
        cell.dataset.patTheme=pattern.theme;cell.dataset.patternHit=name;
        const at=deadlineMs+delay;
        state.animations.push(schedule(cell.animate(patternCell,{duration:PATTERN_CELL_MS,easing:ease.kick,fill:'none'}),at));
        layers(cell).forEach((layer,index)=>state.animations.push(schedule(layer.animate(patternLayers[index],{duration:[720,680,700][index],easing:index===0?ease.kick:'ease-out',fill:'forwards'}),at)));
        const shock=cell.querySelector<HTMLElement>('.motion-shock');
        if(shock&&typeof shock.animate==='function')state.animations.push(schedule(shock.animate(shockFrames,{duration:680,easing:ease.kick,fill:'none'}),at));
      }
      later(end-now(),()=>{if(exclusive===state)clearExclusive();});
      return 'pattern';
    },
    dispose(){disposed=true;reset();},
  };
}
