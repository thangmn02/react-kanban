import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createNativeAudioFeed } from './nativeAudio';
import { beatTelemetry, parseBeatTraces } from '../../../extensions/kanban-music/beat-telemetry.js';
import {nativeCompanionPreviewEnabled,nativeSourceAudioDelayEnabled} from './runtime';
import type {SyncConfiguration} from '../../../extensions/kanban-music/beat-mode.js';
import type { PlaybackClock } from '../../../extensions/kanban-music/beat-timing.js';

const receivers = new Set<(value: unknown) => void>();
const publish = (value: unknown) => { for (const receive of receivers) receive(value); };
const audioReceivers = new Set<(sessionId: string, samples: Float32Array, clock: PlaybackClock) => void>();
const audio = createNativeAudioFeed(publish, (sessionId, samples, clock) => {
  for (const receive of audioReceivers) receive(sessionId, samples, clock);
});
export function subscribeNativeAudio(receive: (sessionId: string, samples: Float32Array, clock: PlaybackClock) => void) {
  audioReceivers.add(receive);
  return () => { audioReceivers.delete(receive); };
}
// Register before sync.start. A single listener survives surface/layout swaps.
let ready: Promise<unknown> | undefined;
let audioOwner: { sessionId: string; subscriptionId: string } | undefined;
let companionOwner: {sessionId:string;subscriptionId:string;sourceAudioDelay:boolean} | undefined;
let beatQueue:Promise<unknown>=Promise.resolve();
let sourceQueueDepth=0;
const retiredCompanionSubscriptions=new Set<string>();
const ownerKey=(sessionId:string,subscriptionId:string)=>JSON.stringify([sessionId,subscriptionId]);
let sourceIntentEpoch=0;
// One intent per browser document: sites like YouTube swap media elements, which changes the session's trailing index.
export const sourceKey=(sessionId:string)=>sessionId.split(':').slice(0,3).join(':');
const sourceIntents=new Map<string,{epoch:number;enabled:boolean}>();
const sourceSubscriptions=new Map<string,number>();
const sourceLeases=new Map<string,{sessionId:string;subscriptionId:string}>();
function enqueueSourceTask<T>(run:()=>Promise<T>):Promise<T>{
  sourceQueueDepth++;
  const task=beatQueue.catch(()=>{}).then(run);beatQueue=task.then(()=>{sourceQueueDepth--;},()=>{sourceQueueDepth--;});return task;
}
function ensureFeed() {
  return ready ??= (async () => {
    const stop = await listen<unknown>('native-music-beat', ({ payload }) => {
      const event=payload as {sessionId?:string;subscriptionId?:string}|null;
      if(event?.sessionId&&event.subscriptionId&&retiredCompanionSubscriptions.has(ownerKey(event.sessionId,event.subscriptionId)))return;
      const owned=companionOwner&&event?.sessionId===companionOwner.sessionId&&event.subscriptionId===companionOwner.subscriptionId;
      if (nativeCompanionPreviewEnabled() || owned || audio.companion(payload)) publish(payload);
    });
    try { await listen<unknown>('native-audio-ended', ({ payload }) => audio.ended(payload)); }
    catch (error) { stop(); throw error; }
    // An optional diagnostic listener must not block capture/control setup.
    void listen<Record<string, unknown>>('native-beat-telemetry', ({ payload }) => {
      if (!payload || typeof payload.stage !== 'string') return;
      const traces = parseBeatTraces(payload.telemetry);
      const tracer = beatTelemetry.at(String(payload.component));
      if (traces?.length) tracer.mark(payload.stage, traces, payload);
      else tracer.record(payload.stage, undefined, payload);
    }).catch(() => {});
  })().catch((error) => { ready = undefined; throw error; });
}
export function requestNativeMusic(action: string, sessionId?: string, subscriptionId?: string, value?: number, configuration?:SyncConfiguration, sourceAudioDelay=false): Promise<Record<string, unknown>> {
  const intent=sourceAudioDelay&&sessionId?sourceIntents.get(sourceKey(sessionId)):undefined;
  const subscriptionKey=sessionId&&subscriptionId?ownerKey(sessionId,subscriptionId):undefined;
  if(sourceAudioDelay&&action==='dock.beat.sync.start'&&subscriptionKey&&!sourceSubscriptions.has(subscriptionKey))sourceSubscriptions.set(subscriptionKey,intent?.epoch??-1);
  const epoch=subscriptionKey?sourceSubscriptions.get(subscriptionKey):undefined;
  const run=()=>performNativeMusicRequest(action,sessionId,subscriptionId,value,configuration,sourceAudioDelay,epoch);
  if((sourceAudioDelay||companionOwner?.sourceAudioDelay||sourceQueueDepth>0)&&(action.startsWith('dock.beat.')||action==='beat.experimental.configure')){
    return enqueueSourceTask(run);
  }
  return run();
}
async function performNativeMusicRequest(action:string,sessionId?:string,subscriptionId?:string,value?:number,configuration?:SyncConfiguration,sourceAudioDelay=false,intentEpoch?:number):Promise<Record<string,unknown>>{
  if(action==='beat.experimental.configure')sourceAudioDelay=Boolean(companionOwner&&companionOwner.sessionId===sessionId&&companionOwner.sourceAudioDelay);
  if(sourceAudioDelay&&!nativeSourceAudioDelayEnabled())throw Error('Optional source audio delay is unavailable.');
  if(action==='dock.beat.sync.start'&&sessionId&&subscriptionId&&retiredCompanionSubscriptions.has(ownerKey(sessionId,subscriptionId)))throw Error('The previous source delay subscription has ended.');
  const assertIntent=()=>{if(sourceAudioDelay&&action==='dock.beat.sync.start'&&(!sessionId||!sourceIntents.get(sourceKey(sessionId))?.enabled||sourceIntents.get(sourceKey(sessionId))?.epoch!==intentEpoch))throw Error('The previous source delay subscription has ended.');};
  assertIntent();
  const companionCapture=nativeCompanionPreviewEnabled()||sourceAudioDelay;
  if(companionCapture&&audioOwner){audio.stop(audioOwner.sessionId,audioOwner.subscriptionId);audioOwner=undefined;}
  const starting = action === 'dock.beat.sync.start' && sessionId && subscriptionId
    && !companionCapture ? { sessionId, subscriptionId } : undefined;
  if (starting) audioOwner = starting;
  const companionStarting=action==='dock.beat.sync.start'&&sessionId&&subscriptionId&&companionCapture?{sessionId,subscriptionId,sourceAudioDelay}:undefined;
  if(starting)companionOwner=undefined;
  if (action === 'dock.beat.sync.stop' && audioOwner?.sessionId === sessionId && audioOwner?.subscriptionId === subscriptionId) audioOwner = undefined;
  await ensureFeed();
  assertIntent();
  if(companionStarting){companionOwner=companionStarting;if(sourceAudioDelay)sourceLeases.set(ownerKey(companionStarting.sessionId,companionStarting.subscriptionId),companionStarting);}
  if (action === 'dock.beat.sync.stop' && sessionId && subscriptionId) audio.stop(sessionId, subscriptionId);
  // Desktop includes the learned runtime and observes Windows process PCM.
  // Keep browser playback untouched; Companion provides discovery and clock.
  // Companion may emit browser policy before its start response. Reserve the
  // native owner first, while retaining acknowledgement-gated PCM activation.
  const release = starting && audioOwner === starting ? audio.reserve(starting.sessionId, starting.subscriptionId) : undefined;
  try {
    const response = await invoke<Record<string, unknown>>('native_music_request', { action, sessionId, subscriptionId,
      ...(value !== undefined ? { value } : {}),
      ...(companionCapture?{companionCapture:true}:{}),
      ...(sourceAudioDelay?{sourceAudioDelay:true}:{}),
      ...(configuration?{configuration}:{}),
      ...(action === 'dock.beat.sync.start' ? { nativeAudio: !companionCapture } : {}) });
    if (response.ok === true && starting && audioOwner === starting) audio.activate(starting.sessionId, starting.subscriptionId);
    if(response.ok===true&&action==='dock.beat.sync.stop'&&companionOwner&&companionOwner.sessionId===sessionId&&companionOwner.subscriptionId===subscriptionId)companionOwner=undefined;
    if(response.ok===true&&action==='dock.beat.sync.stop'&&sessionId&&subscriptionId)sourceLeases.delete(ownerKey(sessionId,subscriptionId));
    return response;
  } finally { release?.(); }
}
export async function prepareNativeSourceAudioDelay(sessionId:string){
  if(!nativeSourceAudioDelayEnabled())throw Error('Optional source audio delay is unavailable.');
  const response=await requestNativeMusic('companion.status');
  const companions=response.companions as {peerId:string;version:string;verified:boolean}[]|undefined;
  if(!companions?.some(peer=>peer.peerId===sessionId.split(':')[0]&&peer.verified&&peer.version==='0.3.29'))throw Error('This source needs the separate Companion 0.3.29 release candidate. Your installed extensions have not been changed.');
  if([...sourceIntents].some(([key,intent])=>key!==sourceKey(sessionId)&&intent.enabled))throw Error('Stop the previous source audio route before preparing another.');
  sourceIntents.set(sourceKey(sessionId),{epoch:++sourceIntentEpoch,enabled:true});
}
// A Companion that has disconnected (browser closed or extension reloaded) has already ended its capture,
// and Chrome restored the tab's own sound, so its route counts as OFF.
async function companionConnected(sessionId:string){
  const response=await requestNativeMusic('companion.status').catch(()=>undefined);
  const companions=response?.companions as {peerId:string}[]|undefined;
  return !companions||companions.some(peer=>peer.peerId===sessionId.split(':')[0]);
}
export async function stopNativeSourceAudioDelay(sessionId:string){
  sourceIntents.set(sourceKey(sessionId),{epoch:++sourceIntentEpoch,enabled:false});
  for(const key of sourceSubscriptions.keys())if(sourceKey(JSON.parse(key)[0])===sourceKey(sessionId))retiredCompanionSubscriptions.add(key);
  return enqueueSourceTask(async()=>{
    for(const owner of [...sourceLeases.values()].filter(owner=>sourceKey(owner.sessionId)===sourceKey(sessionId))){
      const result=await performNativeMusicRequest('dock.beat.sync.stop',owner.sessionId,owner.subscriptionId,undefined,undefined,true)
        .catch(async error=>await companionConnected(owner.sessionId)?Promise.reject(error):{ok:true});
      if(result.ok!==true)throw Error('Stopping the source audio route was not acknowledged.');
      sourceLeases.delete(ownerKey(owner.sessionId,owner.subscriptionId));
    }
  });
}
export function subscribeNativeMusic(receive: (value: unknown) => void) {
  receivers.add(receive);
  void ensureFeed().catch(() => {});
  return () => { receivers.delete(receive); };
}
export interface CompanionSetupResult {
  version: string;
  folder: string;
  status: 'ready' | 'reload-required' | 'install-required';
  browsersReady: number;
  folderOpened: boolean;
}
export const openNativeMusicSetup = () => invoke<CompanionSetupResult>('native_music_setup');
