import {expect,it} from 'vitest';
import {classifyPresentation,type PresentationObservation} from './beat-presentation-outcome';
const event:PresentationObservation={semanticEventId:'bass-final',deadline:1000,admittedAt:999,committedAt:1001,expiresAt:1151,frameOpportunities:[1008,1024,1040]};
it('separates observed frames from animation callbacks and admission timing',()=>{
 expect(classifyPresentation({...event,observedFrameAt:1008})).toEqual({outcome:'FRAME_OBSERVED',onTime:true,physicalVerified:false});
 expect(classifyPresentation({...event,animationStartedAt:1005})).toMatchObject({outcome:'ANIMATION_STARTED'});
 expect(classifyPresentation({...event,admittedAt:1002,observedFrameAt:1008}).onTime).toBe(false);
});
it('classifies a final-frame event only when no later display opportunity preceded source end',()=>{
 expect(classifyPresentation({...event,committedAt:1040,frameOpportunities:[1040,1056],boundary:{kind:'source-end',at:1049}}).outcome).toBe('ELIGIBLE_TRUNCATED_AT_SOURCE_END');
 expect(classifyPresentation({...event,committedAt:1040,frameOpportunities:[1040,1048],boundary:{kind:'source-end',at:1049}}).outcome).toBe('UNEXPLAINED_PRESENTATION_LOSS');
});
it('does not hide an ordinary missing animation behind a much later source boundary',()=>{
 expect(classifyPresentation({...event,boundary:{kind:'source-end',at:2000}}).outcome).toBe('UNEXPLAINED_PRESENTATION_LOSS');
});
it.each(['pause','seek','source-switch','capture-reset','worker-cancel'] as const)('records explicit %s cancellation without inventing a flash',kind=>{
 expect(classifyPresentation({...event,committedAt:undefined,explicitCancellation:true,boundary:{kind,at:1002}}).outcome).toBe('CANCELLED_BEFORE_PRESENTATION');
 expect(classifyPresentation({...event,explicitCancellation:true,boundary:{kind,at:1002}}).outcome).toBe('CANCELLED_BEFORE_PRESENTATION');
});
it('keeps simultaneous rows independent at completion and never mutates event identity or timing',()=>{
 const copy=structuredClone(event);
 const values=['kick','snare','hat','bass','lead'].map(row=>classifyPresentation({...event,semanticEventId:row,committedAt:1040,frameOpportunities:[1056],boundary:{kind:'source-end',at:1049}}));
 expect(values.every(v=>v.outcome==='ELIGIBLE_TRUNCATED_AT_SOURCE_END')).toBe(true);expect(event).toEqual(copy);
});
it('never credits observations made after the source boundary or after expiry',()=>{
 expect(classifyPresentation({...event,observedFrameAt:1060,animationStartedAt:1060,committedAt:1040,frameOpportunities:[1056],boundary:{kind:'source-end',at:1049}}).outcome).toBe('ELIGIBLE_TRUNCATED_AT_SOURCE_END');
 expect(classifyPresentation({...event,observedFrameAt:1200}).outcome).toBe('UNEXPLAINED_PRESENTATION_LOSS');
 expect(classifyPresentation({...event,animationStartedAt:1200}).outcome).toBe('UNEXPLAINED_PRESENTATION_LOSS');
});
