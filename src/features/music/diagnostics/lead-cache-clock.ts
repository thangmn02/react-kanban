import { createBeatEventEngine } from '../beat-event-engine';
import { InvalidEventTrack, type EventTrackClient } from '../event-track-client';
import { CHUNK_SECONDS, parseChunk, parseManifest, type TrackManifest } from '../event-track';
import { beatCapabilities } from '../beat-capabilities';
import { LEAD_ANALYSIS_VERSION } from '../lead-events';
import { beatTelemetry } from '../../../../extensions/kanban-music/beat-telemetry.js';
import type { FixtureEventDetail, FixtureSnapshot } from './melody-fixture-clock';
import type { DemoFixture } from './melody-detector-fusion';
import type { MusicBeatState } from '../useMusicBeatSync';

const MAX_EVENT_DETAILS = 4096;
const LIFECYCLE_EVENTS = ['pause', 'seeking', 'seeked', 'emptied', 'loadedmetadata', 'ended', 'waiting'];

/** The saved analysis is the diagnostic input; no live analysis service is required. */
function savedLeadClient(fixture: DemoFixture): EventTrackClient {
  const manifest = fixture.asset && Array.isArray(fixture.lead) ? parseManifest({
    version: 1, asset: fixture.asset, revision: 'private-saved-lead-v1',
    analysisVersion: LEAD_ANALYSIS_VERSION, duration: fixture.end,
    chunkSeconds: CHUNK_SECONDS, melodyPolicy: 'dominant-monophonic',
  }, fixture.asset, fixture.end) : undefined;
  const chunks = new Map<number, ReturnType<typeof parseChunk>>();
  let invalid = !Number.isFinite(fixture.start) || !Number.isFinite(fixture.end)
    || fixture.start < 0 || fixture.end <= fixture.start;
  if (manifest) {
    for (let index = 0; index * CHUNK_SECONDS < fixture.end; index++) {
      const events = fixture.lead!.map((note, order) => ({ note, order }))
        .filter(({ note }) => Math.floor(note.start / CHUNK_SECONDS) === index)
        .map(({ note, order }) => ({ id: `saved-lead-${order}`, row: 'melody', time: note.start,
          duration: note.end - note.start, confidence: note.confidence ?? note.amp,
          lead: { policyVersion: note.policyVersion, source: note.source, kind: note.kind,
            detector: note.detector, inputSha256: note.inputSha256,
            ...(note.pitch !== null ? { midiPitch: note.pitch } : {}) } }));
      const chunk = parseChunk({ version: 1, revision: manifest.revision, index, events }, manifest, index);
      if (!chunk) invalid = true;
      chunks.set(index, chunk);
    }
    if (fixture.lead!.some(note => !Number.isFinite(note.start) || !Number.isFinite(note.end)
      || note.start < fixture.start || note.start >= fixture.end || note.end <= note.start || note.end > fixture.end)) invalid = true;
    if (fixture.lead!.some((note, index, notes) => index > 0 && note.start < notes[index - 1].end)) invalid = true;
  }
  return {
    async manifest() {
      if (invalid) throw new InvalidEventTrack('Saved Lead fixture events are invalid');
      return manifest;
    },
    async chunk(view: TrackManifest, index: number) {
      return view.revision === manifest?.revision ? chunks.get(index) : undefined;
    },
    async requestAnalysis() { return 'unavailable'; },
    analysisStatus: () => manifest && !invalid ? 'completed' : 'input_unavailable',
  };
}

