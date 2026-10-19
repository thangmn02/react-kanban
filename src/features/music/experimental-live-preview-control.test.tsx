import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExperimentalLivePreviewControl from './experimental-live-preview-control';
import { configureExperimentalSynchronization, type BrowserMusicSession } from './mediaBridge';
import { decideBeatMode } from '../../../extensions/kanban-music/beat-mode.js';

vi.mock('./mediaBridge',()=>({configureExperimentalSynchronization:vi.fn()}));
beforeEach(()=>{vi.mocked(configureExperimentalSynchronization).mockReset().mockResolvedValue(undefined);});
afterEach(cleanup);
function session():BrowserMusicSession {
  return {id:'video',title:'Video review',artist:'',source:'www.youtube.com',paused:false,
    syncState:{mode:'capture',captureId:'capture',capability:decideBeatMode({privateCandidate:true,surface:'web',
      source:{kind:'video',singleSource:true,noVideo:false,noFrames:false},
      capture:{id:'capture',owner:'owner',expectedOwner:'owner',active:true,audible:true,output:'tab-replacement',originalSuppressed:true},
      clock:{sampledAt:Date.now(),generation:1,playbackRate:1,playing:true,paused:false},detector:{privateUseAllowed:true}})}};
}
function consent(){for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox);}
it('enables unbuffered video only after explicit consent to late predictions',async()=>{
  const refresh=vi.fn();render(<ExperimentalLivePreviewControl session={session()} refresh={refresh}/>);
  const button=screen.getByRole('button',{name:'Enable live preview (no audio delay)'});
  expect(button).toBeDisabled();consent();expect(button).toBeEnabled();fireEvent.click(button);
  await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
  expect(configureExperimentalSynchronization).toHaveBeenCalledWith('video',{
    enabled:true,preview:true,live:true,intentionalDelay:false,captureId:'capture',generation:1,
    authorizedAudio:true,outputHeard:true,latencyAccepted:true});
});
it('keeps live preview unavailable while paused without asking for delay calibration',()=>{
  const current=session();current.paused=true;
  render(<ExperimentalLivePreviewControl session={current} refresh={vi.fn()}/>);consent();
  expect(screen.getByRole('button',{name:/Enable live preview/})).toBeDisabled();
  expect(screen.getByRole('status',{name:'Live preview activation status'})).toHaveTextContent('Keep the source playing');
});
it('can disable active live preview while playback continues',async()=>{
  const current=session();Object.assign(current.syncState!.capability!,{mode:'experimental-live',allowTypedPreview:true});
  render(<ExperimentalLivePreviewControl session={current} refresh={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Disable live preview'}));
  await waitFor(()=>expect(configureExperimentalSynchronization).toHaveBeenCalledWith('video',expect.objectContaining({enabled:false,live:true,preview:false})));
});
it('explains that a connected older private extension must be reloaded',()=>{
  const current=session();Object.assign(current.syncState!.capability!,{livePreviewEligible:false,livePreviewReason:'unavailable'});
  render(<ExperimentalLivePreviewControl session={current} refresh={vi.fn()}/>);
  expect(screen.getByRole('status',{name:'Live preview activation status'})).toHaveTextContent('Reload the updated private Companion');
});
it('selects the supported private L1 and rolls back to L0 on the same live preview',async()=>{
  const current=session();Object.assign(current.syncState!.capability!,{earlyDecisionAvailable:true});
  const view=render(<ExperimentalLivePreviewControl session={current} refresh={vi.fn()}/>);consent();
  fireEvent.change(screen.getByRole('combobox',{name:'Live detector'}),{target:{value:'L1-gap0'}});
  fireEvent.click(screen.getByRole('button',{name:'Enable live preview (no audio delay)'}));
  await waitFor(()=>expect(configureExperimentalSynchronization).toHaveBeenLastCalledWith('video',expect.objectContaining({detectorVariant:'L1-gap0',enabled:true})));
  Object.assign(current.syncState!.capability!,{mode:'experimental-live',allowTypedPreview:true,detectorId:'adtof-early-finalization'});
  view.rerender(<ExperimentalLivePreviewControl session={current} refresh={vi.fn()}/>);
  expect(screen.getByText(/LIVE SEMANTIC CANDIDATE/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox',{name:'Live detector'}),{target:{value:'L0'}});
  await waitFor(()=>expect(configureExperimentalSynchronization).toHaveBeenLastCalledWith('video',expect.objectContaining({detectorVariant:'L0',enabled:true,preview:true,live:true,intentionalDelay:false})));
});
it.each(['protected-source','provider-policy'])('explains %s before suggesting a capture reconnect',reason=>{
  const current=session();delete current.syncState!.captureId;
  Object.assign(current.syncState!.capability!,{reason,mode:'unsupported',livePreviewEligible:false});
  render(<ExperimentalLivePreviewControl session={current} refresh={vi.fn()}/>);
  const status=screen.getByRole('status',{name:'Live preview activation status'});
  expect(status).toHaveTextContent('Playback controls remain available');
  expect(status).not.toHaveTextContent('click Companion');
  expect(screen.getByRole('button',{name:/Enable live preview/})).toBeDisabled();
  for(const checkbox of screen.getAllByRole('checkbox'))expect(checkbox).toBeDisabled();
});
