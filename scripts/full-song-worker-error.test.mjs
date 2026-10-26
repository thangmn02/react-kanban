import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparationFailureMessage} from './full-song-worker-error.mjs';
test('worker exit preserves actionable input/resource errors but not a stale status from another run',()=>{
 assert.equal(preparationFailureMessage({state:'BLOCKED',error:'17minute input exceeds12minute limit'},1),'17minute input exceeds12minute limit');
 assert.equal(preparationFailureMessage({state:'BLOCKED',error:'6GiB cap'},75),'6GiB cap');
 assert.match(preparationFailureMessage({state:'PREPARING',error:'old error'},1),/^Worker exited 1/);
 assert.equal(preparationFailureMessage({state:'BLOCKED',error:'old error'},-1,'Python could not start'),'Python could not start');
});
