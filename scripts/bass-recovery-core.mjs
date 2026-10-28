// Private research frontend and confirmations. No Kick events or beat positions are inputs.
export class ResearchSpectrum {
 constructor(size=2048){
  this.size=size;this.real=new Float64Array(size);this.imag=new Float64Array(size);this.db=new Float32Array(size/2);
  this.window=Float64Array.from({length:size},(_,n)=>.42-.5*Math.cos(2*Math.PI*n/size)+.08*Math.cos(4*Math.PI*n/size));
  this.reverse=Uint16Array.from({length:size},(_,n)=>{let out=0;for(let bits=size;bits>1;bits>>=1){out=(out<<1)|(n&1);n>>=1;}return out;});
  this.twiddles=[];for(let step=2;step<=size;step*=2)this.twiddles.push({step,
   cos:Float64Array.from({length:step/2},(_,k)=>Math.cos(-2*Math.PI*k/step)),sin:Float64Array.from({length:step/2},(_,k)=>Math.sin(-2*Math.PI*k/step))});
 }
 measure(samples){
  const {size,real,imag}=this;imag.fill(0);
  for(let n=0;n<size;n++)real[this.reverse[n]]=samples[n]*this.window[n];
  for(const {step,cos,sin} of this.twiddles)for(let base=0;base<size;base+=step)for(let k=0;k<step/2;k++){
   const a=base+k,b=a+step/2,re=cos[k]*real[b]-sin[k]*imag[b],im=cos[k]*imag[b]+sin[k]*real[b];
   real[b]=real[a]-re;imag[b]=imag[a]-im;real[a]+=re;imag[a]+=im;
  }
  for(let k=0;k<this.db.length;k++)this.db[k]=10*Math.log10(Math.max(1e-30,(real[k]*real[k]+imag[k]*imag[k])/(size*size)));
  return this.db;
 }
}

export function bassEvidence(db,rate,size=2048){
 const power=Float64Array.from(db,d=>Number.isFinite(d)?10**(Math.min(0,d)/10):0),binHz=rate/size;
 const first=Math.ceil(150/binHz),last=Math.floor(400/binHz),low=power.slice(first,last+1);
 let peak=first,fundamental=Math.ceil(50/binHz);
 for(let k=first;k<=last;k++)if(power[k]>power[peak])peak=k;
 for(let k=Math.ceil(50/binHz);k<=last;k++)if(power[k]>power[fundamental])fundamental=k;
 const around=k=>{let sum=0;for(let d=-1;d<=1;d++)sum+=power[k+d]||0;return sum;};
 return {low,lowPower:low.reduce((a,b)=>a+b,0),peak,peakHz:peak*binHz,fundamentalHz:fundamental*binHz,
  secondHarmonicRatio:around(2*fundamental)/Math.max(around(fundamental),1e-30)};
}

const cosine=(a,b)=>{let dot=0,aa=0,bb=0;for(let k=0;k<a.length;k++){dot+=a[k]*b[k];aa+=a[k]*a[k];bb+=b[k]*b[k];}return dot/Math.max(Math.sqrt(aa*bb),1e-30);};
export class BassConfirmations {
 constructor(detector,configuration,rate=44100){this.detector=detector;this.configuration=configuration;this.rate=rate;this.pending=[];this.sequence=0;}
 frame(db,sourceTime){
  const result=this.detector.analyze(db,sourceTime*1000),evidence=bassEvidence(db,this.rate),events=[],decisions=[];
  if(result.hits.includes('bass')){
   const id=`bass:${++this.sequence}:${Math.round(sourceTime*this.rate)}`;
   const event={id,sourceTime,readySourceTime:sourceTime,variant:'BASS_BASELINE',confidence:null};events.push(event);
   for(const candidate of this.configuration.candidates)this.pending.push({candidate,event,evidence});
  }
  this.pending=this.pending.filter(proposal=>{
   if((sourceTime-proposal.event.sourceTime)*1000+1e-7<proposal.candidate.lookaheadMs)return true;
   const c=proposal.candidate,ratio=evidence.lowPower/Math.max(proposal.evidence.lowPower,1e-30);
   const similarity=cosine(proposal.evidence.low,evidence.low),drift=Math.abs(evidence.peak-proposal.evidence.peak);
   const accepted=c.id==='BASS_PERSISTENCE'?ratio>=c.minimumRemainingLowBandPowerRatio&&drift<=c.maximumPeakDriftBins
    :c.id==='BASS_HARMONICS'?evidence.secondHarmonicRatio>=c.minimumSecondHarmonicPowerRatio
    :similarity>=c.minimumSpectralCosine&&ratio>=c.minimumRemainingLowBandPowerRatio;
   const decision={id:proposal.event.id,variant:c.id,sourceTime:proposal.event.sourceTime,readySourceTime:sourceTime,accepted,
    lowPowerRatio:ratio,cosine:similarity,peakDriftBins:drift,fundamentalHz:evidence.fundamentalHz,secondHarmonicRatio:evidence.secondHarmonicRatio};
   decisions.push(decision);if(accepted)events.push({...proposal.event,variant:c.id,readySourceTime:sourceTime});return false;
  });
  return {events,decisions,evidence:{peakHz:evidence.peakHz,fundamentalHz:evidence.fundamentalHz,lowPower:evidence.lowPower,secondHarmonicRatio:evidence.secondHarmonicRatio}};
 }
 finish(){const cancelled=this.pending.map(p=>({id:p.event.id,variant:p.candidate.id,sourceTime:p.event.sourceTime,accepted:false,reason:'source-ended-before-confirmation'}));this.pending=[];return cancelled;}
}

export class BassSourceStream {
 constructor(detector,configuration,rate=44100){
  this.rate=rate;this.size=configuration.sourceClock.fftSize;this.hop=Math.round(rate*configuration.sourceClock.hopSamplesAt44100/44100);
  this.ring=new Float32Array(this.size);this.window=new Float32Array(this.size);this.received=0;this.next=this.size;
  this.fft=new ResearchSpectrum(this.size);this.confirm=new BassConfirmations(detector,configuration,rate);this.frames=0;
 }
 push(samples,start,emit){
  if(start!==this.received)throw Error('Noncontiguous source PCM');
  for(let i=0;i<samples.length;i++){
   this.ring[this.received%this.size]=samples[i];this.received++;
   if(this.received<this.next)continue;
   for(let k=0;k<this.size;k++)this.window[k]=this.ring[(this.received+k)%this.size];
   const time=this.received/this.rate,result=this.confirm.frame(this.fft.measure(this.window),time);
   emit({frame:this.frames++,endpointSample:this.received,...result});this.next+=this.hop;
  }
 }
 finish(){return this.confirm.finish();}
}
