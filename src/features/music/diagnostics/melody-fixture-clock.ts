import { createBeatScheduler } from '../beat-scheduler';
import type { BeatEvent, BrowserMusicSession, MusicClock } from '../mediaBridge';
import type { MusicBeatState } from '../useMusicBeatSync';
import { beatTelemetry, type BeatTrace } from '../../../../extensions/kanban-music/beat-telemetry.js';

export interface FixtureNote { start: number; end: number; pitch: number | null; amp?: number; source?: string; analysisAudioSha256?: string;
  detector?: string; experimental?: boolean; verified?: boolean; evidence?: string }
export interface FixtureSection { start: number; end: number; source?: string }
export interface MelodyFixture {
  id: string; label: string; audioSha256: string; version: string;
  notes: FixtureNote[]; sections: FixtureSection[];
}
export interface FixtureEventDetail {
  fixtureId: string; audioSha256: string; version: string; selectedSource: string | null;
  midiPitch: number | null; onset: number; offset: number; generation: number;
  analysisAudioSha256?: string;
  detector?: string; experimental?: boolean; verified?: boolean; evidence?: string;
}
export interface FixtureSnapshot {
  session?: BrowserMusicSession; beat: MusicBeatState; total: number; played: number;
  latest: number | null; owner: string | null; currentPitch: number | null; generation: number;
}

const telemetry = beatTelemetry.at('melody-fixture');
const blank = (): MusicBeatState => ({ sessionId: '', mode: 'capture', onsets: {}, telemetry: {} });

/** Private fixture adapter; deadlines and late handling use the existing scheduler. */
export function createMelodyFixtureClock(audio: HTMLMediaElement, changed: (state: FixtureSnapshot) => void) {
  let fixture: MelodyFixture | undefined, generation = 0, cursor = 0, played = 0;
  let latest: number | null = null, beat = blank();
  const details = new Map<string, FixtureEventDetail>();
  const capture = () => `fixture:${generation}`;
  const advancing = () => !audio.paused && !audio.ended && !audio.seeking && audio.readyState >= 3;
  const clock = (): MusicClock => ({ currentTime: audio.currentTime, playing: advancing(), paused: audio.paused,
    seeking: audio.seeking, buffering: !audio.paused && audio.readyState < 3,
    sampledAt: Date.now(), playbackRate: audio.playbackRate, generation });
  const owner = () => fixture?.sections.find(s => audio.currentTime >= s.start && audio.currentTime < s.end)?.source || null;
  const snapshot = (): FixtureSnapshot => ({ session: fixture ? { id: fixture.id, title: fixture.label, artist: '', source: 'private-fixture',
    paused: audio.paused, playing: advancing(), currentTime: audio.currentTime, playbackRate: audio.playbackRate } : undefined,
    beat, total: fixture?.notes.length || 0, played, latest, owner: owner(),
    currentPitch: fixture?.notes.find(n => audio.currentTime >= n.start && audio.currentTime < n.end)?.pitch ?? null, generation });
  const scheduler = createBeatScheduler((event: BeatEvent) => {
    if (!fixture || event.playbackClock?.generation !== generation || !advancing()) return;
    const trace = event.telemetry?.[0];
    if (!trace) return;
    played++; latest = event.targetPlaybackTime ?? null;
    beat = { ...beat, onsets: { melody: played }, telemetry: { 'onset:melodic': trace } };
    telemetry.record('EVENT_STATE_COMMITTED', trace, { ...details.get(trace.eventId!), actualPlaybackTime: audio.currentTime });
    changed(snapshot());
  }, () => rebuild('clock-recovery'));

  function rebuild(reason: string) {
    scheduler.reset(reason, true); generation++;
    played = 0; latest = null;
    // A discontinuity starts a new run; never replay notes preceding the new position.
    cursor = fixture?.notes.findIndex(n => n.start >= audio.currentTime - .001) ?? 0;
    if (cursor < 0) cursor = fixture?.notes.length || 0;
    beat = { ...blank(), sessionId: fixture?.id || '', captureId: capture(), eventPath: 'cache' };
    changed(snapshot());
  }

  function tick() {
    const sampled = clock();
    if (scheduler.clock(sampled)) rebuild('media-discontinuity');
    if (fixture && advancing()) {
      const anchor = clock();
      // Bounded look-ahead, replenished from the actual audio clock, not a demo timer.
      let batch = 0;
      while (cursor < fixture.notes.length && fixture.notes[cursor].start <= audio.currentTime + 2 && batch++ < 256) {
        const index = cursor++, note = fixture.notes[index];
        const id = `${fixture.id}:${fixture.version}:${generation}:${index}`;
        const detail: FixtureEventDetail = { fixtureId: fixture.id, audioSha256: fixture.audioSha256, version: fixture.version,
          selectedSource: note.source ?? fixture.sections.find(s => note.start >= s.start && note.start < s.end)?.source ?? null,
          midiPitch: note.pitch, onset: note.start, offset: note.end, generation };
        if (note.analysisAudioSha256) detail.analysisAudioSha256 = note.analysisAudioSha256;
        for (const key of ['detector','experimental','verified','evidence'] as const) {
          if (note[key] !== undefined) Object.assign(detail,{ [key]:note[key] });
        }
        details.set(id, detail);
        if (details.size > 10000) details.delete(details.keys().next().value!);
        const trace: BeatTrace = { id, eventId: id, captureId: capture(), source: 'onset', type: 'melodic',
          eventSource: 'cache', origin: 'event-track-cache', confidence: note.amp ?? null,
          detectedAt: Date.now(), targetPlaybackTime: note.start,
          targetTime: anchor.sampledAt + (note.start-anchor.currentTime)/anchor.playbackRate*1000, targetClock: 'epoch-ms' };
        telemetry.record('EVENT_CREATED', trace, { ...detail });
        scheduler.enqueue({ kind: 'onset', bands: ['melody'], captureId: capture(), sequence: index,
          eventSource: 'cache', targetPlaybackTime: note.start, playbackClock: anchor, telemetry: [trace] });
      }
    }
    changed(snapshot());
  }

  const reset = () => { rebuild('fixture-lifecycle'); tick(); };
  const lifecycle = ['play', 'pause', 'seeking', 'seeked', 'emptied', 'loadedmetadata', 'ended', 'waiting'];
  lifecycle.forEach(name => audio.addEventListener(name, reset));
  audio.addEventListener('ratechange', tick); audio.addEventListener('playing', tick);
  const timer = setInterval(tick, 25);
  return {
    setFixture(next: MelodyFixture) {
      if (next.notes.length > 4096 || next.notes.some((n, i) => ![n.start, n.end, n.pitch].every(Number.isFinite)
        || n.start < 0 || n.end <= n.start || i > 0 && n.start < next.notes[i-1].start)) throw new Error('Invalid fixture notes');
      fixture = next; rebuild('fixture-changed'); tick();
    },
    snapshot, detail: (id: string) => details.get(id),
    dispose() { clearInterval(timer); scheduler.reset('fixture-disposed', true);
      lifecycle.forEach(name => audio.removeEventListener(name, reset));
      audio.removeEventListener('ratechange', tick); audio.removeEventListener('playing', tick); },
  };
}
