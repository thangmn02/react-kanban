import test from 'node:test';
import assert from 'node:assert/strict';
import {compareBeatIdentity} from './beat-v2-identity.mjs';
const baseline={architecture:'ADTOF-frame-rnn',verifiedCheckpointIdentity:'published-checkpoint-A',
 preprocessingSha256:'features',postprocessingSha256:'peaks',pipelineSha256:'direct',weightProvenance:'pinned upstream'};
test('a new inference format cannot create semantic novelty',()=>{
 const converted={...baseline,containerSha256:'different-onnx-file',format:'ONNX'};
 assert.deepEqual(compareBeatIdentity(converted,baseline),{kind:'DUPLICATE_EXPERIMENT',independentDetector:false,reuseSemanticEvidence:true,reason:'Same learned model and detection pipeline; reuse matching evidence.'});
});
test('a separator around the same detector is a pipeline change',()=>{
 const result=compareBeatIdentity({...baseline,pipelineSha256:'separator-plus-direct'},baseline);
 assert.equal(result.kind,'PIPELINE_DELTA');assert.equal(result.independentDetector,false);assert.equal(result.reuseSemanticEvidence,false);
});
test('different bytes alone do not establish different weights',()=>{
 const result=compareBeatIdentity({architecture:baseline.architecture,containerSha256:'new-file'},baseline);
 assert.equal(result.kind,'UNRESOLVED_WEIGHT_EQUIVALENCE');assert.equal(result.independentDetector,false);
});
test('documented different detection architecture qualifies for a separate evaluation',()=>{
 assert.equal(compareBeatIdentity({architecture:'autoregressive-transformer',weightProvenance:'pinned safe checkpoint'},baseline).kind,'DISTINCT_ARCHITECTURE');
});
