import {act,cleanup,render} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {BeatHeartbeat} from './beat-heartbeat';
import type {MusicBeatState} from './useMusicBeatSync';
const beat:MusicBeatState={sessionId:'song',mode:'capture',onsets:{},tempo:{locked:true,bpm:120,confidence:1},tickCount:0};
const original=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'animate');
beforeEach(()=>Object.defineProperty(HTMLElement.prototype,'animate',{configurable:true,writable:true,value:vi.fn()}));
afterEach(()=>{cleanup();vi.restoreAllMocks();if(original)Object.defineProperty(HTMLElement.prototype,'animate',original);else Reflect.deleteProperty(HTMLElement.prototype,'animate');});
it('uses released structural ticks without fabricating onsets or restarting for another row',()=>{
  const cancel=vi.fn(),animate=vi.spyOn(HTMLElement.prototype,'animate').mockReturnValue({cancel,currentTime:0} as unknown as Animation);
  const view=render(<BeatHeartbeat owner="owner" beat={beat}/>);
  expect(animate).not.toHaveBeenCalled();
  view.rerender(<BeatHeartbeat owner="owner" beat={{...beat,tickCount:1}}/>);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.calls[0][1]).toMatchObject({duration:500});
  view.rerender(<BeatHeartbeat owner="owner" beat={{...beat,tickCount:1,onsets:{hat:1}}}/>);
  expect(animate).toHaveBeenCalledTimes(1);expect(cancel).not.toHaveBeenCalled();
  expect(beat.onsets).toEqual({});
  view.rerender(<BeatHeartbeat owner="owner" beat={{...beat,tickCount:1,tempo:{locked:true,bpm:90,confidence:1}}}/>);
  expect(cancel).toHaveBeenCalledTimes(1);expect(animate).toHaveBeenCalledTimes(1);
});
it('clears on reduced mode, missing tempo, visibility and owner reset with no stale resume',()=>{
  const cancel=vi.fn(),animate=vi.spyOn(HTMLElement.prototype,'animate').mockReturnValue({cancel,currentTime:0} as unknown as Animation);
  const view=render(<BeatHeartbeat owner="a" beat={beat}/>);
  view.rerender(<BeatHeartbeat owner="a" beat={{...beat,tickCount:1}}/>);
  act(()=>document.dispatchEvent(new Event('visibilitychange')));expect(cancel).toHaveBeenCalled();
  view.rerender(<BeatHeartbeat owner="b" beat={{...beat,tickCount:1}}/>);
  view.rerender(<BeatHeartbeat owner="b" beat={{...beat,tickCount:2}} reduced/>);
  view.rerender(<BeatHeartbeat owner="b" beat={{...beat,tickCount:3,tempo:undefined}}/>);
  expect(animate).toHaveBeenCalledTimes(1);
});
it('does not present the existing zero-confidence degraded fallback as a verified structural heartbeat',()=>{
  const animate=vi.spyOn(HTMLElement.prototype,'animate');
  const degraded={...beat,eventPath:'degraded' as const,tempo:{locked:true,bpm:120,confidence:0}};
  const view=render(<BeatHeartbeat owner="owner" beat={degraded}/>);
  view.rerender(<BeatHeartbeat owner="owner" beat={{...degraded,tickCount:1}}/>);
  expect(animate).not.toHaveBeenCalled();
});
