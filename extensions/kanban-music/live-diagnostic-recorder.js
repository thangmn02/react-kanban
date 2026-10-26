const limits=Object.freeze({frames:4000,batches:900,emissions:2048,issues:256,cnnFrames:4000,cnnBatches:4000,cnnEvents:2048});
const clone=value=>JSON.parse(JSON.stringify(value));
export function cnnFrameCoverage(frames,start,end){
  const hop=256/22050,epsilon=1e-7;
  const selected=frames.filter(frame=>frame.audioTime>=start&&frame.audioTime<end);
  const origins=[...new Set(selected.map(frame=>frame.segmentOrigin))];
  const origin=origins[0],validOrigin=origins.length===1&&Number.isFinite(origin)&&origin<=start;
  const first=validOrigin?Math.max(0,Math.ceil((start-origin)/hop-epsilon)):null;
  const last=validOrigin?Math.ceil((end-origin)/hop-epsilon)-1:null;
  const expected=first===null||last===null?null:Math.max(0,last-first+1);
  const indexes=selected.map(frame=>frame.frame),unique=new Set(indexes);
  const aligned=selected.every(frame=>Number.isSafeInteger(frame.frame)&&Math.abs(frame.audioTime-(frame.segmentOrigin+frame.frame*hop))<epsilon);
  const contiguous=indexes.every((frame,i)=>i===0||frame===indexes[i-1]+1);
  const complete=Boolean(validOrigin&&aligned&&contiguous&&indexes.length===expected&&indexes[0]===first&&indexes.at(-1)===last);
  return {complete,selectedFrames:selected.length,expectedFirstFrame:first,expectedLastFrame:last,expectedFrames:expected,
    origin:validOrigin?origin:null,segmentCount:origins.length,duplicates:indexes.length-unique.size,aligned,contiguous,
    contextPolicy:'Output target frames inside declared interval, hop256/22050; startup before interval and drain after it are excluded. No missing interior frame is excused.'};
}
export class LiveDiagnosticRecorder {
  constructor(meta,now=Date.now){
    this.seconds=meta.durationSeconds??30;if(![30,60,90].includes(this.seconds))throw Error('Invalid diagnostic duration');
    this.limits=Object.fromEntries(Object.entries(limits).map(([key,value])=>[key,Math.ceil(value*this.seconds/30)]));
    this.now=now;this.meta=clone(meta);this.startedAt=now()+(meta.windowLeadMs||0);this.endsAt=this.startedAt+this.seconds*1000;
    this.status='RECORDING';this.buffers=Object.fromEntries(Object.keys(limits).map(key=>[key,[]]));
    this.overflow=Object.fromEntries(Object.keys(limits).map(key=>[key,0]));
  }
  get active(){return this.status==='RECORDING';}
  append(kind,value){if(!this.active||!Object.hasOwn(limits,kind))return;
    if(this.buffers[kind].length>=this.limits[kind]){this.overflow[kind]++;return;}
    this.buffers[kind].push(clone(value));
  }
  finish(reason='window-ended'){
    if(!this.active)return;
    this.finishedAt=this.now();this.reason=reason;
    this.status=reason==='window-ended'?'FINISHED':'INTERRUPTED';
  }
  snapshot(full=true){
    const frames=this.buffers.frames,start=this.meta.audioContextStart,end=start+this.seconds;
    const selected=frames.filter(frame=>frame.audioTime>=start&&frame.audioTime<end);
    const gaps=selected.slice(1).filter((frame,i)=>frame.audioTime-selected[i].audioTime>.015).length;
    const coverage=selected.length>0&&selected[0].audioTime<=start+.02&&selected.at(-1).audioTime>=end-.02&&gaps===0;
    const cnnRange=cnnFrameCoverage(this.buffers.cnnFrames,start,end);
    const cnnRequired=['H-SHADOW','H-LIVE'].includes(this.meta.hybridMode);
    const cnnCoverage=!cnnRequired||Boolean(this.cnnWorkerStart)&&cnnRange.complete;
    const complete=this.status==='FINISHED'&&Boolean(this.workerStart)&&coverage&&cnnCoverage&&!Object.values(this.overflow).some(Boolean);
    return clone({version:1,id:this.meta.recordingId,meta:this.meta,status:this.status,reason:this.reason,
      startedAt:this.startedAt,endsAt:this.endsAt,finishedAt:this.finishedAt,complete,
      completeness:{workerAcknowledged:Boolean(this.workerStart),rawFrameCoverage:coverage,scoreGaps:gaps,
        cnnRequired,cnnFrameCoverage:cnnCoverage,cnnSelectedFrames:cnnRange.selectedFrames,cnnExpectedRange:cnnRange,
        selectedFrames:selected.length,firstAudioTime:selected[0]?.audioTime,lastAudioTime:selected.at(-1)?.audioTime},
      limits:this.limits,overflow:this.overflow,counts:Object.fromEntries(Object.entries(this.buffers).map(([key,rows])=>[key,rows.length])),
      ...(full?{workerStart:this.workerStart,cnnWorkerStart:this.cnnWorkerStart,...this.buffers}:{}),audioStored:false});
  }
}
