/** Note onsets from a frame-level f0 track: voicing start after >=50 ms rest, or a pitch move >= .8 st held >= 60 ms. */
export function referenceOnsets(rows,end){
  const midi=rows.map(([t,f])=>[t,f>0?69+12*Math.log2(f/440):NaN]);const hop=rows[1][0]-rows[0][0];
  const onsets=[];let current=NaN,lastVoiced=-Infinity;
  for(let i=0;i<midi.length;i++){const [t,m]=midi[i];if(t>=end)break;
    if(!Number.isFinite(m))continue;
    if(t-lastVoiced>.05+hop){onsets.push(t);current=m;}
    else if(Math.abs(m-current)>=.8){const hold=Math.ceil(.06/hop);const seg=midi.slice(i,i+hold).map(r=>r[1]);
      if(seg.length===hold&&seg.every(v=>Number.isFinite(v)&&Math.abs(v-m)<.5)){onsets.push(t);current=m;}}
    else current=current*.9+m*.1;
    lastVoiced=t;}
  return onsets;
}