/** Private fixture transport uses the product cache, clock and scheduler unchanged. */
export function createLeadCacheClock(
  audio: HTMLMediaElement,
  fixture: DemoFixture,
  changed: (state: FixtureSnapshot) => void,
) {
  let generation = 0;
  let played = 0;
  let latest: number | null = null;
  let beat: MusicBeatState = { sessionId: fixture.id, mode: 'capture', onsets: {} };
  const details = new Map<string, FixtureEventDetail>();
  const advancing = () => !audio.paused && !audio.seeking && !audio.ended && audio.readyState >= 3;
  const snapshot = (): FixtureSnapshot => ({
    session: {
      id: fixture.id,
      title: fixture.label,
      artist: '',
      source: 'private-fixture',
      playing: advancing(),
      paused: audio.paused,
      currentTime: audio.currentTime,
      playbackRate: audio.playbackRate,
    },
    beat,
    total: fixture.lead?.length ?? 0,
    played,
    latest,
    generation,
    owner: fixture.sections?.find(section => (
      section.start <= audio.currentTime && section.end > audio.currentTime
    ))?.source ?? null,
    currentPitch: fixture.lead?.find(note => (
      note.start <= audio.currentTime && note.end > audio.currentTime
    ))?.pitch ?? null,
  });
  const engine = createBeatEventEngine({
    asset: fixture.asset,
    duration: fixture.end,
    capabilities: beatCapabilities(false, false),
    demand: true,
    onLeadAvailability: status => {
      // Clock resets do not unload this immutable saved analysis.
      if (status !== 'checking' || !['ready', 'empty'].includes(beat.leadAvailability ?? '')) {
        beat = { ...beat, leadAvailability: status };
      }
      changed(snapshot());
    },
  }, event => {
    if (event.kind === 'sync.state') {
      if (beat.captureId !== event.captureId) {
        beat = { sessionId: fixture.id, mode: 'capture', onsets: {}, leadAvailability: beat.leadAvailability };
      }
      beat = { ...beat, captureId: event.captureId, eventPath: event.eventPath, reason: event.reason };
    }

    if (event.kind === 'melody.state' && event.melody.active) {
      const trace = event.telemetry?.[0];
      if (!trace || !event.lead) return;

      played++;
      latest = event.targetPlaybackTime ?? null;
      beat = {
        ...beat,
        lead: event.lead,
        melody: event.melody,
        onsets: { melody: played },
        telemetry: { 'onset:melodic': trace },
      };
      const note = fixture.lead?.find(candidate => Math.abs(candidate.start - (latest ?? -1)) < 1e-6);
      details.set(trace.eventId!, {
        fixtureId: fixture.id,
        audioSha256: fixture.audioSha256,
        version: fixture.version,
        selectedSource: event.lead.source,
        midiPitch: event.lead.midiPitch ?? null,
        onset: latest!,
        offset: note?.end ?? latest!,
        generation,
        analysisAudioSha256: event.lead.inputSha256,
        detector: event.lead.detector,
        experimental: true,
        verified: false,
      });
      if (details.size > MAX_EVENT_DETAILS) details.delete(details.keys().next().value!);
      beatTelemetry.at('lead-fixture').record(
        'EVENT_STATE_COMMITTED',
        trace,
        { ...event.lead, playbackTime: audio.currentTime },
      );
    }

    changed(snapshot());
  }, () => {}, () => savedLeadClient(fixture));
  const tick = () => {
    engine.accept({
      kind: 'clock',
      clock: {
        currentTime: audio.currentTime,
        playing: advancing(),
        paused: audio.paused,
        seeking: audio.seeking,
        buffering: !audio.paused && audio.readyState < 3,
        sampledAt: Date.now(),
        playbackRate: audio.playbackRate,
        generation,
      },
    });
    changed(snapshot());
  };
  const reset = (event: Event) => {
    generation++;
    if (['seeking', 'emptied', 'loadedmetadata'].includes(event.type)) {
      played = 0;
      latest = null;
    }
    beat = { ...beat, onsets: {}, telemetry: {}, lead: undefined, melody: undefined };
    tick();
  };

  LIFECYCLE_EVENTS.forEach(name => audio.addEventListener(name, reset));
  audio.addEventListener('playing', tick);
  audio.addEventListener('ratechange', tick);
  const timer = setInterval(tick, 25);
  tick();

  return {
    snapshot,
    detail: (id: string) => details.get(id),
    dispose() {
      clearInterval(timer);
      engine.stop();
      LIFECYCLE_EVENTS.forEach(name => audio.removeEventListener(name, reset));
      audio.removeEventListener('playing', tick);
      audio.removeEventListener('ratechange', tick);
    },
  };
}
