import { useEffect, useMemo, useRef, useState } from 'react';
import SemanticBeatPattern from '../SemanticBeatPattern';
import BeatPattern from '../BeatPattern';
import { leadAvailabilityText } from '../lead-feature';
import { beatRowDiagnostics } from '../beat-row-diagnostics';
import { beatTelemetry } from '../../../../extensions/kanban-music/beat-telemetry.js';
import { createMelodyFixtureClock, type FixtureEventDetail, type FixtureNote, type FixtureSnapshot } from './melody-fixture-clock';
import { compareMelodyDetectors, type DemoFixture } from './melody-detector-fusion';
import { createLeadCacheClock } from './lead-cache-clock';
import listeningStyles from './lead-listening-demo.css?inline';

type Mode='baseline'|'basic-pitch'|'fusion'|'ab'|'lead';
type Lane=Exclude<Mode,'ab'>;
const names:Record<Mode,string>={baseline:'MELODIA Baseline','basic-pitch':'Basic Pitch Only',fusion:'MELODIA + Basic Pitch Fusion',ab:'Side-by-side A/B',lead:'General-Purpose Lead (experimental)'};
const empty:FixtureSnapshot={beat:{sessionId:'',mode:'capture',onsets:{}},total:0,played:0,latest:null,owner:null,currentPitch:null,generation:0};
const manifest='/src-tauri/target/melody-detector-demo/fixtures.json';
interface HumanMarker {kind:string;playbackTime:number;lane:Lane;fixtureId:string;input:string;source:string|null;midiPitch:number|null;nearestOnset:number|null;experimental:true;verified:false}
function download(value:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='kora-melody-detector-row-trace.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function MelodyDetectorDemo() {
  const [fixtures,setFixtures]=useState<DemoFixture[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState('');
  const [mode,setMode]=useState<Mode>('lead'),[audition,setAudition]=useState('original');
  const [audioReady,setAudioReady]=useState(false),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0);
  const previousInput=useRef('');
  const [productRendering,setProductRendering]=useState(false);
  const audioRef=useRef<HTMLAudioElement>(null);
  const [snapshots,setSnapshots]=useState<Partial<Record<Lane,FixtureSnapshot>>>({});
  const [recordingStatus,setRecordingStatus]=useState('Not recording'),[markers,setMarkers]=useState<HumanMarker[]>([]);
  const [markerLane,setMarkerLane]=useState<Lane>('fusion');
  const root=useRef<HTMLDivElement>(null);
  const drivers=useRef<Partial<Record<Lane,Pick<ReturnType<typeof createMelodyFixtureClock>,'snapshot'|'detail'|'dispose'>>>>({});
  const driverEpoch=useRef(0);
  const details=useRef(new Map<string,FixtureEventDetail & {lane:Lane}>());
  const rendered=useRef(new Map<string,number>());
  const run=useRef<{end:number;generations:Partial<Record<Lane,number>>;fixture:DemoFixture;mode:Mode}|null>(null);
  const recorded=useRef<{fixture:DemoFixture;mode:Mode;counters?:Partial<Record<Lane,FixtureSnapshot>>}|null>(null);
  const lastSnapshots=useRef<Partial<Record<Lane,FixtureSnapshot>>>({});
  const fixture=fixtures.find(f=>f.id===selected);
  const comparison=useMemo(()=>fixture?compareMelodyDetectors(fixture):null,[fixture]);
  const lanes:Lane[]=mode==='ab'?['baseline','fusion']:[mode];
  const notesFor=(lane:Lane):FixtureNote[]=>lane==='lead'?fixture?.lead??[]:comparison?.[lane==='basic-pitch'?'basicPitch':lane] ?? [];
  useEffect(()=>{const audio=audioRef.current;return ()=>audio?.pause();},[]);

  useEffect(()=>{
    const abort=new AbortController();
    Promise.all([manifest,'/src-tauri/target/lead-pulse/fixtures.json'].map(path=>fetch(path,{signal:abort.signal})
      .then(r=>r.ok?r.json():{fixtures:[]})))
      .then(values=>{const prepared:DemoFixture[]=[...(values[1].fixtures??[]),...(values[0].fixtures??[])];
        if(!prepared.length)throw new Error('No prepared Melody inputs');
        const requested=new URLSearchParams(window.location.search).get('musicFixture');
        const first=prepared.find(f=>f.id===requested)??prepared[0];
        setFixtures(prepared);setSelected(first.id);setMode(first.lead?'lead':'baseline');})
      .catch(e=>{if(!abort.signal.aborted)setError(String(e));});
    return ()=>abort.abort();
  },[]);

  useEffect(()=>{
    const audio=audioRef.current;
    if(!audio||!fixture)return;
    const sameFixture=previousInput.current===fixture.id;
    previousInput.current=fixture.id;
    const time=audio.currentTime,resume=sameFixture&&!audio.paused;
    setAudioReady(false);setError('');
    audio.pause();
    audio.src=audition==='input'?fixture.inputUrl:audition==='raw'?fixture.rawPitchUrl:fixture.originalUrl;
    const loaded=()=>{audio.currentTime=sameFixture&&time>=fixture.start&&time<fixture.end?time:fixture.start;
      setPosition(audio.currentTime);
      if(resume)void audio.play().catch(()=>setError('Press Play to resume audio'));};
    audio.addEventListener('loadedmetadata',loaded,{once:true});audio.load();
    return ()=>audio.removeEventListener('loadedmetadata',loaded);
  },[fixture,audition]);

  async function play(replay=false) {
    const audio=audioRef.current;
    if(!audio||!fixture)return;
    if(!replay&&!audio.paused){audio.pause();return;}
    if(replay||audio.currentTime>=fixture.end){audio.pause();audio.currentTime=fixture.start;}
    try{await audio.play();}catch{setError('Audio could not start. Press Play again.');}
  }

  useEffect(()=>{
    const audio=audioRef.current;
    if(!audio||!fixture||!comparison)return;
    beatTelemetry.enable();
    const active:Lane[]=mode==='ab'?['baseline','fusion']:[mode];
    const epoch=++driverEpoch.current;
    const owned:typeof drivers.current={};
    const stop=()=>{if(run.current){
      if(recorded.current)recorded.current.counters={...lastSnapshots.current};
      run.current=null;beatRowDiagnostics.stop();setRecordingStatus('Recording stopped; export the captured trace');}};
    for(const lane of active) {
      const changed=(next:FixtureSnapshot)=>{
        if(run.current && (audio.currentTime>=run.current.end || run.current.generations[lane]!==next.generation))stop();
        lastSnapshots.current[lane]=next;
        setSnapshots(previous=>({...previous,[lane]:next}));
      };
      if(lane==='lead') {
        if(!fixture.asset||!fixture.lead) continue;
        owned[lane]=createLeadCacheClock(audio,fixture,changed);continue;
      }
      const driver=createMelodyFixtureClock(audio,changed);owned[lane]=driver;
      const notes=comparison[lane==='basic-pitch'?'basicPitch':lane];
      driver.setFixture({id:`${fixture.id}:${lane}:${epoch}`,label:fixture.label,version:fixture.version+':'+lane,
        audioSha256:fixture.audioSha256,notes,
        sections:notes.map(n=>({start:n.start,end:n.end,source:n.source??n.detector}))});
    }
    drivers.current=owned;
    const commits=()=>root.current?.querySelectorAll<HTMLElement>('[data-beat-trace]').forEach(element=>{
      const id=element.dataset.eventId,traceId=element.dataset.beatTrace;
      if(!id||!traceId)return;
      const lane=element.closest<HTMLElement>('[data-demo-lane]')?.dataset.demoLane as Lane;
      const detail=owned[lane]?.detail(id);
      if(!detail)return;
      details.current.set(traceId,{...detail,lane});
      if(!rendered.current.has(traceId+':commit'))rendered.current.set(traceId+':commit',audio.currentTime);
      element.dataset.experimental='true';element.dataset.verified='false';element.dataset.midiPitch=String(detail.midiPitch);
      element.dataset.melodyDetector=detail.detector??'melodia';element.dataset.selectedSource=detail.selectedSource??'';
      if(details.current.size>10000)details.current.delete(details.current.keys().next().value!);
    });
    const observer=new MutationObserver(commits);
    const element=root.current;
    if(element)observer.observe(element,{subtree:true,childList:true,attributes:true,attributeFilter:['data-beat-trace']});
    const animation=(event:Event)=>{
      const element=event.target as HTMLElement,id=element.dataset.beatTrace;
      if(id)rendered.current.set(id+':animation',audio.currentTime);
      if(rendered.current.size>20000)rendered.current.delete(rendered.current.keys().next().value!);
    };
    element?.addEventListener('animationstart',animation);
    const boundary=()=>{if(audio.currentTime>=fixture.end&&!audio.paused)audio.pause();};
    audio.addEventListener('timeupdate',boundary);
    return ()=>{stop();Object.values(owned).forEach(d=>d?.dispose());drivers.current={};observer.disconnect();
      element?.removeEventListener('animationstart',animation);audio.removeEventListener('timeupdate',boundary);};
  },[fixture,comparison,mode]);

  async function record() {
    const audio=audioRef.current;
    if(!audio||!fixture)return;
    try{if(audio.paused)await audio.play();}catch{setError('Press Play before recording');return;}
    rendered.current.clear();details.current.clear();beatRowDiagnostics.start(30,audio.currentTime);
    recorded.current={fixture,mode};
    run.current={fixture,mode,end:Math.min(fixture.end,audio.currentTime+30),
      generations:Object.fromEntries(Object.entries(drivers.current).map(([lane,d])=>[lane,d!.snapshot().generation]))};
    setRecordingStatus('Recording up to 30 media seconds; pause, seek, input or detector changes stop the run');
  }
  function mark(kind:string) {
    const audio=audioRef.current;
    if(!fixture||!audio)return;
    const lane=mode==='ab'?markerLane:mode;
    const nearest=notesFor(lane).reduce<FixtureNote|undefined>((best,n)=>!best||Math.abs(n.start-audio.currentTime)<Math.abs(best.start-audio.currentTime)?n:best,undefined);
    const marker:HumanMarker={kind,lane,fixtureId:fixture.id,input:fixture.inputLabel,playbackTime:audio.currentTime,
      source:nearest?.source??null,midiPitch:nearest?.pitch??null,nearestOnset:nearest?.start??null,experimental:true,verified:false};
    setMarkers(previous=>[...previous,marker].slice(-2000));
  }
  function exportTrace() {
    const trace=beatRowDiagnostics.snapshot();
    const flashes=trace.flashes.filter(e=>e.semantic&&details.current.has(e.traceId)).map(e=>({...e,...details.current.get(e.traceId),
      actualPlaybackTime:rendered.current.get(e.traceId+':'+e.stage)??null,experimental:true,verified:false}));
    const seen=new Set<string>();
    const hits=flashes.filter(e=>{const key=`${e.lane}:${e.captureId}:${e.eventId}`;
      if(e.stage!=='commit'||seen.has(key))return false;seen.add(key);return true;});
    const identity=recorded.current?.fixture??fixture;
    const exportedMode=recorded.current?.mode??mode;
    download({...trace,flashes,rows:{kick:[],snare:[],hat:[],bass:[],melody:hits},
      timestamps:{kick:[],snare:[],hat:[],bass:[],melody:hits.map(e=>e.targetPlaybackTime)},
      fixture:identity,mode:exportedMode,counters:recorded.current?.counters??snapshots,markers:markers.filter(m=>m.fixtureId===identity?.id),
      detectorDecisions:identity?(exportedMode==='lead'?identity.provenance:compareMelodyDetectors(identity)):null,telemetry:beatTelemetry.snapshot(),
      clock:'single original-fixture HTMLMediaElement.currentTime',experimental:true,verified:false,
      limitation:'Private saved-input comparison, no live source injection. Activations and event counts are not musical accuracy.'});
  }

  return <section className="lead-listening-demo" aria-label="Melody detector Demo Beat Grid">
    <style>{listeningStyles}</style>
    <p><strong>Saved Lead listening acceptance · experimental/unverified</strong></p>
    {error&&<p role="alert">{error}</p>}
    {!fixture&&<p>Loading prepared comparisons…</p>}
    <label>Saved listening fixture <select style={{maxWidth:'100%'}} aria-label="Melody demo input" value={selected} onChange={e=>{setSelected(e.target.value);setAudition('original');setError('');setMode(fixtures.find(f=>f.id===e.target.value)?.lead?'lead':'baseline');}}>
      <optgroup label="Automatic General-Purpose Lead — saved analysis">
        {fixtures.filter(f=>f.lead).map(f=><option key={f.id} value={f.id}>Automatic Lead · {f.label}</option>)}
      </optgroup>
      <optgroup label="Legacy manual-stem / model diagnostics">
        {fixtures.filter(f=>!f.lead).map(f=><option key={f.id} value={f.id}>Legacy diagnostic · {f.label}</option>)}
      </optgroup>
    </select></label>
    {fixture&&<p aria-label="Fixture readiness">{fixture.lead ? `Automatically analyzed Lead · ${fixture.lead.length} saved events · ` : 'Legacy diagnostic input · '}
      {error?'Unavailable: audio or fixture could not load':fixture.lead?.length===0?'Unavailable for Lead listening: no analyzed Lead events; no flashes expected.':!audioReady?'Loading original audio…':'Original audio ready'}
      {' · Passage: '}{fixture.start}–{fixture.end} s{typeof fixture.provenance.originalPosition==='number'&&` · Original track: ${fixture.provenance.originalPosition}–${fixture.provenance.originalPosition+fixture.end-fixture.start} s`}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button type="button" disabled={!audioReady&&!playing} onClick={()=>void play()}>{playing?'Pause':'Play'} {audition==='original'?'original audio':'diagnostic audio'}</button>
      <button type="button" disabled={!audioReady} onClick={()=>void play(true)}>Replay passage</button>
    </div>
    <audio ref={audioRef} preload="auto" aria-label="Demo original playback clock" onCanPlay={()=>setAudioReady(true)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onError={()=>{setAudioReady(false);setError('Original audio unavailable. Select another saved fixture.');}} />
    {fixture&&<label>Passage position <input type="range" aria-label="Saved passage position" min={fixture.start} max={fixture.end} step="0.01" value={Math.max(fixture.start,Math.min(fixture.end,position))} style={{width:'100%'}} onChange={e=>{if(audioRef.current)audioRef.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}} /> {position.toFixed(2)} / {fixture.end.toFixed(2)} s</label>}
    <div ref={root} style={{display:'grid',gridTemplateColumns:mode==='ab'?'repeat(2, minmax(0, 1fr))':'1fr',gap:12}}>
      {lanes.map(lane=>{const saved=snapshots[lane];const state=fixture&&saved&&(saved.session?.id===fixture.id||saved.session?.id.startsWith(fixture.id+':'))?saved:empty;return <div key={lane} data-demo-lane={lane} style={{minWidth:0,overflowWrap:'anywhere'}}>
        <p><strong>{names[lane]}</strong> · experimental/unverified</p>
        {lane==='lead'&&productRendering ? <BeatPattern key={state.generation} session={state.session} beat={state.beat} semanticOnly melodyEnabled />
          : <SemanticBeatPattern key={state.generation} session={state.session} beat={state.beat} melodyEnabled />}
        <p aria-label={names[lane]+' counters'}>Kick: 0 · Snare: 0 · Hat: 0 · Bass: 0 · {lane==='lead'?'Lead':'Melody'}: {state.played}</p>
        {lane==='lead'&&<p aria-label="Saved Lead availability">Lead: {!fixture?.asset||!fixture.lead?'Unavailable: select an automatic Lead fixture':!fixture.lead.length?'Unavailable for listening: saved analysis has no Lead events':state.beat.leadAvailability==='ready'?'Saved Lead events ready':leadAvailabilityText(state.beat.leadAvailability)}</p>}
        <p>Total loaded: {lane==='lead'?fixture?.lead?.length??0:state.total} · Played this run: {state.played} · Latest onset: {state.latest?.toFixed(3)??'—'} s · Owner/source: {state.owner??'abstain'} · MIDI: {state.currentPitch??'—'}</p>
      </div>;})}
    </div>
    {mode==='lead'&&<label><input type="checkbox" checked={productRendering} onChange={e=>setProductRendering(e.target.checked)} /> Preview normal renderer with this saved fixture</label>}
    <details><summary>Legacy model comparisons and raw source auditions</summary>
      <label>Row 5 Melody detector <select style={{maxWidth:'100%'}} aria-label="Row 5 Melody detector" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
        {(Object.entries(names) as [Mode,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      <div><button type="button" onClick={()=>setAudition('original')}>Original audio</button>
        <button type="button" onClick={()=>setAudition('input')}>Analyzed input audio</button>
        {!fixture?.lead&&<button type="button" onClick={()=>setAudition('raw')}>Raw Basic Pitch pitches</button>}</div>
      <p>Audio: {audition} · Input: {fixture?.inputLabel}</p>
    </details>
    <p>Saved original audio and automatic analysis; separate from live YouTube and the analysis service. Pause other music. Rows 1–4 receive no fixture events.</p>
    <button type="button" onClick={()=>void record()}>Record 30 seconds</button><button type="button" onClick={exportTrace}>Export row trace</button>
    <p aria-live="polite">{recordingStatus}</p>
    {mode==='ab'&&<label>Mark lane <select aria-label="Marker comparison lane" value={markerLane} onChange={e=>setMarkerLane(e.target.value as Lane)}>
      <option value="baseline">MELODIA Baseline</option><option value="fusion">Fusion</option></select></label>}
    <div>{[['missed','Missed note'],['extra','Extra note'],['timing','Incorrect timing'],['pitch','Incorrect pitch']].map(([kind,label])=><button type="button" key={kind} onClick={()=>mark(kind)}>{label}</button>)}</div>
    <p>{markers.filter(m=>m.fixtureId===fixture?.id).length} human markers. Export includes source, onset, MIDI pitch, lane and actual DOM/animation playback time.</p>
    <details><summary>Experimental selection and abstention evidence</summary><pre style={{whiteSpace:'pre-wrap',maxHeight:240,overflow:'auto'}}>{JSON.stringify(mode==='lead'?{provenance:fixture?.provenance,ownership:fixture?.sections,events:fixture?.lead}:{
      baselineEvents:comparison?.baseline.length,basicPitchRaw:fixture?.basicPitch.length,basicPitchMonophonic:comparison?.basicPitch.length,
      fusionAdded:comparison?.added.length,policy:comparison?.policy,provenance:fixture?.provenance,decisions:comparison?.decisions},null,2)}</pre></details>
  </section>;
}
