import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {BrowserMusicSession} from './mediaBridge';

const native=vi.hoisted(()=>({prepare:vi.fn(),stop:vi.fn(),configure:vi.fn(),media:vi.fn()}));
vi.mock('../native/runtime',()=>({nativeSourceAudioDelayEnabled:()=>true}));
vi.mock('../native/nativeMusic',()=>({prepareNativeSourceAudioDelay:native.prepare,stopNativeSourceAudioDelay:native.stop,sourceKey:(id:string)=>id.split(':').slice(0,3).join(':')}));
vi.mock('./mediaBridge',()=>({configureExperimentalSynchronization:native.configure,sendMusicRequest:native.media}));
const {sourceDelayStatus,sourceDelaySupported,useSourceAudioDelay,writeEnhancedBeatSyncPreference,readEnhancedBeatSyncPreference,ENHANCED_BEAT_SYNC_KEY}=await import('./use-source-audio-delay');

afterEach(cleanup);
beforeEach(()=>{
  localStorage.clear();
  for(const mock of Object.values(native))mock.mockReset().mockResolvedValue(undefined);
});
const session=(patch:Partial<BrowserMusicSession>={})=>({id:'peer:tab:doc:0',title:'Song',source:'music.youtube.com',paused:false,playing:true,generation:1,...patch}) as BrowserMusicSession;
const owned=(bufferMs:number,capture='capture',patch={})=>({captureId:capture,mode:'capture',capability:{bufferMs,outputOwned:true,compensationEligible:true,generation:1,...patch}}) as unknown as BrowserMusicSession['syncState'];
const turnOn=()=>act(()=>writeEnhancedBeatSyncPreference(true));

it('stores one approval at the exact delay and rejects anything broader',()=>{
  expect(readEnhancedBeatSyncPreference()).toBeUndefined();
  writeEnhancedBeatSyncPreference(true);expect(readEnhancedBeatSyncPreference()).toMatchObject({enabled:true,approvedDelayMs:170,scope:'eligible-audio-sources'});
  localStorage.setItem(ENHANCED_BEAT_SYNC_KEY,JSON.stringify({...readEnhancedBeatSyncPreference(),approvedDelayMs:250}));
  expect(readEnhancedBeatSyncPreference(),'A different delay needs a new approval.').toBeUndefined();
  writeEnhancedBeatSyncPreference(false);expect(localStorage.getItem(ENHANCED_BEAT_SYNC_KEY)).toBeNull();
});
it('reports the five compact states',()=>{
  const base={preferred:true,routed:true,pending:undefined,error:'',supported:true};
  expect(sourceDelayStatus({...base,preferred:false,routed:false})).toBe('off');
  expect(sourceDelayStatus({...base,session:session({syncState:owned(0)})})).toBe('preparing');
  expect(sourceDelayStatus({...base,session:session({syncState:owned(170)})})).toBe('on');
  expect(sourceDelayStatus({...base,supported:false,session:session()})).toBe('unavailable');
  expect(sourceDelayStatus({...base,session:session({syncState:owned(0,'capture',{compensationEligible:false})})})).toBe('unavailable');
  expect(sourceDelayStatus({...base,error:'x'})).toBe('error');
});
it('stays Off and never routes without the approval',async()=>{
  const {result}=renderHook(()=>useSourceAudioDelay(session({syncState:owned(0)}),vi.fn()));
  await act(async()=>{});expect(native.prepare).not.toHaveBeenCalled();expect(result.current.controller!.status).toBe('off');
});
it('routes automatically after the approval and applies the delay with a brief pause while playing',async()=>{
  let current=session({syncState:owned(0)});
  native.media.mockImplementation(async(action:string)=>{if(action==='media.pause')current={...current,paused:true,playing:false};if(action==='media.play')current={...current,paused:false,playing:true};return [current];});
  const {result,rerender}=renderHook(()=>useSourceAudioDelay(current,vi.fn()));
  turnOn();
  await waitFor(()=>expect(result.current.routed).toBe(true));
  rerender();
  await waitFor(()=>expect(native.configure).toHaveBeenCalledTimes(1),{timeout:3000});
  expect(native.media.mock.calls.map(call=>call[0])).toEqual(['media.pause','media.play']);
  expect(native.configure.mock.calls[0][1]).toMatchObject({enabled:true,captureId:'capture',compensationMs:170});
});
it('applies without pausing when the song is already paused, once per capture',async()=>{
  const {result,rerender}=renderHook(({value})=>useSourceAudioDelay(value,vi.fn()),{initialProps:{value:session({paused:true,playing:false,syncState:owned(0)})}});
  turnOn();await waitFor(()=>expect(result.current.routed).toBe(true));
  rerender({value:session({paused:true,playing:false,syncState:owned(0)})});
  await waitFor(()=>expect(native.configure).toHaveBeenCalledTimes(1));expect(native.media).not.toHaveBeenCalled();
  rerender({value:session({paused:true,playing:false,syncState:owned(0)})});await act(async()=>{});
  expect(native.configure).toHaveBeenCalledTimes(1);
});
it('keeps the route across song changes in the same tab and stops it when turned off',async()=>{
  const {result,rerender}=renderHook(({value})=>useSourceAudioDelay(value,vi.fn()),{initialProps:{value:session({syncState:owned(170)})}});
  turnOn();await waitFor(()=>expect(result.current.routed).toBe(true));
  rerender({value:session({title:'Next song',asset:{provider:'youtube',id:'next'},syncState:owned(170,'capture-2')} as Partial<BrowserMusicSession>)});
  await act(async()=>{});expect(native.stop).not.toHaveBeenCalled();expect(result.current.controller!.status).toBe('on');
  act(()=>writeEnhancedBeatSyncPreference(false));
    await waitFor(()=>expect(native.stop).toHaveBeenCalledTimes(1));await waitFor(()=>expect(result.current.routed).toBe(false));
});
it('moves the route when a different music tab is selected',async()=>{
  const {result,rerender}=renderHook(({value})=>useSourceAudioDelay(value,vi.fn()),{initialProps:{value:session({syncState:owned(170)})}});
  turnOn();await waitFor(()=>expect(result.current.routed).toBe(true));
  rerender({value:session({id:'peer:other-tab:doc:0'})});
  await waitFor(()=>expect(native.stop).toHaveBeenCalledWith('peer:tab:doc:0'));
  await waitFor(()=>expect(native.prepare).toHaveBeenLastCalledWith('peer:other-tab:doc:0'));
});
it('reports a failed start once and does not retry in a loop',async()=>{
  native.prepare.mockRejectedValue(Error('Enhanced Beat Sync needs Music Companion 0.3.31 or newer.'));
  const {result}=renderHook(()=>useSourceAudioDelay(session(),vi.fn()));
  turnOn();await waitFor(()=>expect(result.current.controller!.status).toBe('error'));
  await act(async()=>{await new Promise(done=>setTimeout(done,50));});
  expect(native.prepare).toHaveBeenCalledTimes(1);expect(result.current.controller!.error).toMatch(/0\.3\.31/);
});
it('supports YouTube, SoundCloud and Apple Music previews but never Spotify or policy-blocked sources',()=>{
  expect(sourceDelaySupported(session())).toBe(true);
  expect(sourceDelaySupported(session({source:'music.apple.com'}))).toBe(true);
  expect(sourceDelaySupported(session({source:'open.spotify.com'}))).toBe(false);
  expect(sourceDelaySupported(session({asset:{provider:'spotify',id:'x'}} as Partial<BrowserMusicSession>))).toBe(false);
});
