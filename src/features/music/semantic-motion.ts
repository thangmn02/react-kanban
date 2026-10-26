import type {BeatTrace} from '../../../extensions/kanban-music/beat-telemetry.js';
import type {BeatBand} from './mediaBridge';

export type MotionProfile = 'focus' | 'dynamic';
export type MotionReduction = 'system' | 'reduced';
export const motionProfileNames:Record<MotionProfile,string>={focus:'Opal Bloom · Balanced',dynamic:'Opal Bloom · High Contrast'};
export const motionPreviewAllowed=(privateCandidate=false)=>privateCandidate||import.meta.env.DEV&&new URLSearchParams(window.location.search).get('musicMotion')==='1';
export interface VisualAttack {
  /** Presentation identity for an already accepted event; never an emitted beat. */
  key:string; band:BeatBand; deadlineMs:number; durationMs?:number; trace?:BeatTrace;
}
export const instrumentMotion = {
  kick:{name:'Kick',color:'#ff9635',opal:['#e63b58','#ff9635','#ffe274','#8735ab'],duration:165,dynamicDuration:175,crest:48,edgeOpacity:.9,scale:1.04,dynamicScale:1.065,signature:'impact'},
  clap:{name:'Snare / Clap',color:'#fbbf36',opal:['#e74189','#fbbf36','#fef48b','#7b45cb'],duration:95,dynamicDuration:105,crest:32,edgeOpacity:1,scale:1.008,dynamicScale:1.012,signature:'snap'},
  hat:{name:'Hi-Hat',color:'#27d7ed',opal:['#005ed8','#27d7ed','#a7ffeb','#b64cff'],duration:70,dynamicDuration:75,crest:24,edgeOpacity:1,scale:1,dynamicScale:1,signature:'glint'},
  bass:{name:'Bass',color:'#af53f3',opal:['#6539b9','#af53f3','#f781db','#23c0d6'],duration:220,dynamicDuration:245,crest:36,edgeOpacity:.8,scale:1.008,dynamicScale:1.022,signature:'resonance'},
  melody:{name:'Melody / Lead',color:'#22d7a3',opal:['#087c88','#22d7a3','#e5f884','#b65de0'],duration:240,dynamicDuration:260,crest:0,edgeOpacity:.85,scale:1,dynamicScale:1.012,signature:'flow'},
} as const;
export function peakOpacity(band:BeatBand,profile:MotionProfile){
  // The opaque opal material appears immediately over the quiet idle surface.
  return (band==='bass'||band==='melody'?.94:.98)+(profile==='dynamic'?.02:0);
}
export function motionDuration(attack:VisualAttack,profile:MotionProfile){
  const token=instrumentMotion[attack.band],base=profile==='focus'?token.duration:token.dynamicDuration;
  return attack.band==='bass'||attack.band==='melody'?Math.max(base,Math.min(10000,attack.durationMs||0)):base;
}
export function envelopeAt(elapsed:number,duration:number,band:BeatBand){
  if(elapsed<0||elapsed>=duration)return 0;
  // Sustained tonal events settle gently, then release; percussion decays fast.
  const sustain=(band==='bass'||band==='melody')&&duration>300;
  if(sustain&&elapsed<duration-180)return Math.max(.28,Math.exp(-2*Math.max(0,elapsed-instrumentMotion[band].crest)/220));
  const rate={kick:1.8,clap:1.7,hat:1.1,bass:1.7,melody:2}[band];
  // A short crest keeps an on-time attack readable across a refresh interval.
  // It is measured from the original deadline, never from message arrival.
  const crest=Math.min(instrumentMotion[band].crest,duration),progress=Math.max(0,elapsed-crest)/(duration-crest||1);
  return sustain?.28*Math.max(0,(duration-elapsed)/180):Math.exp(-rate*progress)*(1-progress);
}
const frameCache=new Map<string,Keyframe[]>();
export function motionFrames(attack:VisualAttack,profile:MotionProfile,accent:boolean|'rim'=false):Keyframe[]{
  const duration=motionDuration(attack,profile),token=instrumentMotion[attack.band];
  const key=`${attack.band}:${profile}:${duration}:${accent}`,cached=frameCache.get(key);if(cached)return cached;
  const peak=accent?Math.min(1,token.edgeOpacity+(profile==='dynamic'?.1:0)):peakOpacity(attack.band,profile),scale=profile==='focus'?token.scale:token.dynamicScale;
  const frames=Array.from({length:17},(_,i)=>{
    const t=i/16,intensity=envelopeAt(t*duration,duration,attack.band);
    const sweep=1-Math.exp(-(attack.band==='hat'?8:5)*t),travel=profile==='focus'?29:36;
    // Reflective bands travel over the cell material, clipped by its boundary.
    const optics=`translate3d(${-12+travel*sweep}%,0,0) skewX(${-4*(1-sweep)}deg)`;
    // Zoom the material inside its clipped cell; never expose an inset sticker.
    const body=1+(scale-1)*(t<.1875?.5+.5*Math.sin(t/.1875*Math.PI/2):Math.exp(-8*(t-.1875)));
    return {offset:t,opacity:peak*intensity*(accent==='rim'?1-.65*t:1),
      transform:accent==='rim'?'none':accent?optics:`scale(${body})`};
  });
  if(frameCache.size>=32)frameCache.delete(frameCache.keys().next().value!);
  frameCache.set(key,frames);return frames;
}

