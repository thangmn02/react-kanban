import {BeatDetector} from './beat-detector.js';
import {BassSourceStream} from '../../scripts/bass-recovery-core.mjs';
export const BASS_SOURCE_VERSION='bass-source-clock-v1';
export class BassSourceProcessor {
  constructor(ownership,sampleRate,{windowStartSample,windowEndSample}={}){
    if(windowStartSample!==undefined&&(!Number.isSafeInteger(windowStartSample)||windowStartSample<0)
      ||windowEndSample!==undefined&&(!Number.isSafeInteger(windowEndSample)||windowEndSample<=windowStartSample))throw Error('Invalid Bass analysis window');
    this.owner=ownership;this.rate=sampleRate;this.sequence=0;this.origin=windowStartSample;this.windowStartDeclared=windowStartSample!==undefined;this.windowEnd=windowEndSample;this.end=undefined;
    this.stream=new BassSourceStream(new BeatDetector(sampleRate),{sourceClock:{fftSize:2048,hopSamplesAt44100:735},candidates:[]},sampleRate);
  }
  push(packet){
    const keys=['captureId','sourceId','sourceGeneration','synchronizationEpoch'];
    if(!keys.every(key=>packet.ownership?.[key]===this.owner[key]))return {kind:'stale',ownership:this.owner};
    const excludedStartupGap=this.windowStartDeclared&&this.stream.received===0&&this.end!==undefined
      &&this.end<=this.origin&&packet.sourceStartSample<=this.origin;
    if(packet.sampleRate!==this.rate||!(packet.mono instanceof Float32Array)||packet.mono.length<1
      ||!Number.isSafeInteger(packet.sourceStartSample)||packet.sourceStartSample<0
      ||packet.sourceEndSample!==packet.sourceStartSample+packet.mono.length
      ||packet.sequence!==this.sequence+1||this.end!==undefined&&packet.sourceStartSample!==this.end&&!excludedStartupGap)throw Error('Noncontiguous Bass PCM '+JSON.stringify({
        sequence:packet.sequence,expectedSequence:this.sequence+1,start:packet.sourceStartSample,end:packet.sourceEndSample,expectedStart:this.end,
        rate:packet.sampleRate,expectedRate:this.rate,samples:packet.mono?.length,windowStart:this.origin,analyzedSamples:this.stream.received}));
    const discontinuity=this.end!==undefined&&packet.sourceStartSample!==this.end?{previousEndSample:this.end,nextStartSample:packet.sourceStartSample,
      excludedBeforeDeclaredWindow:excludedStartupGap,windowStartSample:this.origin}:undefined;
    this.origin??=packet.sourceStartSample;this.end=packet.sourceEndSample;this.sequence=packet.sequence;
    const frames=[],from=Math.max(0,this.origin-packet.sourceStartSample),to=Math.min(packet.mono.length,(this.windowEnd??packet.sourceEndSample)-packet.sourceStartSample);
    if(to>from)this.stream.push(packet.mono.subarray(from,to),packet.sourceStartSample+from-this.origin,frame=>frames.push({
      frame:frame.frame,endpointSample:this.origin+frame.endpointSample,audioTime:(this.origin+frame.endpointSample)/this.rate,
      events:frame.events.map(()=>({band:'bass',audioTime:(this.origin+frame.endpointSample)/this.rate,
        sourceFrame:this.origin+frame.endpointSample,version:BASS_SOURCE_VERSION})),evidence:frame.evidence}));
    return {kind:'result',ownership:this.owner,version:BASS_SOURCE_VERSION,sequence:this.sequence,sourceStartSample:packet.sourceStartSample,
      sourceEndSample:this.end,discontinuity,frames};
  }
}
