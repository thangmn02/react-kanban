import {useEffect,useState} from 'react';

/** Keep the preview in sync when the OS preference changes during playback. */
export function useMotionReduction(){
  const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  useEffect(()=>{
    const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(query?.matches===true);update();query?.addEventListener?.('change',update);
    return()=>query?.removeEventListener?.('change',update);
  },[]);
  return reduced;
}
