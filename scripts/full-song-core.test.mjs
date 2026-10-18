import test from 'node:test';
import assert from 'node:assert/strict';
import {eventsBetween,boundedLanes,feedbackPayload,frameCoverage} from './full-song-core.ts';
const prediction=(time,instrument='hat')=>({id:String(time)+instrument,sourceTime:time,instrument});
test('source-time cursor partitions retain exact boundary events once',()=>{
 const events=[prediction(0),prediction(.02),prediction(.03),prediction(10),prediction(179.999)];
 const first=eventsBetween(events,-1e-8,.02),second=eventsBetween(events,.02,10),tail=eventsBetween(events,10,180);
 assert.deepEqual([...first,...second,...tail],events);assert.equal(new Set([...first,...second,...tail].map(e=>e.id)).size,5);
});
test('full-song lanes bound DOM nodes without silently changing event records',()=>{
 const events=Array.from({length:20000},(_,i)=>prediction(i*.01));const lanes=boundedLanes(events,0,200);
 assert.equal(lanes[2].events.length,160);assert.equal(lanes[2].total,20000);assert.equal(events.length,20000);
 assert.equal(boundedLanes(events,100,100.1)[2].events.length,11);
});
test('renderer choice never changes saved onset identity, class or timestamp',()=>{
 const events=[prediction(1),prediction(1.02,'snare'),prediction(1.03,'grouped-percussion')];
 const delivered=()=>eventsBetween(events,0,2).map(({id,sourceTime,instrument})=>({id,sourceTime,instrument}));assert.deepEqual(delivered('original'),delivered('short'));
});
test('quick observations remain source-bound qualitative feedback',()=>{
 const note=feedbackPayload('source',47.1,'C','short','Missed Hi-Hat','uncertain overlap');assert.equal(note.provenance,'model-exposed-qualitative-feedback');assert.equal(note.sourceSha256,'source');assert.equal(note.sourceTime,47.1);assert.equal(note.model,'C');assert(!('events' in note));assert(!('frozen' in note));
});
test('uncomputed raw-frame tails and interior gaps are explicit unavailable coverage',()=>{
 assert.equal(frameCoverage([0,.01,.02],.01,.03).completeRawCoverage,true);
 assert.deepEqual(frameCoverage([0,.01],.01,.05).uncoveredIntervals.map(i=>[i.start,i.end]),[[.02,.05]]);
 assert.deepEqual(frameCoverage([0,.03,.04],.01,.05).uncoveredIntervals.map(i=>[i.start,i.end]),[[.01,.03]]);
});
