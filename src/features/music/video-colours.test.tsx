import {afterEach,expect,it} from 'vitest';
import {cleanup,render} from '@testing-library/react';
import {SemanticMotionPattern} from './semantic-motion-pattern';
import {instrumentMotion} from './semantic-motion';
import type {MusicBeatState} from './useMusicBeatSync';
import {HUE_BINS} from './video-palette';

afterEach(cleanup);
const beat={mode:'capture',sessionId:'song',captureId:'c',onsets:{},rates:{},tickCount:0,tempo:{locked:true,bpm:120,confidence:1}} as unknown as MusicBeatState;
// Two strong colours: magenta (≈340°) first, teal (≈190°) second.
const bins=Array.from({length:HUE_BINS},(_,index)=>index===34?40:index===19?20:0);
const song=(currentTime:number,palette?:{bins:number[];pixels:number})=>({id:'song',title:'MV',artist:'',source:'youtube.com',playing:true,paused:false,currentTime,
  asset:{provider:'youtube' as const,id:'abcdefghijk'},...(palette?{palette}:{})});
const rowColour=(container:HTMLElement,band:string)=>container.querySelector<HTMLElement>(`[data-motion-band="${band}"]`)!.style.getPropertyValue('--c-mid');

it('renders the Kora palette exactly as before when video colours are off, and draws no glow', () => {
  const view=render(<SemanticMotionPattern session={song(0,{bins,pixels:256})} beat={beat} profile="focus"/>);
  expect(rowColour(view.container,'kick')).toBe(instrumentMotion.kick.color);
  expect(view.container.querySelector('.video-ambient')).toBeNull();
  expect(view.container.querySelector('[data-video-colour]')).toBeNull();
});

it('colours rows from the video and changes the glow only at a phrase boundary', () => {
  const view=render(<SemanticMotionPattern session={song(1,{bins,pixels:256})} beat={beat} profile="focus" videoColours/>);
  const first=rowColour(view.container,'clap'),front=()=>view.container.querySelector<HTMLElement>('.video-ambient[data-front]')!.style.getPropertyValue('--ambient');
  expect(first).not.toBe(instrumentMotion.clap.color);
  const rows=['kick','clap','hat','bass'].map(band=>rowColour(view.container,band));
  expect(new Set(rows).size).toBe(4);
  const glow=front();
  // 120 BPM: a phrase is 16 bars = 32 s. A camera cut at 20 s changes nothing.
  view.rerender(<SemanticMotionPattern session={song(20,{bins,pixels:256})} beat={beat} profile="focus" videoColours/>);
  expect(front()).toBe(glow);
  view.rerender(<SemanticMotionPattern session={song(33,{bins,pixels:256})} beat={beat} profile="focus" videoColours/>);
  expect(front()).not.toBe(glow);
  // Calm (Horizon Eclipse) keeps the grid on the main colour; Eclipse Halo rotates it with the phrase.
  expect(rowColour(view.container,'clap')).toBe(first);
  view.rerender(<SemanticMotionPattern session={song(33,{bins,pixels:256})} beat={beat} profile="dynamic" videoColours/>);
  expect(rowColour(view.container,'clap')).not.toBe(first);
  expect(view.container.querySelectorAll('.video-ambient')).toHaveLength(2);
});

it('keeps the Kora palette for a black-and-white video', () => {
  const view=render(<SemanticMotionPattern session={song(0,{bins:new Array(HUE_BINS).fill(0),pixels:256})} beat={beat} profile="focus" videoColours/>);
  expect(rowColour(view.container,'kick')).toBe(instrumentMotion.kick.color);
});
