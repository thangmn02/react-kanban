// Container hashes and providers are intentionally not semantic novelty keys.
export function compareBeatIdentity(candidate,previous){
 const equal=(key)=>candidate[key]&&candidate[key]===previous[key];
 const sameWeights=equal('learnedTensorSha256')||equal('checkpointSha256')||equal('verifiedCheckpointIdentity');
 if(sameWeights){
  const unchanged=['preprocessingSha256','postprocessingSha256','pipelineSha256'].every(equal);
  return {kind:unchanged?'DUPLICATE_EXPERIMENT':'PIPELINE_DELTA',independentDetector:false,
   reuseSemanticEvidence:!!unchanged,reason:unchanged?'Same learned model and detection pipeline; reuse matching evidence.':'Same learned weights; evaluate changed pipeline stages without claiming a new semantic detector.'};
 }
 if(equal('architecture')&&(!candidate.weightProvenance||!previous.weightProvenance))return {
  kind:'UNRESOLVED_WEIGHT_EQUIVALENCE',independentDetector:false,reuseSemanticEvidence:false,
  reason:'Different container hashes do not prove different learned weights; provenance/equivalence is unresolved.'};
 if(candidate.architecture&&previous.architecture&&candidate.architecture!==previous.architecture&&candidate.weightProvenance)return {
  kind:'DISTINCT_ARCHITECTURE',independentDetector:true,reuseSemanticEvidence:false,
  reason:'Documented architecture and checkpoint provenance differ; inference format is irrelevant.'};
 return {kind:'UNRESOLVED_WEIGHT_EQUIVALENCE',independentDetector:false,reuseSemanticEvidence:false,
  reason:'Insufficient learned-weight/architecture evidence to establish semantic novelty.'};
}
