export const PRECISION_VERSION='spectral-evidence-v1';
export const QUALIFIED_PRECISION_RULES=Object.freeze([]);
export const PRECISION_RULES=Object.freeze(['fixed-activity','adaptive-activity','spectral-onset','class-calibration']);
const keys=['captureId','sourceId','sourceGeneration','synchronizationEpoch'];
export function precisionConfiguration(value={mode:'off'}) {
  if(!value||!['off','shadow','enabled'].includes(value.mode))throw new TypeError('Invalid semanticPrecisionGuards mode');
  const rules=value.rules??['fixed-activity'];
  if(!Array.isArray(rules)||new Set(rules).size!==rules.length||rules.some(rule=>!PRECISION_RULES.includes(rule)))throw new TypeError('Invalid precision rule');
  if(value.mode==='enabled'&&(!rules.length||rules.some(rule=>!QUALIFIED_PRECISION_RULES.includes(rule))))throw new Error('INSUFFICIENT_EVIDENCE: guard rule is not qualified');
  const result={mode:value.mode,rules:[...rules],floorRms:value.floorRms??1e-6,adaptiveRatio:value.adaptiveRatio??.05,
    onsetFlux:value.onsetFlux??1e-4,minimumContrast:value.minimumContrast??1.1,minimumScores:value.minimumScores??[0,0,0]};
  for(const key of ['floorRms','adaptiveRatio','onsetFlux','minimumContrast'])if(!Number.isFinite(result[key])||result[key]<0)throw new RangeError('Invalid guard threshold');
  if(!Array.isArray(result.minimumScores)||result.minimumScores.length!==3||result.minimumScores.some(n=>!Number.isFinite(n)||n<0||n>1))throw new RangeError('Invalid class calibration');
  return result;
}

// Measures the existing raw-PCM FFT, never its normalized model input. No extra FFT.
export class PercussionEvidence {
  constructor(sampleRate,size) {
    this.sampleRate=sampleRate;this.size=size;this.previous=new Float64Array(size/2);this.background=0;this.history=[0,0,0,0];
    this.bands=[[30,180],[180,4000],[4000,8000],[8000,Math.min(20000,sampleRate/2)]];
  }
  measure(samples,magnitude,received,time) {
    let square=0,peak=0,invalid=0,clipped=0;
    for(const value of samples){if(!Number.isFinite(value)){invalid++;continue;}square+=value*value;peak=Math.max(peak,Math.abs(value));if(Math.abs(value)>=.999)clipped++;}
    const energy=[],flux=[],contrast=[],flatness=[];
    for(let band=0;band<this.bands.length;band++) {
      const [low,high]=this.bands[band];let power=0,positive=0,log=0,count=0;
      for(let i=Math.ceil(low*this.size/this.sampleRate);i<Math.min(magnitude.length,Math.ceil(high*this.size/this.sampleRate));i++) {
        const amplitude=magnitude[i]/this.size,p=amplitude*amplitude;power+=p;positive+=Math.max(0,amplitude-this.previous[i]);log+=Math.log(Math.max(p,1e-30));count++;
      }
      const rms=Math.sqrt(2*power);energy.push(rms);flux.push(positive);contrast.push(rms/Math.max(this.history[band],1e-10));
      flatness.push(count&&power>0?Math.exp(log/count)/(power/count):0);this.history[band]=.98*this.history[band]+.02*rms;
    }
    for(let i=0;i<magnitude.length;i++)this.previous[i]=magnitude[i]/this.size;
    const rms=Math.sqrt(square/samples.length),backgroundRms=this.background;this.background=.99*this.background+.01*rms;
    return {version:PRECISION_VERSION,audioTime:time,windowStart:time-this.size/2/this.sampleRate,windowEnd:time+this.size/2/this.sampleRate,
      availableAudioTime:time+this.size/2/this.sampleRate,complete:received>=this.size,valid:invalid===0&&energy.concat(flux,contrast,flatness).every(Number.isFinite),
      sampleRate:this.sampleRate,rms,peak,clippedFraction:clipped/samples.length,backgroundRms,energy,flux,contrast,flatness,bands:this.bands};
  }
}

export class PrecisionEvidenceRing {
  constructor(ownership,{capacity=256,hopSeconds=.01}={}) {
    if(!Number.isInteger(capacity)||capacity<16||capacity>4096||!Number.isFinite(hopSeconds)||hopSeconds<=0)throw new RangeError('Invalid evidence ring');
    this.ownership=ownership;this.capacity=capacity;this.hopSeconds=hopSeconds;this.entries=new Map();this.last=-Infinity;
  }
  owns(ownership){return !this.ownership||keys.every(key=>ownership?.[key]===this.ownership[key]);}
  clear(){this.entries.clear();this.last=-Infinity;}
  add(rows,ownership){
    if(!this.owns(ownership))return false;
    if(rows!=null&&!Array.isArray(rows))return false;
    for(const row of rows||[]){
      if(!Number.isFinite(row?.audioTime))continue;
      if(row.audioTime<this.last-this.hopSeconds/4||row.audioTime-this.last>this.hopSeconds*1.5)this.clear();
      this.last=row.audioTime;this.entries.set(Math.round(row.audioTime/this.hopSeconds),row);
      while(this.entries.size>this.capacity)this.entries.delete(this.entries.keys().next().value);
    }
    return true;
  }
  lookup(audioTime,ownership){
    if(!this.owns(ownership)||!Number.isFinite(audioTime))return;
    const row=this.entries.get(Math.round(audioTime/this.hopSeconds));
    return row&&Math.abs(row.audioTime-audioTime)<=1e-6?row:undefined;
  }
}

export function precisionDecision(event,evidence,configuration) {
  const config=precisionConfiguration(configuration);
  if(config.mode==='off')return {mode:'off',wouldAccept:true,accept:true,reasons:[]};
  const reasons=[];
  if(!evidence?.complete||!evidence.valid)return {mode:config.mode,accept:true,wouldAccept:null,reasons:[!evidence?'missing-aligned-evidence':!evidence.complete?'partial-window':'invalid-evidence']};
  if(![evidence.rms,evidence.backgroundRms].every(n=>Number.isFinite(n)&&n>=0)||
    ![evidence.flux,evidence.contrast].every(values=>Array.isArray(values)&&values.length===4&&values.every(n=>Number.isFinite(n)&&n>=0))||
    !['kick','clap','hat'].includes(event.band)||!Number.isFinite(event.confidence))
    return {mode:config.mode,accept:true,wouldAccept:null,reasons:['invalid-evidence']};
  for(const rule of config.rules) {
    if(rule==='fixed-activity'&&evidence.rms<config.floorRms)reasons.push(rule);
    if(rule==='adaptive-activity'&&evidence.rms<Math.max(config.floorRms,evidence.backgroundRms*config.adaptiveRatio))reasons.push(rule);
    const bands=event.band==='kick'?[0]:event.band==='clap'?[1]:[2,3];
    if(rule==='spectral-onset'&&!bands.some(i=>evidence.flux[i]>=config.onsetFlux&&evidence.contrast[i]>=config.minimumContrast))reasons.push(rule);
    const index={kick:0,clap:1,hat:2}[event.band];
    if(rule==='class-calibration'&&event.confidence<config.minimumScores[index])reasons.push(rule);
  }
  return {mode:config.mode,wouldAccept:reasons.length===0,accept:config.mode==='shadow'||!reasons.length,reasons};
}
