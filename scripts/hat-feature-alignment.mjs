import assert from 'node:assert/strict';
export function alignHatFeatures(reference,captured,coarse,start,end){
 const selected=captured.filter((f,i)=>i%3===0&&f.time+coarse>=start&&f.time+coarse<end);
 assert(selected.length>50,'Insufficient captured feature anchors');
 const cost=(offset,frames)=>{let error=0,n=0,power=0;
  for(const f of frames){const t=(f.time+offset-reference[0].time)*100,j=Math.floor(t),mix=t-j;
   if(j<0||j+1>=reference.length)continue;
   for(let k=0;k<84;k+=2){const expected=reference[j].data[k]*(1-mix)+reference[j+1].data[k]*mix;
    error+=(f.data[k]-expected)**2;power+=expected**2;n++;}}
  return {mse:error/n,normalizedRmse:Math.sqrt(error/Math.max(power,1e-9))};};
 const candidates=[];for(let step=-120;step<=40;step++){const offset=coarse+step*.0025;candidates.push({offset,...cost(offset,selected)});}
 candidates.sort((a,b)=>a.mse-b.mse);const best=candidates[0];
 assert(best.offset>coarse-.299&&best.offset<coarse+.099,'Feature fit reached search boundary');
 const halves=[selected.slice(0,selected.length/2),selected.slice(selected.length/2)].map(frames=>
  candidates.map(c=>({offset:c.offset,...cost(c.offset,frames)})).sort((a,b)=>a.mse-b.mse)[0]);
 const alternative=candidates.find(c=>Math.abs(c.offset-best.offset)>=.025);
 const contrast=alternative.mse/Math.max(best.mse,1e-12);
 assert(best.normalizedRmse<=.2,'Source/capture feature mismatch exceeds 20% normalized RMSE');
 assert(Math.abs(halves[0].offset-halves[1].offset)<=.005001,'Source/capture offset is unstable across passage halves');
 assert(contrast>=1.2,'Source/capture feature alignment is locally ambiguous');
 return {...best,coarseOffset:coarse,gridResolutionMs:2.5,halfFits:halves,alternativeContrast:contrast,
  qualityLimits:{maxNormalizedRmse:.2,maxHalfFitDifferenceMs:5,minAlternativeContrast:1.2},
  method:'Source/capture log-filterbank MSE fit; interpolation; no prediction timestamp is rewritten.'};
}
