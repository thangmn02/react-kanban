// Reuse production extraction/classification instead of reimplementing them.
import {readFileSync} from 'node:fs';
import {PercussionFeatures} from '../extensions/kanban-music/percussion-features.js';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
const input=readFileSync(0);
const resources=()=>{const cpu=process.cpuUsage();return {cpuSeconds:(cpu.user+cpu.system)/1e6,residentBytes:process.memoryUsage().rss};};
if(process.argv[2]==='features'){
 const config=JSON.parse(readFileSync('extensions/kanban-music/generated/percussion/percussion.json','utf8'));
 const pcm=new Float32Array(input.buffer.slice(input.byteOffset,input.byteOffset+input.length));
 const extractor=new PercussionFeatures(config),frames=[];const began=performance.now();
 for(let offset=0;offset<pcm.length/2;offset+=128){
  const length=Math.min(128,pcm.length/2-offset),left=new Float32Array(length),right=new Float32Array(length);
  for(let i=0;i<length;i++){left[i]=pcm[(offset+i)*2];right[i]=pcm[(offset+i)*2+1];}
  extractor.push([left,right],offset/config.sampleRate,b=>b.times.forEach((time,i)=>frames.push({time,data:Array.from(b.data.slice(i*config.bins,(i+1)*config.bins))})));
 }
 process.stdout.write(JSON.stringify({featureMs:performance.now()-began,frames,resources:resources()}));
}else if(process.argv[2]==='classify'){
 const activations=JSON.parse(input.toString()),classifier=new PercussionClassifier(undefined,{onsetGuided:true});
 const events=activations.flatMap(f=>classifier.push(f.scores,f.audioTime).events);
 process.stdout.write(JSON.stringify({events,resources:resources()}));
}else throw Error('Expected features or classify');
