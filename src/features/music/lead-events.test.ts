import { afterEach, expect, it, vi } from 'vitest';
import { LEAD_ANALYSIS_VERSION, LEAD_POLICY_VERSION, parseLeadProvenance } from './lead-events';
import { parseChunk, type TrackManifest } from './event-track';
import { createEventTrackClient } from './event-track-client';
import { leadPulseEnabled, leadRollout, leadProcessingEnabled } from './lead-feature';
const runtime=vi.hoisted(()=>({native:false,token:null as string|null}));
vi.mock('../native/runtime',()=>({isNativeWidget:()=>runtime.native}));
vi.mock('../../lib/supabase',()=>({default:{auth:{getSession:async()=>({data:{session:runtime.token?{access_token:runtime.token}:null}})}}}));
const asset={provider:'youtube' as const,id:'abcdefghijk'};
const lead={policyVersion:LEAD_POLICY_VERSION,source:'vocals' as const,kind:'vocal-articulation' as const,
  detector:'vocal-body-articulation' as const,inputSha256:'a'.repeat(64)};
const base:TrackManifest={version:1,revision:'r',asset,analysisVersion:LEAD_ANALYSIS_VERSION,duration:30,chunkSeconds:30,melodyPolicy:'dominant-monophonic'};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();runtime.native=false;runtime.token=null;history.replaceState(null,'','/');});
it('keeps vocal articulations unpitched and requires provenance only on versioned Lead events',()=>{
  expect(parseLeadProvenance(lead)).toEqual(lead);
  const event={id:'note',row:'melody',time:.2,duration:.08,confidence:.6,lead};
  const chunk={version:1,revision:'r',index:0,events:[event]};
  expect(parseChunk(chunk,base,0)?.events[0].lead).toEqual(lead);
  expect(parseChunk({...chunk,events:[{...event,lead:undefined}]},base,0)).toBeUndefined();
  expect(parseChunk({...chunk,events:[{...event,row:'kick'}]},base,0)).toBeUndefined();
  expect(parseLeadProvenance({...lead,source:'drums'})).toBeUndefined();
  expect(parseLeadProvenance({...lead,kind:'pitched-note'})).toBeUndefined();
  expect(parseChunk({...chunk,events:[]},base,0)?.events).toEqual([]);
  expect(parseChunk({...chunk,events:[{...event,lead:undefined}]},{...base,analysisVersion:'legacy'},0)).toBeDefined();
});
it.each([false,true])('uses identical flagged version and parsed timestamps in web/native=%s',async native=>{
  runtime.native=native;vi.stubEnv('DEV',true);
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json(base))
    .mockResolvedValueOnce(Response.json({version:1,revision:'r',index:0,events:[{id:'note',row:'melody',time:1.25,duration:.08,confidence:.6,lead}]}));
  const client=createEventTrackClient(asset,new AbortController().signal,30);
  const manifest=await client.manifest({start:0,end:30});
  expect(fetcher.mock.calls[0][0]).toBe('/api/beat-events?provider=youtube&id=abcdefghijk&start=0&end=30&analysisVersion='+LEAD_ANALYSIS_VERSION);
  expect((await client.chunk(manifest!,0))?.events[0]).toMatchObject({time:1.25,row:'melody',lead});
});
it('enables development while separate private/public release gates default closed',()=>{
  vi.stubEnv('DEV',false);vi.stubEnv('VITE_LEAD_PULSE_BETA_ENABLED','false');vi.stubEnv('VITE_LEAD_PULSE_PUBLIC_ENABLED','false');
  history.replaceState(null,'','/?musicLead=1');expect(leadPulseEnabled()).toBe(false);
  vi.stubEnv('DEV',true);vi.stubEnv('VITE_LEAD_PULSE_DEV_ENABLED','true');expect(leadRollout()).toBe('development');
  expect(leadProcessingEnabled()).toBe(false);
  vi.stubEnv('VITE_LEAD_PULSE_DEV_ENABLED','false');expect(leadPulseEnabled()).toBe(false);
  vi.stubEnv('DEV',false);vi.stubEnv('VITE_LEAD_PULSE_BETA_ENABLED','true');expect(leadRollout()).toBe('private-beta');
  expect(leadProcessingEnabled()).toBe(false);
  vi.stubEnv('VITE_LEAD_PULSE_PUBLIC_ENABLED','true');expect(leadRollout()).toBe('public');
});
it('keeps release Desktop on the authenticated HTTPS gateway with the same Lead version',async()=>{
  runtime.native=true;vi.stubEnv('DEV',false);vi.stubEnv('VITE_LEAD_PULSE_BETA_ENABLED','true');
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(base));
  await createEventTrackClient(asset,new AbortController().signal,30).manifest({start:0,end:30});
  expect(fetcher.mock.calls[0][0]).toBe('https://koraspace.online/api/beat-events?provider=youtube&id=abcdefghijk&start=0&end=30&analysisVersion='+LEAD_ANALYSIS_VERSION);
  expect(fetcher.mock.calls[0][1]?.credentials).toBe('omit');
});

it('authenticates private cache reads without uploading or admitting analysis by UI activation',async()=>{
  runtime.token='private-token';vi.stubEnv('DEV',true);vi.stubEnv('VITE_LEAD_PULSE_PROCESSING_ENABLED','false');
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json(base));
  const client=createEventTrackClient(asset,new AbortController().signal,30);
  await client.manifest({start:0,end:30});
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer private-token');
  expect(await client.requestAnalysis({start:0,end:30},crypto.randomUUID(),true)).toBe('unavailable');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('recognizes captured-segment pending admission without claiming unavailable input is empty',async()=>{
  runtime.token='private-token';vi.stubEnv('DEV',true);vi.stubEnv('VITE_LEAD_PULSE_PROCESSING_ENABLED','true');
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(Response.json({status:'pending',trackId:crypto.randomUUID(),inputState:'awaiting-segment'},{status:202}))
    .mockResolvedValueOnce(Response.json({status:'unavailable'},{status:503}));
  const client=createEventTrackClient(asset,new AbortController().signal,30);
  expect(await client.requestAnalysis({start:0,end:30},crypto.randomUUID(),true)).toBe('pending');
  expect(await client.requestAnalysis({start:0,end:30},crypto.randomUUID(),true)).toBe('unavailable');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
