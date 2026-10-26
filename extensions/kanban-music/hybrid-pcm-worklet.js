class HybridPcmProcessor extends AudioWorkletProcessor {
  constructor(options){super();this.owner=options.processorOptions.ownership;this.sequence=0;this.buffer=new Float32Array(256);this.used=0;this.quantum=0;this.diagnostics=false;
    this.port.onmessage=({data})=>{if(data.kind==='diagnostic-capture'&&['captureId','sourceId','sourceGeneration','synchronizationEpoch'].every(key=>data.ownership?.[key]===this.owner[key]))this.diagnostics=data.enabled===true;};
  }
  emit(){
    const mono=this.used===this.buffer.length?this.buffer:this.buffer.slice(0,this.used);
    this.port.postMessage({kind:'pcm',mono,ownership:this.owner,sequence:++this.sequence,
      sourceStartSample:this.start,sourceEndSample:this.start+this.used,sampleRate,
      availableAudioTime:(this.start+this.used)/sampleRate,postedAtEpochMs:Date.now(),
      quantum:this.quantum,channelCount:1,inputChannelCount:this.bufferChannels,clockDomain:'audio-context-sample'},[mono.buffer]);
    this.buffer=new Float32Array(256);this.used=0;
  }
  process(inputs,outputs){
    const channels=inputs[0];this.quantum++;
    const length=channels?.[0]?.length??0,outputLength=outputs?.[0]?.[0]?.length;
    const expected=this.previousQuantumEnd;
    // Some capture callbacks repeat the preceding quantum's clock while supplying
    // fresh samples. Keep the input-sample cursor for that single known alias;
    // all other range jumps remain explicit discontinuities, never zero-filled.
    const repeated=length>0&&currentFrame===this.previousRawStart&&expected-currentFrame===length;
    const sourceStart=repeated?expected:currentFrame;
    if(!length||expected!==undefined&&currentFrame!==expected||this.used&&this.start+this.used!==currentFrame){
      this.port.postMessage({kind:'input-discontinuity',ownership:this.owner,quantum:this.quantum,
        audioContextTime:currentFrame/sampleRate,sourceStartSample:currentFrame,
        previousQuantumEnd:expected??null,inputLength:length,outputLength:outputLength??null,
        effectiveStartSample:sourceStart,clockCorrection:repeated?'single-repeated-quantum':null,
        channelCount:channels?.length??0,pendingStartSample:this.used?this.start:null,pendingSamples:this.used,
        ...(this.diagnostics?{inputPcm:channels?.length?Array.from({length},(_,i)=>Math.fround(channels.reduce((sum,channel)=>Math.fround(sum+channel[i]),0)/channels.length)):[],
          pendingPcm:Array.from(this.buffer.subarray(0,this.used))}:{}),
        reason:!length?'no-input-channels':repeated?'repeated-quantum-clock':expected!==undefined&&currentFrame!==expected?'render-quantum-clock-gap':'partial-buffer-range-mismatch',
        postedAtEpochMs:Date.now()});
    }
    this.previousRawStart=currentFrame;
    this.previousQuantumEnd=sourceStart+(outputLength??length);
    if(!channels?.length)return true;
    if(this.used&&this.start+this.used!==sourceStart)this.emit();
    for(let i=0;i<channels[0].length;i++){
      if(this.used===0){this.start=sourceStart+i;this.bufferChannels=channels.length;}
      let sum=0;for(const channel of channels)sum=Math.fround(sum+channel[i]);
      this.buffer[this.used++]=Math.fround(sum/channels.length);
      if(this.used===this.buffer.length){
        this.emit();
      }
    }
    return true;
  }
}
registerProcessor('kora-hybrid-pcm',HybridPcmProcessor);
