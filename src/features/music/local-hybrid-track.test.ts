import {describe,it,expect} from 'vitest';
import {localHybridClient,HYBRID_VARIANT,type LocalHybridClip} from './local-hybrid-track';
const sha='a'.repeat(64);
const clip=():LocalHybridClip=>({originalSourceSha256:sha,canonicalWavSha256:sha,decodedPcmSha256:sha,sampleRate:44100,end:15,audioUrl:'/local',predictions:{H:null},hybrid:{state:'UNAVAILABLE',variantId:HYBRID_VARIANT},lead:{state:'READY',revision:sha,provenance:{},events:[{id:'lead-1',time:1,duration:.5,confidence:.8,lead:{policyVersion:'lead-pulse-v1',source:'piano',kind:'pitched-note',detector:'melodia',inputSha256:sha,midiPitch:60}}]}});
describe('exact local saved analysis',()=>{
 it('uses eligible Lead without inventing unavailable percussion',async()=>{const c=clip(),client=localHybridClient(c,true),manifest=await client.manifest();const chunk=await client.chunk(manifest!,0);expect(chunk?.events).toHaveLength(1);expect(chunk?.events[0]).toMatchObject({row:'melody',time:1,duration:.5,lead:c.lead!.events[0].lead});});
 it('does not substitute Lead when its opt-in is off',()=>expect(()=>localHybridClient(clip(),false)).toThrow('No eligible saved analysis'));
 it('rejects invalid source identity and malformed or overlapping Lead notes',()=>{const c=clip();c.originalSourceSha256='song-title';expect(()=>localHybridClient(c,true)).toThrow();const bad=clip();bad.lead!.events.push({...bad.lead!.events[0],id:'lead-2',time:1.2});expect(()=>localHybridClient(bad,true)).toThrow();});
 it('includes the Lead revision in cache identity',async()=>{const c=clip(),first=await localHybridClient(c,true).manifest();c.lead!.revision='b'.repeat(64);expect((await localHybridClient(c,true).manifest())?.revision).not.toEqual(first?.revision);});
 it('rejects a READY percussion cache with missing provenance rather than degrading silently',()=>{const c=clip();c.hybrid.state='READY';expect(()=>localHybridClient(c,true)).toThrow('Frozen H0 analysis incomplete');});
});
