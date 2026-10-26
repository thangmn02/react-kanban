import {BassSourceProcessor} from './bass-source-core.js';
let processor;
self.onmessage=({data})=>{
  try{
    if(data.kind==='init'){processor=new BassSourceProcessor(data.ownership,data.sampleRate,data);self.postMessage({kind:'ready',ownership:data.ownership});return;}
    if(data.kind!=='pcm'||!processor)return;
    const started=performance.timeOrigin+performance.now(),result=processor.push(data);
    self.postMessage({...result,workerReceivedAt:started,workerFinishedAt:performance.timeOrigin+performance.now()});
  }catch(error){self.postMessage({kind:'failed',reason:error.message,ownership:processor?.owner});}
};
