// Replay the frozen classifier with additional decision reporting only.
import {readFileSync} from 'node:fs';
import {PercussionClassifier} from '../extensions/kanban-music/percussion-classifier.js';
const {times,scores,start,end}=JSON.parse(readFileSync(0,'utf8'));
const classifier=new PercussionClassifier(undefined,{onsetGuided:true,diagnostics:true}),events=[],decisions=[];
for(let i=0;i<times.length;i++){
 const result=classifier.push(scores[i],times[i]);events.push(...result.events);
 if(times[i]>=start-.2&&times[i]<end+.2)decisions.push(...result.decisions.filter(d=>[0,1,3,4].includes(d.classIndex)));
}
process.stdout.write(JSON.stringify({events,decisions,thresholds:classifier.thresholds}));
