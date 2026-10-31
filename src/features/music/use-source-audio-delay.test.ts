import {act,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import type {BrowserMusicSession} from './mediaBridge';

const native=vi.hoisted(()=>({prepare:vi.fn(),stop:vi.fn(),configure:vi.fn()}));
vi.mock('../native/runtime',()=>({nativeSourceAudioDelayEnabled:()=>true}));
vi.mock('../native/nativeMusic',()=>({prepareNativeSourceAudioDelay:native.prepare,stopNativeSourceAudioDelay:native.stop,sourceKey:(id:string)=>id.split(':').slice(0,3).join(':')}));
vi.mock('./mediaBridge',()=>({configureExperimentalSynchronization:native.configure}));
const {sourceDelayStatus,sourceDelaySupported,useSourceAudioDelay}=await import('./use-source-audio-delay');

beforeEach(()=>{native.prepare.mockReset().mockResolvedValue(undefined);native.stop.mockReset().mockResolvedValue(undefined);native.configure.mockReset().mockResolvedValue(undefined);});
const session=(patch:Partial<BrowserMusicSession>={})=>({id:'peer:tab:doc:0',title:'Song',source:'www.youtube.com',paused:true,generation:1,...patch}) as BrowserMusicSession;
const deferred=()=>{let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const owned=(bufferMs:number)=>({captureId:'capture',mode:'capture',capability:{bufferMs,outputOwned:true,compensationEligible:true,generation:1}}) as unknown as BrowserMusicSession['syncState'];

it('reports Active only when the Companion confirms buffering on an owned output',()=>{
  const base={enabled:true,pending:undefined,transitioning:false,error:''};
  expect(sourceDelayStatus({...base,enabled:false})).toBe('off');
  expect(sourceDelayStatus({...base,session:session()})).toBe('preparing');
  expect(sourceDelayStatus({...base,session:session({syncState:{...owned(170)!,capability:{...owned(170)!.capability!,outputOwned:false}}})})).toBe('preparing');
  expect(sourceDelayStatus({...base,session:session({syncState:owned(170)})})).toBe('active');
  expect(sourceDelayStatus({...base,pending:'off',error:'x'})).toBe('turning-off');
  expect(sourceDelayStatus({...base,error:'x'})).toBe('error');
});
it('refuses ON while playing even when the button is bypassed',async()=>{
  const {result}=renderHook(()=>useSourceAudioDelay(session({paused:false}),vi.fn()));
  await act(()=>result.current.controller!.setEnabled(true));
  expect(native.prepare).not.toHaveBeenCalled();expect(result.current.controller!.status).toBe('off');
});
it('OFF during an in-flight ON wins; the late ON completion retires its own intent',async()=>{
  const gate=deferred();native.prepare.mockReturnValue(gate.promise);
  const {result}=renderHook(()=>useSourceAudioDelay(session(),vi.fn()));
  let on!:Promise<void>;act(()=>{on=result.current.controller!.setEnabled(true);});
  expect(result.current.controller!.status).toBe('preparing');
  await act(()=>result.current.controller!.setEnabled(false));
  gate.resolve();await act(()=>on);
  expect(native.stop).toHaveBeenCalledTimes(2);expect(result.current.routed).toBe(false);expect(result.current.controller!.status).toBe('off');
});
it('a failed ON shows Error and never routes',async()=>{
  native.prepare.mockRejectedValue(Error('This source needs Companion 0.3.29.'));
  const {result}=renderHook(()=>useSourceAudioDelay(session(),vi.fn()));
  await act(()=>result.current.controller!.setEnabled(true));
  expect(result.current.controller!.status).toBe('error');expect(result.current.controller!.error).toMatch('0.3.29');expect(result.current.routed).toBe(false);
});
it('a failed OFF stays routed and visible until a retry is acknowledged',async()=>{
  const {result}=renderHook(()=>useSourceAudioDelay(session(),vi.fn()));
  await act(()=>result.current.controller!.setEnabled(true));expect(result.current.routed).toBe(true);
  native.stop.mockRejectedValueOnce(Error('no ack'));
  await act(()=>result.current.controller!.setEnabled(false));
  expect(result.current.controller!.status).toBe('error');expect(result.current.controller!.enabled).toBe(true);
  await act(()=>result.current.controller!.setEnabled(false));
  expect(result.current.controller!.status).toBe('off');expect(result.current.routed).toBe(false);
});
it('a source switch while Active turns OFF once and never routes the new source',async()=>{
  let current=session();const {result,rerender}=renderHook(()=>useSourceAudioDelay(current,vi.fn()));
  await act(()=>result.current.controller!.setEnabled(true));
  current=session({id:'peer:tab2:doc:0',generation:4});rerender();
  expect(result.current.routed).toBe(false);
  await waitFor(()=>expect(result.current.controller!.enabled).toBe(false));
  expect(native.stop).toHaveBeenCalledOnce();expect(native.stop).toHaveBeenCalledWith('peer:tab:doc:0');
});
it('applies the consented delay once per capture while paused, never while playing',async()=>{
  const refresh=vi.fn();let current=session({paused:false,syncState:owned(0)});
  const {result,rerender}=renderHook(()=>useSourceAudioDelay(current,refresh));
  current=session({paused:true});rerender();await act(()=>result.current.controller!.setEnabled(true));
  current=session({paused:false,syncState:owned(0)});rerender();expect(native.configure).not.toHaveBeenCalled();
  current=session({paused:true,syncState:owned(0)});rerender();rerender();
  await waitFor(()=>expect(refresh).toHaveBeenCalled());
  expect(native.configure).toHaveBeenCalledOnce();expect(native.configure.mock.calls[0][1]).toMatchObject({enabled:true,compensationMs:170,captureId:'capture'});
});
it('keeps the route when the page swaps media elements or seeks within the same song',async()=>{
  let current=session();const {result,rerender}=renderHook(()=>useSourceAudioDelay(current,vi.fn()));
  await act(()=>result.current.controller!.setEnabled(true));
  current=session({id:'peer:tab:doc:4',generation:7});rerender();
  expect(result.current.routed).toBe(true);expect(result.current.controller!.transitioning).toBe(false);expect(native.stop).not.toHaveBeenCalled();
});
it('explains instead of silently reverting when the song changes while turning on',async()=>{
  const gate=deferred();native.prepare.mockReturnValue(gate.promise);
  let current=session();const {result,rerender}=renderHook(()=>useSourceAudioDelay(current,vi.fn()));
  let on!:Promise<void>;act(()=>{on=result.current.controller!.setEnabled(true);});
  current=session({asset:{provider:'youtube',id:'another'}} as Partial<BrowserMusicSession>);rerender();
  gate.resolve();await act(()=>on);
  expect(result.current.routed).toBe(false);expect(result.current.controller!.status).toBe('error');expect(result.current.controller!.error).toMatch('song changed');
});
it('supports Apple Music previews but never Spotify or policy-blocked sources',()=>{
  expect(sourceDelaySupported(session({source:'music.apple.com'}))).toBe(true);
  expect(sourceDelaySupported(session({source:'open.spotify.com',asset:{provider:'spotify',id:'x'}} as Partial<BrowserMusicSession>))).toBe(false);
  expect(sourceDelaySupported(session({source:'music.apple.com',syncState:{mode:'clock',capability:{support:'policy-blocked'}}} as unknown as Partial<BrowserMusicSession>))).toBe(false);
});
