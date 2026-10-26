import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import AudioDelayCompensationControl from './audio-delay-compensation-control';
import {configureExperimentalSynchronization,type BrowserMusicSession} from './mediaBridge';
import {decideBeatMode} from '../../../extensions/kanban-music/beat-mode.js';
vi.mock('./mediaBridge',()=>({configureExperimentalSynchronization:vi.fn(async()=>{})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const session=():BrowserMusicSession=>({id:'s',title:'source',artist:'',source:'youtube.com',paused:true,syncState:{mode:'capture',captureId:'c',capability:{...decideBeatMode(),privateCandidate:true,compensationEligible:true,generation:4}}});
it('defaults OFF with a 170 ms opt-in hypothesis and sends the exact source generation',async()=>{
  const refresh=vi.fn();render(<AudioDelayCompensationControl session={session()} refresh={refresh}/>);
  expect(screen.getByRole('status')).toHaveTextContent('OFF');expect(screen.getByRole('combobox')).toHaveValue('170');
  const button=screen.getByRole('button',{name:'Enable 170 ms compensation'});expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(button);await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
  expect(configureExperimentalSynchronization).toHaveBeenCalledWith('s',expect.objectContaining({enabled:true,compensationMs:170,captureId:'c',generation:4,preview:true}));
});
it('keeps immediate OFF available during playback without requiring new consent',async()=>{
  const current=session();current.paused=false;current.syncState!.capability!.bufferMs=170;
  render(<AudioDelayCompensationControl session={current} refresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Turn audio compensation OFF'}));
  await waitFor(()=>expect(configureExperimentalSynchronization).toHaveBeenCalledWith('s',expect.objectContaining({enabled:false,compensationMs:0})));
});
it('selects Hybrid through the source-bound compensation command only in a capable private build',async()=>{
  const current=session();current.syncState!.capability!.hybridLiveAvailable=true;
  render(<AudioDelayCompensationControl session={current} refresh={vi.fn()}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Compensated detector'}),{target:{value:'H-LIVE'}});
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Enable 170 ms compensation'}));
  await waitFor(()=>expect(configureExperimentalSynchronization).toHaveBeenCalledWith('s',expect.objectContaining({detectorVariant:'H-LIVE',compensationMs:170,captureId:'c',generation:4})));
});
