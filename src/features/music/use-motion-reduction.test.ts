import {act,renderHook} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {useMotionReduction} from './use-motion-reduction';
it('responds to system changes and releases its listener on unmount',()=>{
  const query=new EventTarget() as EventTarget&{matches:boolean};query.matches=false;
  const remove=vi.spyOn(query,'removeEventListener');
  vi.stubGlobal('matchMedia',vi.fn(()=>query as MediaQueryList));
  try{
    const hook=renderHook(()=>useMotionReduction());expect(hook.result.current).toBe(false);
    act(()=>{query.matches=true;query.dispatchEvent(new Event('change'));});expect(hook.result.current).toBe(true);
    act(()=>{query.matches=false;query.dispatchEvent(new Event('change'));});expect(hook.result.current).toBe(false);
    hook.unmount();expect(remove).toHaveBeenCalledOnce();
  }finally{vi.unstubAllGlobals();remove.mockRestore();}
});
