import {BeatDetector} from '../../../extensions/kanban-music/beat-detector.js';
import type {BeatEvent,MusicClock} from './mediaBridge';
import {beatTelemetry} from '../../../extensions/kanban-music/beat-telemetry.js';
const telemetry=beatTelemetry.at('owned-local-audio');
/** One owned media element, one audible WebAudio path, unchanged browser Bass detector. */
export function createLocalAudioTransport(audio:HTMLAudioElement){
 const listeners=new Set<(event:BeatEvent)=>void>();let generation=0,sequence=0,active=false,context:AudioContext|undefined,analyser:AnalyserNode|undefined,source:MediaElementAudioSourceNode|undefined,detector:BeatDetector|undefined;
 let spectrum:Float32Array<ArrayBuffer>|undefined,timer:ReturnType<typeof setInterval>|undefined;
 const emit=(event:BeatEvent)=>listeners.forEach(receive=>receive(event));
 const clock=():MusicClock=>({currentTime:audio.currentTime,sampledAt:Date.now(),playbackRate:audio.playbackRate||1,playing:!audio.paused&&!audio.ended,paused:audio.paused,buffering:audio.readyState<3,seeking:audio.seeking,generation});
 const owner=()=>`owned-local:${generation}`;
 const sample=()=>{
  if(!active)return;const c=clock();emit({kind:'clock',clock:c});
  emit({kind:'sync.state',mode:c.playing?'capture':'clock',captureId:owner(),reason:c.playing?'owned-local':'not-playing'});
  if(!c.playing||c.seeking||c.buffering||!analyser||!spectrum||!detector)return;
  analyser.getFloatFrequencyData(spectrum);const result=detector.analyze(spectrum,performance.now());
  if(result.hits.includes('bass')){const traces=telemetry.events('onset',['bass'],{captureId:owner(),origin:'local-detector',confidence:null})?.map(t=>({...t,targetPlaybackTime:c.currentTime,eventSource:'local' as const}));telemetry.mark('EVENT_DETECTED',traces);
   emit({kind:'onset',bands:['bass'],captureId:owner(),sequence:++sequence,targetPlaybackTime:c.currentTime,playbackClock:c,telemetry:traces,eventSource:'local'});}
 };
 const reset=()=>{generation++;sequence=0;if(context)detector=new BeatDetector(context.sampleRate,2048);sample();};
 const lifecycle=['pause','play','seeking','seeked','emptied','loadedmetadata','ended','waiting','playing','ratechange'];lifecycle.forEach(name=>audio.addEventListener(name,reset));
 return {
  subscribe(receive:(event:BeatEvent)=>void){listeners.add(receive);return()=>{listeners.delete(receive);};},
  async start(){if(active)return;active=true;sample();timer=setInterval(sample,16);},
  async stop(){if(listeners.size)return;active=false;clearInterval(timer);},
  async audible(){
   if(!context){context=new AudioContext();analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=0;source=context.createMediaElementSource(audio);source.connect(analyser);analyser.connect(context.destination);spectrum=new Float32Array(analyser.frequencyBinCount);detector=new BeatDetector(context.sampleRate,2048);}
   await context.resume();
  },
  diagnostics(){return {generation,audioReadyState:audio.readyState,paused:audio.paused,currentTime:audio.currentTime,audioContextState:context?.state,baseLatencySeconds:context?.baseLatency,outputLatencySeconds:context?.outputLatency,bassDetector:'Existing BeatDetector 150–400 Hz / FFT2048 / unchanged thresholds',audioDelayAdded:0};},
  dispose(){active=false;clearInterval(timer);lifecycle.forEach(name=>audio.removeEventListener(name,reset));listeners.clear();source?.disconnect();analyser?.disconnect();const closing=context;context=undefined;if(closing&&closing.state!=='closed')void closing.close();},
 };
}
