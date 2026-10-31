import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render} from '@testing-library/react';
import {burstIntervalMs,createSemanticMotion,instrumentMotion,motionDuration,lateLivePresentation,patternCells,patternNames,type VisualAttack} from './semantic-motion';
import {SemanticMotionPattern} from './semantic-motion-pattern';
import type {BeatBand} from './mediaBridge';
import type {MusicBeatState} from './useMusicBeatSync';
import {activeSteps} from './beatVisuals';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();});
const session={id:'source',title:'Authorized test',artist:'',source:'test',playing:true,paused:false,currentTime:0};
const base:MusicBeatState={sessionId:'source',mode:'capture',captureId:'capture',synchronizationEpoch:'epoch',onsets:{}};
it('permits explicit bounded late local drum presentation without changing acoustic timestamps',()=>{
  const trace=Object.freeze({id:'real',source:'onset' as const,type:'hat' as const,confidence:1,detectedAt:1000,targetTime:700,targetClock:'epoch-ms' as const,eventSource:'local' as const});
  const attack=Object.freeze({key:'real',band:'hat' as const,deadlineMs:700,trace});
  expect(lateLivePresentation(attack,false,1000)).toBe(attack);
  const shown=lateLivePresentation(attack,true,1000);
  expect(shown.deadlineMs).toBe(1000);expect(shown.trace).toBe(trace);
  expect(attack.deadlineMs).toBe(700);expect(trace.targetTime).toBe(700);
  expect(lateLivePresentation(attack,true,1301)).toBe(attack);
  expect(lateLivePresentation(attack,true,900)).toBe(attack);
  for(const band of ['bass','melody'] as const){const tonal={...attack,band};expect(lateLivePresentation(tonal,true,1200)).toBe(tonal);}
  const cached={...attack,trace:{...trace,eventSource:'cache' as const}};
  expect(lateLivePresentation(cached,true,1000)).toBe(cached);
  const missing={...attack,trace:undefined};expect(lateLivePresentation(missing,true,1000)).toBe(missing);
});
it('shows only fresh accepted late drum identities after opt-in and clears them on pause',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus"/>);
  const animate=vi.fn(()=>({cancel:vi.fn(),onfinish:null,currentTime:0}) as unknown as Animation);
  for(const cell of view.container.querySelectorAll<HTMLElement>('[data-motion-cell],.instrument-motion-layer,.motion-shock'))cell.animate=animate;
  const hit=(key:string,band:BeatBand):VisualAttack=>({key,band,deadlineMs:400,trace:{id:key,source:'onset',type:band==='clap'?'snare':band as 'kick'|'hat',confidence:1,detectedAt:1000,targetTime:400,targetClock:'epoch-ms',eventSource:'local'}});
  const old=hit('expired-before-opt-in','hat');
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[old]}} profile="focus"/>);
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[old]}} profile="focus" lateLivePreview/>);
  expect(animate).not.toHaveBeenCalled();
  const attacks=[hit('real-kick','kick'),hit('real-snare','clap'),hit('real-hat','hat')];
  const playing={...base,visualAttacks:attacks};
  view.rerender(<SemanticMotionPattern session={session} beat={playing} profile="focus" lateLivePreview/>);
  for(const band of ['kick','clap','hat']){
    const shown=view.container.querySelector(`[data-motion-band="${band}"] [data-late-live-preview="true"]`);
    expect(shown).toHaveAttribute('data-original-deadline','400');expect(shown).toHaveAttribute('data-presentation-time','1000');
  }
  expect(attacks.every(attack=>attack.deadlineMs===400&&attack.trace?.targetTime===400)).toBe(true);
  const count=animate.mock.calls.length;
  view.rerender(<SemanticMotionPattern session={session} beat={playing} profile="focus" lateLivePreview/>);
  expect(animate).toHaveBeenCalledTimes(count);
  expect(view.container.querySelector('[data-motion-band="melody"]')).toBeNull();
  view.rerender(<SemanticMotionPattern session={{...session,paused:true,playing:false}} beat={playing} profile="focus" lateLivePreview/>);
  expect(view.container.querySelector('[data-visual-attack]')).toBeNull();
  expect(view.container.querySelector('[data-late-live-preview="true"].motion-body')).toBeNull();
});
function fixture(){
  const host=document.createElement('div');host.innerHTML=`<div data-motion-band="hat">${[0,1].map(i=>`<span data-motion-cell="${i}"><span class="motion-shock"></span><span class="motion-clip"><span class="instrument-motion-layer motion-body"></span><span class="instrument-motion-layer motion-edge"></span><span class="instrument-motion-layer motion-rim"></span></span></span>`).join('')}</div>`;document.body.append(host);
  type Fake={cancel:ReturnType<typeof vi.fn>;onfinish:null|(()=>void);currentTime:number};
  const animations:Fake[]=[],cellAnimations:Fake[]=[],shocks:Fake[]=[];
  const fake=(list:Fake[])=>vi.fn(()=>{const animation={cancel:vi.fn(),onfinish:null,currentTime:0};list.push(animation);return animation as unknown as Animation;});
  for(const cell of host.querySelectorAll<HTMLElement>('.instrument-motion-layer'))cell.animate=fake(animations);
  // The pad itself pulses; its fixed layers carry the light.
  for(const cell of host.querySelectorAll<HTMLElement>('[data-motion-cell]'))cell.animate=fake(cellAnimations);
  for(const cell of host.querySelectorAll<HTMLElement>('.motion-shock'))cell.animate=fake(shocks);
  return {host,cells:[...host.querySelectorAll<HTMLElement>('[data-motion-cell]')],animations,cellAnimations,shocks,remove:()=>host.remove()};
}
it('gives every instrument its own Kinetic palette and signature pulse',()=>{
  const tokens=Object.entries(instrumentMotion);
  expect(new Set(tokens.map(([,v])=>v.color)).size).toBe(5);expect(new Set(tokens.map(([,v])=>v.signature)).size).toBe(5);
  expect(Object.fromEntries(tokens.map(([band])=>[band,motionDuration({band:band as BeatBand})]))).toEqual({kick:520,clap:520,hat:220,bass:780,melody:640});
  const f=fixture(),engine=createSemanticMotion(f.host,'focus',false,()=>1000);
  try{
    engine.play({key:'k',band:'kick',deadlineMs:1000},f.cells[0]);
    expect(f.cellAnimations).toHaveLength(1);expect(f.shocks).toHaveLength(1);expect(f.animations).toHaveLength(3);
    const pulse=(f.cells[0].animate as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(pulse[0]).toBe(instrumentMotion.kick.cell);expect(pulse[1]).toMatchObject({duration:520});
    engine.play({key:'h',band:'hat',deadlineMs:1000},f.cells[1]);
    expect(f.shocks).toHaveLength(1);
    expect((f.cells[1].querySelector('.motion-body')!.animate as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({duration:220,fill:'forwards'});
  }finally{engine.dispose();f.remove();}
});
it('maps all five shapes to center-out ripples on both grid heights',()=>{
  for(const name of patternNames)for(const rows of [4,5]){
    const cells=patternCells(name,rows);
    expect(cells.length).toBeGreaterThan(6);expect(cells.every(c=>c.row<rows&&c.step<8&&c.delay>=0)).toBe(true);
  }
  const heart=patternCells('heart',5);
  expect(heart.find(c=>c.row===2&&c.step===3)!.delay).toBeLessThan(heart.find(c=>c.row===0&&c.step===2)!.delay);
  expect(burstIntervalMs(120)).toBe(8000);expect(burstIntervalMs(null)).toBe(8000);expect(burstIntervalMs(240)).toBe(8000);
});
it('gives a shape exclusive ownership of the grid until its last cell fades',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);const f=fixture(),engine=createSemanticMotion(f.host,'focus',false);
  try{
    engine.play({key:'before',band:'hat',deadlineMs:1000},f.cells[1]);const earlier=f.animations.slice();
    expect(engine.burst('diamond',1000,[{cell:f.cells[0],delay:0},{cell:f.cells[1],delay:24}])).toBe('pattern');
    vi.advanceTimersByTime(0);
    expect(earlier.every(a=>a.cancel.mock.calls.length===1)).toBe(true);
    expect(f.host).toHaveAttribute('data-presentation-state','EXCLUSIVE_ACTIVE');expect(f.cells[0]).toHaveAttribute('data-pat-theme','diamond');
    expect(engine.play({key:'during',band:'hat',deadlineMs:1300},f.cells[1])).toBe('pattern-exclusive');
    vi.setSystemTime(1300);engine.sustainMelody(f.cells[1],.8);expect(f.cells[1]).not.toHaveAttribute('data-motion-sustain');
    vi.advanceTimersByTime(800);
    expect(f.host).not.toHaveAttribute('data-presentation-state');expect(f.cells[0]).not.toHaveAttribute('data-pat-theme');
    expect(engine.play({key:'after',band:'hat',deadlineMs:Date.now()},f.cells[1])).toBe('animated');
  }finally{engine.dispose();f.remove();}
});
it('never bursts in reduced motion',()=>{
  const f=fixture(),engine=createSemanticMotion(f.host,'focus',true,()=>1000);
  try{expect(engine.burst('heart',1000,[{cell:f.cells[0],delay:0}])).toBe('skipped');expect(engine.play({key:'k',band:'kick',deadlineMs:1000},f.cells[0])).toBe('steady');}
  finally{engine.dispose();f.remove();}
});
it('fires a shape on a real Kick after the interval and suppresses the rows meanwhile',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus"/>);
  for(const node of view.container.querySelectorAll<HTMLElement>('[data-motion-cell],.instrument-motion-layer,.motion-shock'))node.animate=vi.fn(()=>({cancel:vi.fn(),onfinish:null,currentTime:0}) as unknown as Animation);
  const kick=(key:string,at:number)=>({key,band:'kick' as const,deadlineMs:at});
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[kick('first',1000)]}} profile="focus"/>);
  expect(view.container.querySelector('[data-pattern-hit]')).toBeNull();
  vi.setSystemTime(9000);
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[kick('first',1000),kick('drop',9000)]}} profile="focus"/>);
  const lit=[...view.container.querySelectorAll<HTMLElement>('[data-pattern-hit]')];
  expect(lit).toHaveLength(patternCells(lit[0].dataset.patternHit as 'heart',4).length);
  act(()=>{vi.advanceTimersByTime(0);});
  expect(view.container.querySelector('[data-motion-band="kick"] [data-motion-active]')).toBeNull();
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[kick('first',1000),kick('drop',9000),{key:'hat',band:'hat',deadlineMs:9100}]}} profile="focus"/>);
  expect(view.container.querySelector('[data-motion-band="hat"] [data-motion-active]')).toBeNull();
});
it.each(['focus','dynamic'] as const)('renders fixed full-cell %s Kinetic layers and reuses their nodes for real retriggers',profile=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={session} beat={base} profile={profile} reduced melodyEnabled/>);
  const body=view.container.querySelector('[data-motion-band="kick"] .motion-body')!;
  expect(view.container.querySelectorAll('.beat-square')).toHaveLength(40);
  expect(view.container.querySelectorAll('.instrument-motion-layer')).toHaveLength(120);
  expect(view.container.querySelectorAll('.motion-shock')).toHaveLength(40);
  expect(view.container.querySelectorAll('svg')).toHaveLength(0);
  for(const band of Object.keys(instrumentMotion)){
    const row=view.container.querySelector<HTMLElement>(`[data-motion-band="${band}"]`)!;
    expect(row.style.getPropertyValue('--c-glow')).toBe(instrumentMotion[band as BeatBand].glow);
    expect(row.querySelectorAll('.motion-rim')).toHaveLength(8);
  }
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[{key:'real',band:'kick',deadlineMs:1000}]}} profile={profile} reduced melodyEnabled/>);
  expect(view.container.querySelector('[data-motion-band="kick"] .motion-body')).toBe(body);
  expect(view.container.querySelector('.semantic-motion')).toHaveAttribute('data-motion-variant','kinetic');
  expect(view.container.querySelector('.semantic-motion')).toHaveAttribute('data-optical',profile==='focus'?'hybrid':'eclipse');
});
it('keeps valid Melody flow through level changes and cancels it on reset',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);const f=fixture();
  const engine=createSemanticMotion(f.host,'focus',false);
  try{
    engine.sustainMelody(f.cells[0],.7);expect(f.animations).toHaveLength(1);
    expect(f.cells[0].querySelector<HTMLElement>('.motion-edge')!.animate).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({iterations:Infinity,duration:1800}));
    engine.sustainMelody(f.cells[0],.8);expect(f.animations).toHaveLength(1);
    expect(Number(f.cells[0].querySelector<HTMLElement>('.motion-rim')!.style.opacity)).toBeCloseTo(.32);
    engine.sustainMelody(f.cells[0],0);vi.advanceTimersByTime(100);engine.sustainMelody(f.cells[0],.6);vi.advanceTimersByTime(200);
    expect(f.animations[0].cancel).not.toHaveBeenCalled();expect(f.cells[0]).toHaveAttribute('data-motion-sustain','true');
    engine.reset();expect(f.animations[0].cancel).toHaveBeenCalledOnce();expect(f.cells[0]).not.toHaveAttribute('data-motion-sustain');
    expect(f.cells[0].querySelector<HTMLElement>('.motion-rim')!.style.opacity).toBe('0');
  }finally{engine.dispose();f.remove();}
});
it('ages late attacks, suppresses expired attacks and cancels old animations on same-cell rapid retriggers',()=>{
  const f=fixture(),engine=createSemanticMotion(f.host,'focus',false,()=>1000);
  try{
    expect(engine.play({key:'late',band:'hat',deadlineMs:970},f.cells[0])).toBe('animated');
    expect(f.animations[0].currentTime).toBe(30);const firstNode=f.cells[0];
    expect(engine.play({key:'next',band:'hat',deadlineMs:1000},f.cells[0])).toBe('animated');
    expect(f.cells[0]).toBe(firstNode);expect(f.animations.slice(0,3).every(a=>a.cancel.mock.calls.length===1)).toBe(true);expect(f.animations[3].currentTime).toBe(0);
    expect(engine.play({key:'expired',band:'hat',deadlineMs:700},f.cells[1])).toBe('expired');expect(f.animations).toHaveLength(6);
    engine.reset();expect(f.animations[3].cancel).toHaveBeenCalledOnce();expect(f.host.querySelector('[data-motion-active]')).toBeNull();
  }finally{engine.dispose();f.remove();}
});
it('restores a held Melody after a same-level attack without letting its old completion clear the flow',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);const f=fixture(),engine=createSemanticMotion(f.host,'focus',false);
  try{
    engine.sustainMelody(f.cells[0],.7);
    engine.play({key:'melody-onset',band:'melody',deadlineMs:1000},f.cells[0]);
    const oldFinish=f.animations.at(-1)!.onfinish;
    engine.sustainMelody(f.cells[0],.7);
    expect(f.animations).toHaveLength(5);expect(f.cells[0]).toHaveAttribute('data-motion-sustain','true');
    expect(f.animations.slice(0,4).every(a=>a.cancel.mock.calls.length===1)).toBe(true);
    oldFinish?.();expect(f.cells[0]).toHaveAttribute('data-motion-sustain','true');
    expect(f.animations[4].cancel).not.toHaveBeenCalled();
  }finally{engine.dispose();f.remove();}
});
it('prevents a pending Melody release from clearing a newer accepted attack on the same cell',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);const f=fixture(),engine=createSemanticMotion(f.host,'focus',false);
  try{
    engine.sustainMelody(f.cells[0],.7);engine.sustainMelody(f.cells[0],0);
    vi.advanceTimersByTime(100);engine.play({key:'new-melody',band:'melody',deadlineMs:1100,durationMs:1000},f.cells[0]);
    engine.sustainMelody(f.cells[0],0);vi.advanceTimersByTime(200);
    expect(f.cells[0]).toHaveAttribute('data-motion-active','new-melody');
    expect(f.animations.slice(1).every(a=>a.cancel.mock.calls.length===0)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  }finally{engine.dispose();f.remove();}
});
it('illuminates the existing cell group with one attack and cancels the entire group on retrigger',()=>{
  const f=fixture(),engine=createSemanticMotion(f.host,'focus',false,()=>1000);
  try{
    engine.play({key:'group',band:'hat',deadlineMs:970},f.cells);
    expect(f.animations).toHaveLength(6);expect(f.animations.every(a=>a.currentTime===30)).toBe(true);
    expect(f.cells.every(cell=>cell.dataset.motionActive==='group')).toBe(true);
    const oldFinish=f.animations.at(-1)!.onfinish;
    engine.play({key:'next',band:'hat',deadlineMs:1000},[f.cells[1]]);
    expect(f.animations.slice(0,6).every(a=>a.cancel.mock.calls.length===1)).toBe(true);
    expect(f.cells[0]).not.toHaveAttribute('data-motion-active');oldFinish?.();
    expect(f.cells[1]).toHaveAttribute('data-motion-active','next');
    engine.reset();expect(f.cells.every(cell=>!cell.hasAttribute('data-motion-active'))).toBe(true);
  }finally{engine.dispose();f.remove();}
});
it('uses the legacy selected-cell allocation without multiplying or mutating semantic events',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus"/>);
  const row=view.container.querySelector('[data-motion-band="kick"]')!;
  for(const node of row.querySelectorAll<HTMLElement>('[data-motion-cell],.instrument-motion-layer'))node.animate=vi.fn(()=>({cancel:vi.fn(),onfinish:null,currentTime:0}) as unknown as Animation);
  const attack=Object.freeze({key:'one-real-hit',band:'kick' as const,deadlineMs:1000}),attacks=Object.freeze([attack]);
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:attacks}} profile="focus"/>);
  expect([...row.querySelectorAll<HTMLElement>('[data-motion-active]')].map(cell=>Number(cell.dataset.motionCell))).toEqual(activeSteps('source',0,0).flatMap((on,i)=>on?[i]:[]));
  expect([...row.querySelectorAll<HTMLElement>('[data-motion-active]')].every(cell=>cell.dataset.motionActive===attack.key)).toBe(true);
  expect(attacks).toHaveLength(1);expect(attack.deadlineMs).toBe(1000);
});
it('uses steady reduced markers without moving or accumulating effects and cancels future markers on dispose',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);const f=fixture(),engine=createSemanticMotion(f.host,'dynamic',true);
  try{
    engine.play({key:'1',band:'hat',deadlineMs:1000},f.cells[0]);engine.play({key:'2',band:'hat',deadlineMs:1000},f.cells[1]);
    expect(f.host.querySelectorAll('[data-reduced-marker]')).toHaveLength(1);expect(f.cells[0]).toHaveAttribute('data-reduced-marker');expect(f.animations).toHaveLength(0);
    engine.reset();engine.play({key:'future',band:'hat',deadlineMs:1050},f.cells[0]);engine.dispose();vi.advanceTimersByTime(60);
    expect(f.host.querySelector('[data-reduced-marker]')).toBeNull();
  }finally{engine.dispose();f.remove();}
});
it('maps future epoch deadlines to the monotonic timeline without displaying backward fill',()=>{
  const timelineDescriptor=Object.getOwnPropertyDescriptor(document,'timeline');
  Object.defineProperty(document,'timeline',{configurable:true,value:{currentTime:1992}});
  const clock=vi.spyOn(performance,'now').mockReturnValue(2000),f=fixture(),engine=createSemanticMotion(f.host,'focus',false,()=>1000);
  try{
    engine.play({key:'future',band:'hat',deadlineMs:1010},f.cells[0]);
    expect((f.animations[0] as unknown as Animation).startTime).toBe(2010);
    expect(f.cells[0].querySelector('.instrument-motion-layer')!.animate).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({fill:'forwards'}));
  }finally{engine.dispose();f.remove();clock.mockRestore();if(timelineDescriptor)Object.defineProperty(document,'timeline',timelineDescriptor);else Reflect.deleteProperty(document,'timeline');}
});
it('illuminates a valid Melody state immediately and releases smoothly without inventing an onset',()=>{
  const beat={...base,melody:{active:true,level:.7,note:1}};
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus" melodyEnabled/>);
  view.rerender(<SemanticMotionPattern session={session} beat={beat} profile="focus" melodyEnabled/>);
  const body=view.container.querySelector<HTMLElement>('[data-motion-band="melody"] [data-motion-sustain] .motion-body')!;
  expect(body.style.transition).toBe('none');expect(Number(body.style.opacity)).toBeGreaterThan(.6);
  expect(beat.onsets).toEqual({});
  view.rerender(<SemanticMotionPattern session={session} beat={{...beat,melody:{...beat.melody,active:false}}} profile="focus" melodyEnabled/>);
  expect(body.style.opacity).toBe('0');expect(body.style.transition).toContain('240ms');
});
it('activates the intended rows from immutable accepted events and resets on generation/remount',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus" reduced melodyEnabled/>);
  const attacks=Object.keys(instrumentMotion).map((band,i)=>Object.freeze({key:`event${i}`,band:band as BeatBand,deadlineMs:1000}));
  const before=JSON.stringify(attacks);
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:attacks}} profile="focus" reduced melodyEnabled/>);
  expect(view.container.querySelectorAll('[data-reduced-marker]')).toHaveLength(5);expect(JSON.stringify(attacks)).toBe(before);
  for(const band of Object.keys(instrumentMotion))expect(view.container.querySelector(`[data-motion-band="${band}"] [data-reduced-marker]`)).not.toBeNull();
  view.rerender(<SemanticMotionPattern session={{...session,generation:2}} beat={{...base,visualAttacks:attacks}} profile="focus" reduced melodyEnabled/>);
  expect(view.container.querySelector('[data-reduced-marker]')).toBeNull();
  view.unmount();const remount=render(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:attacks}} profile="focus" reduced melodyEnabled/>);
  expect(remount.container.querySelector('[data-reduced-marker]')).toBeNull();
});
it('discards hidden attacks instead of replaying them on foreground',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus" reduced/>);
  const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[{key:'hidden',band:'hat',deadlineMs:1000}]}} profile="focus" reduced/>);
  hidden.mockReturnValue(false);act(()=>document.dispatchEvent(new Event('visibilitychange')));
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[{key:'hidden',band:'hat',deadlineMs:1000}]}} profile="focus" reduced/>);
  expect(view.container.querySelector('[data-reduced-marker]')).toBeNull();
});
it('keeps accepted source ownership stable while optional session metadata briefly omits generation',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const fenced={...base,sourceGeneration:5};
  const view=render(<SemanticMotionPattern session={{...session,generation:5}} beat={fenced} profile="focus" reduced/>);
  const attack={key:'accepted-snare',band:'clap' as const,deadlineMs:1000};
  view.rerender(<SemanticMotionPattern session={session} beat={{...fenced,visualAttacks:[attack]}} profile="focus" reduced/>);
  expect(view.container.querySelector('[data-motion-band="clap"] [data-reduced-marker]')).not.toBeNull();
  view.rerender(<SemanticMotionPattern session={{...session,generation:5}} beat={{...fenced,visualAttacks:[attack]}} profile="focus" reduced/>);
  expect(view.container.querySelector('[data-motion-band="clap"] [data-reduced-marker]')).not.toBeNull();
  view.rerender(<SemanticMotionPattern session={{...session,generation:6}} beat={{...fenced,visualAttacks:[attack]}} profile="focus" reduced/>);
  expect(view.container.querySelector('[data-reduced-marker]')).toBeNull();
});
it('retains a fresh attack delivered atomically with the next source generation',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={{...session,generation:1}} beat={{...base,sourceGeneration:1}} profile="focus" reduced/>);
  view.rerender(<SemanticMotionPattern session={{...session,generation:2}} beat={{...base,sourceGeneration:2,
    visualAttacks:[{key:'first-new-owner',band:'hat',deadlineMs:1000}]}} profile="focus" reduced/>);
  expect(view.container.querySelector('[data-motion-band="hat"] [data-reduced-marker]')).not.toBeNull();
});
it('clears all old event attributes when a motion row is canceled or reset',()=>{
  const f=fixture(),engine=createSemanticMotion(f.host,'focus',false,()=>1000);
  try{
    engine.play({key:'old',band:'hat',deadlineMs:1000},f.cells);
    const body=f.cells[0].querySelector<HTMLElement>('.motion-body')!;
    body.dataset.beatTrace='old';body.dataset.eventId='old-event';body.dataset.semantic='true';
    engine.play({key:'new',band:'hat',deadlineMs:1000},f.cells);
    expect(body.dataset.eventId).toBeUndefined();expect(body.dataset.semantic).toBeUndefined();
    body.dataset.eventId='reduced-old';body.dataset.semantic='true';
    engine.reset();expect(body.dataset.eventId).toBeUndefined();
  }finally{engine.dispose();f.remove();}
});
it('keeps one steady reduced marker while retiring moved-cell trace identities and reset ownership',()=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const make=(id:string)=>({key:id,band:'hat' as const,deadlineMs:1000,trace:{id,eventId:id,source:'onset' as const,type:'hat' as const,confidence:1,detectedAt:1000,targetTime:1000,targetClock:'epoch-ms' as const,targetPlaybackTime:0,eventSource:'local' as const}});
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus" reduced semanticOnly/>);
  const a=make('a'),b=make('b');
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[a]}} profile="focus" reduced semanticOnly/>);
  const marker=view.container.querySelector('[data-reduced-marker]');
  view.rerender(<SemanticMotionPattern session={session} beat={{...base,visualAttacks:[a,b]}} profile="focus" reduced semanticOnly/>);
  expect(view.container.querySelector('[data-reduced-marker]')).toBe(marker);
  expect(view.container.querySelector('[data-event-id="a"]')).toBeNull();
  expect(view.container.querySelector('[data-event-id="b"]')).not.toBeNull();
  view.rerender(<SemanticMotionPattern session={{...session,playing:false,paused:true}} beat={base} profile="focus" reduced semanticOnly/>);
  expect(view.container.querySelector('[data-visual-attack],[data-event-id],[data-beat-trace]')).toBeNull();
});
it.each([false,true])('clears effects and ignores long holds received while another dock view is active (reduced %s)',reduced=>{
  vi.useFakeTimers();vi.setSystemTime(1000);
  const view=render(<SemanticMotionPattern session={session} beat={base} profile="focus" reduced={reduced} melodyEnabled/>);
  const hidden={...base,visualAttacks:[{key:'hidden-bass',band:'bass' as const,deadlineMs:1000,durationMs:1500}],melody:{active:true,level:.7,note:3}};
  view.rerender(<SemanticMotionPattern session={session} beat={hidden} profile="focus" reduced={reduced} melodyEnabled active={false}/>);
  view.rerender(<SemanticMotionPattern session={session} beat={hidden} profile="focus" reduced={reduced} melodyEnabled active/>);
  expect(view.container.querySelector('[data-reduced-marker],[data-motion-active],[data-motion-sustain]')).toBeNull();
  view.rerender(<SemanticMotionPattern session={session} beat={{...hidden,melody:{active:true,level:.7,note:4}}} profile="focus" reduced={reduced} melodyEnabled active/>);
  expect(view.container.querySelector(reduced?'[data-reduced-marker]':'[data-motion-sustain]')).not.toBeNull();
});
