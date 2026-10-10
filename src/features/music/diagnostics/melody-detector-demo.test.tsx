import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import MelodyDetectorDemo from './MelodyDetectorDemo';
import type { DemoFixture } from './melody-detector-fusion';
import { beatTelemetry } from '../../../../extensions/kanban-music/beat-telemetry.js';
import { recordCellFlash } from '../beat-row-diagnostics';

vi.mock('../../../lib/supabase', () => ({ default: null }));
vi.mock('../../native/runtime', () => ({ isNativeWidget: () => false }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  beatTelemetry.enable(false);
  beatTelemetry.clear();
  vi.useRealTimers();
});

it('preserves recorded onset provenance after another fixture reuses its saved event IDs',async()=>{
  vi.useFakeTimers();
  const fixture:DemoFixture={id:'recorded',label:'Recorded vocal',version:'lead-pulse-v1',audioSha256:'original-A',analysisAudioSha256:'input-A',
    start:0,end:30,originalUrl:'a.wav',inputUrl:'a.wav',rawPitchUrl:'a.wav',inputLabel:'automatic',baseline:[],basicPitch:[],frames:[],provenance:{selection:'automatic'},
    asset:{provider:'soundcloud',id:'private-local/recorded'},sections:[{start:0,end:30,source:'vocals'}],
    lead:[{start:.3,end:.5,pitch:null,source:'vocals',confidence:.8,policyVersion:'lead-pulse-v1',kind:'vocal-articulation',detector:'vocal-body-articulation',inputSha256:'a'.repeat(64)}]};
  const other:DemoFixture={...fixture,id:'other',audioSha256:'original-B',sections:[{start:0,end:30,source:'piano'}],
    lead:[{...fixture.lead![0],pitch:64,source:'piano',kind:'pitched-note',detector:'melodia',inputSha256:'b'.repeat(64)}]};
  vi.spyOn(globalThis,'fetch').mockImplementation(async url=>Response.json({fixtures:String(url).includes('lead-pulse')?[fixture,other]:[]}));
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:trace');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  let payload:{fixture:DemoFixture;flashes:{fixtureId:string;selectedSource:string;actualPlaybackTime:number;stage:string}[]} | undefined;
  const OriginalBlob=globalThis.Blob;
  vi.stubGlobal('Blob',class extends OriginalBlob{constructor(parts:BlobPart[],options?:BlobPropertyBag){super(parts,options);payload=JSON.parse(String(parts[0]));}});
  const view=render(<MelodyDetectorDemo/>);
  await act(async()=>vi.advanceTimersByTimeAsync(50));
  const audio=view.getByLabelText('Demo original playback clock') as HTMLAudioElement;
  Object.defineProperty(audio,'readyState',{configurable:true,value:4});Object.defineProperty(audio,'paused',{configurable:true,value:false});
  fireEvent.playing(audio);fireEvent.click(view.getByRole('button',{name:'Record 30 seconds'}));
  const advance=async()=>{for(let i=0;i<20;i++){audio.currentTime+=.02;await act(async()=>vi.advanceTimersByTimeAsync(20));}};
  await advance();
  const cell=view.container.querySelector<HTMLElement>('[data-beat-trace]')!;
  fireEvent.animationStart(cell);
  recordCellFlash(cell,'animation');
  Object.defineProperty(audio,'paused',{configurable:true,value:true});fireEvent.pause(audio);
  fireEvent.click(view.getByRole('button',{name:'Export row trace'}));
  expect(payload!.flashes.length).toBeGreaterThan(0);
  expect(payload!.flashes.some(f=>f.stage==='animation'&&Number.isFinite(f.actualPlaybackTime))).toBe(true);
  const captured=JSON.stringify(payload!.flashes);
  fireEvent.change(view.getByLabelText('Melody demo input'),{target:{value:'other'}});
  audio.currentTime=0;Object.defineProperty(audio,'paused',{configurable:true,value:false});fireEvent.playing(audio);await advance();
  fireEvent.click(view.getByRole('button',{name:'Export row trace'}));
  expect(payload!.fixture.id).toBe('recorded');expect(JSON.stringify(payload!.flashes)).toBe(captured);
  expect(payload!.flashes.every(f=>f.fixtureId==='recorded'&&f.selectedSource==='vocals')).toBe(true);
});

