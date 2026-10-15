import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExperimentalBeatControl from './experimental-beat-control';
import { configureExperimentalSynchronization, type BrowserMusicSession } from './mediaBridge';
import { decideBeatMode } from '../../../extensions/kanban-music/beat-mode.js';

vi.mock('./mediaBridge', () => ({ configureExperimentalSynchronization: vi.fn() }));
beforeEach(() => { vi.mocked(configureExperimentalSynchronization).mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

function session(): BrowserMusicSession {
  const capability=decideBeatMode({privateCandidate:true,surface:'web',
    source:{kind:'audio-only',singleSource:true,noVideo:true,noFrames:true},
    capture:{id:'capture',owner:'owner',expectedOwner:'owner',active:true,audible:true,output:'tab-replacement',originalSuppressed:true},
    clock:{sampledAt:Date.now(),generation:2,playbackRate:1},
    detector:{privateUseAllowed:true},timing:{samples:64,p95Ms:200,p99Ms:220}});
  return {id:'source',title:'Audio review',artist:'',source:'127.0.0.1',paused:false,
    syncState:{mode:'capture',captureId:'capture',capability}};
}
function consent() {
  for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox);
}

it('explains the pause requirement even after all consent boxes are checked', () => {
  render(<ExperimentalBeatControl session={session()} refresh={vi.fn()} initiallyOpen/>);
  consent();
  expect(screen.getByRole('button',{name:/Enable calibrated/})).toBeDisabled();
  expect(screen.getByRole('status',{name:'Delay activation status'})).toHaveTextContent('Pause the selected source');
  expect(configureExperimentalSynchronization).not.toHaveBeenCalled();
});

it('enables after the same source pauses and submits its current capture and generation', async () => {
  const current=session(),refresh=vi.fn();
  const view=render(<ExperimentalBeatControl session={current} refresh={refresh} initiallyOpen/>);
  consent();
  view.rerender(<ExperimentalBeatControl session={{...current,paused:true}} refresh={refresh} initiallyOpen/>);
  expect(screen.getByRole('status',{name:'Delay activation status'})).toHaveTextContent('Ready.');
  const button=screen.getByRole('button',{name:/Enable calibrated/});
  expect(button).toBeEnabled();fireEvent.click(button);
  await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
  expect(configureExperimentalSynchronization).toHaveBeenCalledWith('source',{
    enabled:true,captureId:'capture',generation:2,intentionalDelay:true,authorizedAudio:true,outputHeard:true,preview:true});
});

it('explains capture loss while paused rather than silently disabling activation', () => {
  const current=session();delete current.syncState!.captureId;current.paused=true;
  render(<ExperimentalBeatControl session={current} refresh={vi.fn()} initiallyOpen/>);consent();
  expect(screen.getByRole('button',{name:/Enable calibrated/})).toBeDisabled();
  expect(screen.getByRole('status',{name:'Delay activation status'})).toHaveTextContent('The capture has ended');
});

it('reports a calibration blocker when pause and consent are already satisfied', () => {
  const current=session();current.paused=true;
  Object.assign(current.syncState!.capability!,{bufferEligible:false,bufferReason:'calibration-unavailable'});
  render(<ExperimentalBeatControl session={current} refresh={vi.fn()} initiallyOpen/>);consent();
  expect(screen.getByRole('button',{name:/Enable calibrated/})).toBeDisabled();
  expect(screen.getByRole('status',{name:'Delay activation status'})).toHaveTextContent('Calibration is incomplete or exceeds the 500 ms limit');
});
