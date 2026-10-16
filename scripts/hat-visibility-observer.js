// Shared browser-side measurement; never changes events, styles or rendering.
export function installHatVisibilityObserver() {
  window.hatSamples=[];
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const color=value=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
  const luma=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
  const observe=()=>{
    const row=document.querySelector('[data-channel="hat"]');
    if(row){
      const style=getComputedStyle(row),hit=luma(color(style.getPropertyValue('--c'))),idle=luma(color(style.getPropertyValue('--ci')));
      let level=0,overlay=0;const ids=[];
      for(const cell of row.querySelectorAll('.beat-square')){
        const rect=cell.getBoundingClientRect();if(rect.top<0||rect.bottom>innerHeight||rect.left<0||rect.right>innerWidth)continue;
        let rgb=color(getComputedStyle(cell).backgroundColor);
        for(const flash of cell.querySelectorAll('.semantic-beat-flash,.shape-beat-flash')){
          const s=getComputedStyle(flash);if(s.display==='none')continue;
          const alpha=Number(s.opacity),fg=color(s.backgroundColor);rgb=rgb.map((c,i)=>c*(1-alpha)+fg[i]*alpha);
          if(flash.classList.contains('semantic-beat-flash')){overlay=Math.max(overlay,alpha);if(alpha>=.5)ids.push(flash.dataset.beatTrace);}
        }
        level=Math.max(level,(luma(rgb)-idle)/(hit-idle));
      }
      window.hatSamples.push({at:Date.now(),performanceNow:performance.now(),level:Math.max(0,Math.min(1,level)),overlay,ids});
      if(window.hatSamples.length>12000)window.hatSamples.shift();
    }
    requestAnimationFrame(observe);
  };requestAnimationFrame(observe);
}