export function createSemanticMotion(root:HTMLElement,profile:MotionProfile,reduced:boolean,now=Date.now){
  const clearTrace=(element:HTMLElement)=>{
    for(const attribute of ['data-beat-trace','data-beat-row','data-beat-cell','data-event-id','data-event-type','data-event-source','data-target-playback-time','data-semantic','data-presentation','data-detector-origin','data-capture-id','data-parent-id'])element.removeAttribute(attribute);
  };
  const rows=new Map<BeatBand,{cells:readonly HTMLElement[];animations:Animation[]}>(),timers=new Set<ReturnType<typeof setTimeout>>();
  const asCells=(target:HTMLElement|readonly HTMLElement[]):readonly HTMLElement[]=>Array.isArray(target)?target:[target as HTMLElement];
  const sameCells=(left:readonly HTMLElement[]|undefined,right:readonly HTMLElement[])=>left?.length===right.length&&left.every((cell,i)=>cell===right[i]);
  let disposed=false;
  let melodyLevel=0;
  let melodyRelease:ReturnType<typeof setTimeout>|undefined;
  const cancelMelodyRelease=()=>{if(melodyRelease!==undefined){clearTimeout(melodyRelease);timers.delete(melodyRelease);melodyRelease=undefined;}};
  const clearRow=(band:BeatBand,preserveTrace=false)=>{
    if(band==='melody')cancelMelodyRelease();
    const row=rows.get(band);if(!row)return;
    row.animations.forEach(a=>{a.onfinish=null;a.cancel();});
    for(const cell of row.cells){
      cell.querySelectorAll<HTMLElement>('.instrument-motion-layer').forEach(e=>{e.style.transition='none';e.style.opacity='0';if(!preserveTrace)clearTrace(e);});
      cell.removeAttribute('data-motion-active');cell.removeAttribute('data-motion-sustain');
      cell.removeAttribute('data-visual-attack');
    }
    rows.delete(band);
  };
  const reset=()=>{
    melodyLevel=0;
    timers.forEach(clearTimeout);timers.clear();for(const band of [...rows.keys()])clearRow(band);
    root.querySelectorAll('[data-reduced-marker]').forEach(e=>e.removeAttribute('data-reduced-marker'));
    root.querySelectorAll<HTMLElement>('[data-beat-trace],[data-semantic]').forEach(clearTrace);
    root.querySelectorAll('[data-visual-attack]').forEach(e=>e.removeAttribute('data-visual-attack'));
  };
  return {
    reset,
    sustainMelody(target:HTMLElement|readonly HTMLElement[]|undefined,level:number){
      if(!target||disposed||root.ownerDocument.hidden)return;
      const cells=asCells(target);if(!cells.length)return;
      const next=Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
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
          for(const [selector,gain]of [['.motion-body',peakOpacity('melody',profile)],['.motion-edge',.55],['.motion-rim',.4]] as const){
            const layer=cell.querySelector<HTMLElement>(selector);if(layer){layer.style.transition='none';layer.style.opacity=String(gain*next);}
          }
          if(!continuing){
            const edge=cell.querySelector<HTMLElement>('.motion-edge'),travel=profile==='focus'?12:17;
            if(edge&&typeof edge.animate==='function')animations.push(edge.animate([{transform:`translate3d(${-travel}%,0,0) skewX(-4deg)`},{transform:`translate3d(${travel}%,0,0) skewX(0deg)`}],
              {duration:1800,iterations:Infinity,direction:'alternate',easing:'ease-in-out'}));
            cell.dataset.motionSustain='true';
          }
        }
        if(!continuing)rows.set('melody',{cells:[...cells],animations});
      }
      else if(previous>0){
        for(const cell of cells)cell.querySelectorAll<HTMLElement>('.instrument-motion-layer').forEach(layer=>{layer.style.transition='opacity 240ms ease-out';layer.style.opacity='0';});
        const releasing=rows.get('melody');
        const timer=setTimeout(()=>{timers.delete(timer);if(melodyRelease===timer){melodyRelease=undefined;if(melodyLevel===0&&rows.get('melody')===releasing)clearRow('melody');}},240);
        melodyRelease=timer;timers.add(timer);
      }
    },
    play(attack:VisualAttack,target:HTMLElement|readonly HTMLElement[]){
      if(disposed||root.ownerDocument.hidden||!Number.isFinite(attack.deadlineMs))return 'hidden-or-invalid';
      const cells=asCells(target);if(!cells.length)return 'hidden-or-invalid';
      const elapsed=now()-attack.deadlineMs,duration=motionDuration(attack,profile);
      if(elapsed>=duration)return 'expired';
      if(reduced||typeof cells[0].animate!=='function'){
        const band=root.querySelector(`[data-motion-band="${attack.band}"]`);
        band?.querySelectorAll<HTMLElement>('.instrument-motion-layer').forEach(clearTrace);
        band?.querySelectorAll('[data-visual-attack]').forEach(e=>e.removeAttribute('data-visual-attack'));
        const indicate=()=>{
          if(disposed||root.ownerDocument.hidden||now()-attack.deadlineMs>=duration)return;
          // A steady marker stays on its first cell; rapid events do not toggle it.
          if(!root.querySelector(`[data-motion-band="${attack.band}"] [data-reduced-marker]`))cells[0].setAttribute('data-reduced-marker','true');
        };
        if(elapsed>=0)indicate();else{const timer=setTimeout(()=>{timers.delete(timer);indicate();},-elapsed);timers.add(timer);}
        return 'steady';
      }
      clearRow(attack.band);
      const animations=cells.flatMap(cell=>[...cell.querySelectorAll<HTMLElement>('.instrument-motion-layer')].map((element,index)=>{
        const animation=element.animate(motionFrames(attack,profile,index===2?'rim':index===1),{duration,fill:'forwards',easing:'linear'});
        const timeline=root.ownerDocument.timeline?.currentTime;
        // The default document timeline and performance.now share timeOrigin.
        // timeline.currentTime can still be the previous refresh's timestamp.
        if(typeof timeline==='number')animation.startTime=root.ownerDocument.defaultView!.performance.now()+(attack.deadlineMs-now());
        else animation.currentTime=Math.max(0,now()-attack.deadlineMs);
        return animation;
      }));
      cells.forEach(cell=>{cell.dataset.motionActive=attack.key;});rows.set(attack.band,{cells:[...cells],animations});
      // Completion is owned by this attack; a canceled old effect cannot clear a retrigger.
      const last=animations.at(-1);if(last)last.onfinish=()=>{if(rows.get(attack.band)?.animations===animations)clearRow(attack.band);};
      return 'animated';
    },
    dispose(){disposed=true;reset();},
  };
}