it('exports the recorded Lead evidence after switching to a legacy detector mode', async () => {
  const fixture: DemoFixture = {
    id: 'lead-recording', label: 'automatic input', version: 'lead-pulse-v1',
    audioSha256: 'original', analysisAudioSha256: 'input', start: 0, end: 30,
    originalUrl: 'original.wav', inputUrl: 'input.wav', rawPitchUrl: 'pitch.wav',
    inputLabel: 'automatic', baseline: [], basicPitch: [], frames: [],
    lead: [], asset: { provider: 'soundcloud', id: 'private-local/recording' },
    provenance: { policyVersion: 'lead-pulse-v1', selection: 'automatic' },
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    if (String(url).includes('/fixtures.json')) {
      return Response.json({ fixtures: String(url).includes('lead-pulse') ? [fixture] : [] });
    }
    return new Response(null, { status: 404 });
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  let payload: { mode: string; detectorDecisions: unknown } | undefined;
  const OriginalBlob = globalThis.Blob;
  vi.stubGlobal('Blob', class extends OriginalBlob {
    constructor(parts: BlobPart[], options?: BlobPropertyBag) {
      super(parts, options);
      payload = JSON.parse(String(parts[0]));
    }
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:row-trace');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const view = render(<MelodyDetectorDemo />);
  await waitFor(() => expect(view.getByLabelText('Melody demo input')).toHaveValue(fixture.id));
  expect(view.getByLabelText('Row 5 Melody detector')).toHaveValue('lead');
  fireEvent.canPlay(view.getByLabelText('Demo original playback clock'));
  expect(view.getByLabelText('Fixture readiness')).toHaveTextContent('Unavailable for Lead listening: no analyzed Lead events');
  const audio = view.getByLabelText('Demo original playback clock');
  Object.defineProperty(audio, 'paused', { configurable: true, value: false });
  fireEvent.click(view.getByRole('button', { name: 'Record 30 seconds' }));
  await waitFor(() => expect(view.getByText(/Recording up to 30 media seconds/)).toBeTruthy());
  fireEvent.change(view.getByLabelText('Row 5 Melody detector'), { target: { value: 'baseline' } });
  fireEvent.click(view.getByRole('button', { name: 'Export row trace' }));
  expect(payload).toMatchObject({ mode: 'lead', detectorDecisions: fixture.provenance });
});

it('opens automatic saved analysis ahead of legacy inputs and provides one original-audio clock',async()=>{
  const automatic:DemoFixture={id:'automatic',label:'Automatic test',version:'lead-pulse-v1',audioSha256:'original',analysisAudioSha256:'stem',start:0,end:30,
    originalUrl:'original.wav',inputUrl:'stem.wav',rawPitchUrl:'pitch.wav',inputLabel:'automatic',baseline:[],basicPitch:[],frames:[],provenance:{originalPosition:120},
    asset:{provider:'soundcloud',id:'private-local/auto'},sections:[{start:0,end:30,source:'vocals'}],
    lead:[{start:.3,end:.5,pitch:null,source:'vocals',confidence:.7,policyVersion:'lead-pulse-v1',kind:'vocal-articulation',detector:'vocal-body-articulation',inputSha256:'b'.repeat(64)}]};
  const legacy={...automatic,id:'legacy',label:'Manual stem',lead:undefined,asset:undefined};
  vi.spyOn(globalThis,'fetch').mockImplementation(async url=>Response.json({fixtures:String(url).includes('lead-pulse')?[automatic]:[legacy]}));
  const load=vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
  const pause=vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
  const view=render(<MelodyDetectorDemo/>);
  await waitFor(()=>expect(view.getByLabelText('Melody demo input')).toHaveValue('automatic'));
  expect(view.getByLabelText('Row 5 Melody detector')).toHaveValue('lead');
  expect(view.container.querySelectorAll('audio')).toHaveLength(1);
  expect(view.getByRole('option',{name:'Legacy diagnostic · Manual stem'})).toBeTruthy();
  const audio=view.getByLabelText('Demo original playback clock') as HTMLAudioElement;
  Object.defineProperty(audio,'readyState',{configurable:true,value:4});fireEvent.loadedMetadata(audio);fireEvent.canPlay(audio);
  await waitFor(()=>expect(view.getByLabelText('Saved Lead availability')).toHaveTextContent('Saved Lead events ready'));
  expect(view.getByLabelText('Fixture readiness')).toHaveTextContent('1 saved events · Original audio ready');
  expect(view.getByLabelText('Fixture readiness')).toHaveTextContent('Original track: 120–150 s');
  fireEvent.click(view.getByRole('button',{name:'Play original audio'}));expect(play).toHaveBeenCalledTimes(1);
  fireEvent.play(audio);Object.defineProperty(audio,'paused',{configurable:true,value:false});
  fireEvent.click(view.getByRole('button',{name:'Pause original audio'}));expect(pause).toHaveBeenCalledTimes(2);
  audio.currentTime=7;fireEvent.change(view.getByLabelText('Row 5 Melody detector'),{target:{value:'baseline'}});
  expect(audio.currentTime).toBe(7);expect(load).toHaveBeenCalledTimes(1);
  fireEvent.click(view.getByRole('button',{name:'Replay passage'}));expect(audio.currentTime).toBe(0);expect(play).toHaveBeenCalledTimes(2);
  expect(vi.mocked(fetch).mock.calls.every(([url])=>String(url).includes('/fixtures.json'))).toBe(true);
});
