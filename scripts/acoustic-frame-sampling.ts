export type Sample={at:number;level:number;ids:string[]};
export function rowSample(root:HTMLElement):Sample{
  const row=root.querySelector('[data-channel="hat"]');const sample:Sample={at:performance.now(),level:0,ids:[]};if(!row)return sample;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  const color=(value:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
  const luma=(c:number[])=>.2126*c[0]+.7152*c[1]+.0722*c[2];const style=getComputedStyle(row),hit=luma(color(style.getPropertyValue('--c'))),idle=luma(color(style.getPropertyValue('--ci')));
  for(const cell of row.querySelectorAll('.beat-square')){
    const rect=cell.getBoundingClientRect();if(rect.bottom<0||rect.top>innerHeight)continue;
    let rgb=color(getComputedStyle(cell).backgroundColor);
    for(const flash of cell.querySelectorAll<HTMLElement>('.semantic-beat-flash,.shape-beat-flash')){
      const s=getComputedStyle(flash);if(s.display==='none')continue;const alpha=Number(s.opacity),fg=color(s.backgroundColor);rgb=rgb.map((c,i)=>c*(1-alpha)+fg[i]*alpha);
      if(flash.classList.contains('semantic-beat-flash')&&alpha>=.5&&flash.dataset.beatTrace)sample.ids.push(flash.dataset.beatTrace);
    }
    sample.level=Math.max(sample.level,Math.max(0,Math.min(1,(luma(rgb)-idle)/(hit-idle))));
  }
  return sample;
}
