import { useEffect, useRef, useState } from 'react';
import SemanticBeatPattern from '../SemanticBeatPattern';
import { beatRowDiagnostics } from '../beat-row-diagnostics';
import { beatTelemetry } from '../../../../extensions/kanban-music/beat-telemetry.js';
import { createMelodyFixtureClock, type FixtureEventDetail, type FixtureSnapshot, type MelodyFixture } from './melody-fixture-clock';
import '../../../components/focus/floatingFocus.css';

interface Marker {
  kind: string; playbackTime: number; owner: string | null; midiPitch: number | null;
  nearestOnset: number | null; fixtureId: string; audioSha256: string; version: string;
}
const empty: FixtureSnapshot = { beat: { sessionId: '', mode: 'capture', onsets: {} }, total: 0, played: 0, latest: null, owner: null, currentPitch: null, generation: 0 };
const markerKey = 'kora-melody-fixture-markers';
function savedMarkers(): Marker[] {
  try { const value = JSON.parse(localStorage.getItem(markerKey) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export default function MelodyListeningGrid({ audio }: { audio: HTMLMediaElement }) {
  const root = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createMelodyFixtureClock> | null>(null);
  const fixture = useRef<MelodyFixture | null>(null);
  const recording = useRef<{ start: number; end: number; generation: number } | null>(null);
  const recordedFixture = useRef<Pick<MelodyFixture, 'id' | 'audioSha256' | 'version'> | null>(null);
  const mediaTimes = useRef(new Map<string, number>());
  const eventDetails = useRef(new Map<string, FixtureEventDetail>());
  const [state, setState] = useState(empty);
  const [recordingStatus, setRecordingStatus] = useState('Not recording');
  const [markers, setMarkers] = useState<Marker[]>(savedMarkers);
  const [melodiaAvailable, setMelodiaAvailable] = useState(false);
  const [inputAbAvailable, setInputAbAvailable] = useState(false);

  useEffect(() => {
    beatTelemetry.enable();
    const driver = createMelodyFixtureClock(audio, next => {
      if (recording.current && (next.generation !== recording.current.generation || audio.currentTime >= recording.current.end)) {
        recording.current = null; beatRowDiagnostics.stop(); setRecordingStatus('Recording stopped; export the captured trace');
      }
      setState(next);
    });
    controller.current = driver;
    const select = (event: Event) => {
      fixture.current = (event as CustomEvent<MelodyFixture>).detail;
      setMelodiaAvailable(Boolean((event as CustomEvent<MelodyFixture & { melodiaAvailable?: boolean }>).detail.melodiaAvailable));
      setInputAbAvailable(Boolean((event as CustomEvent<MelodyFixture & { inputAbAvailable?: boolean }>).detail.inputAbAvailable));
      driver.setFixture(fixture.current);
    };
    document.addEventListener('kora-melody-fixture', select);
    const readCommit = () => root.current?.querySelectorAll<HTMLElement>('[data-beat-trace]').forEach(element => {
      const id = element.dataset.eventId!;
      if (!mediaTimes.current.has(`${id}:commit`)) mediaTimes.current.set(`${id}:commit`, audio.currentTime);
      const detail = driver.detail(id);
      if (detail) eventDetails.current.set(id, detail);
      if (mediaTimes.current.size > 20000) mediaTimes.current.delete(mediaTimes.current.keys().next().value!);
      if (eventDetails.current.size > 10000) eventDetails.current.delete(eventDetails.current.keys().next().value!);
    });
    const observer = new MutationObserver(readCommit);
    if (root.current) observer.observe(root.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-beat-trace'] });
    const animation = (event: Event) => {
      const element = event.target as HTMLElement;
      if (element.dataset.eventId) mediaTimes.current.set(`${element.dataset.eventId}:animation`, audio.currentTime);
    };
    const element = root.current;
    element?.addEventListener('animationstart', animation);
    document.dispatchEvent(new Event('kora-melody-grid-ready'));
    return () => { driver.dispose(); controller.current = null; observer.disconnect();
      element?.removeEventListener('animationstart', animation); document.removeEventListener('kora-melody-fixture', select);
      if (recording.current) beatRowDiagnostics.stop(); };
  }, [audio]);

  async function record() {
    if (audio.paused) {
      try { await audio.play(); }
      catch { setRecordingStatus('Playback could not start; press Play and record again'); return; }
    }
    mediaTimes.current.clear(); eventDetails.current.clear();
    beatRowDiagnostics.start(30, audio.currentTime);
    const selected = fixture.current;
    recordedFixture.current = selected ? { id: selected.id, audioSha256: selected.audioSha256, version: selected.version } : null;
    recording.current = { start: audio.currentTime, end: audio.currentTime + 30,
      generation: controller.current?.snapshot().generation ?? state.generation };
    setRecordingStatus('Recording up to 30 media seconds; seek, pause or A/B changes stop this run');
  }
  function mark(kind: string) {
    const current = fixture.current;
    if (!current) return;
    const near = current.notes.reduce<typeof current.notes[number] | undefined>((nearest, note) =>
      !nearest || Math.abs(note.start-audio.currentTime) < Math.abs(nearest.start-audio.currentTime) ? note : nearest, undefined);
    const marker: Marker = { kind, playbackTime: audio.currentTime, owner: state.owner,
      nearestOnset: near?.start ?? null, midiPitch: near?.pitch ?? null, fixtureId: current.id,
      audioSha256: current.audioSha256, version: current.version };
    const next = [...markers, marker].slice(-2000);
    setMarkers(next); try { localStorage.setItem(markerKey, JSON.stringify(next)); } catch { /* Export still works. */ }
  }
  function exportTrace() {
    const trace = beatRowDiagnostics.snapshot('semantic-only');
    const identity = recordedFixture.current ?? fixture.current;
    const enrich = (event: (typeof trace.flashes)[number]) => ({ ...event, ...eventDetails.current.get(event.eventId),
      actualPlaybackTime: mediaTimes.current.get(`${event.eventId}:${event.stage}`) ?? null });
    const result = { ...trace, rows: Object.fromEntries(Object.entries(trace.rows).map(([row, events]) => [row, events.map(enrich)])),
      flashes: trace.flashes.map(enrich), fixture: identity && { id: identity.id,
        audioSha256: identity.audioSha256, version: identity.version },
      counters: { total: state.total, played: state.played, latestOnset: state.latest, owner: state.owner },
      markers: markers.filter(m => m.fixtureId === identity?.id && m.audioSha256 === identity?.audioSha256),
      telemetry: beatTelemetry.snapshot(), clock: 'the single fixture HTMLMediaElement.currentTime',
      limitation: 'Private Melody fixtures only. Rows 1–4 have no supplied events; unrelated live capture is excluded. Markers are human observations, not complete ground truth.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'kora-melody-row-trace.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section aria-label="Private Melody Beat Grid">
    <h2>Beat Grid · precomputed Melody diagnostics</h2>
    <p>Same fixture audio clock. Rows 1–4 have no supplied fixture events and remain dark. No live music or decorative flashes.</p>
    <label>Row 5 stream <select id="melody-stream" aria-label="Melody stream" defaultValue="v3" onChange={event =>
      document.dispatchEvent(new CustomEvent('kora-melody-stream', { detail: event.target.value }))}>
      <option value="v3">Preserved v3</option><option value="candidate">Rejected candidate</option>
      <option value="melodia" disabled={!melodiaAvailable}>MELODIA{melodiaAvailable ? '' : ' · not analyzed'}</option>
      {inputAbAvailable && <><option value="melodia-mix-ab">Input A/B · original mix</option><option value="melodia-stem-ab">Input A/B · manual stem</option></>}
    </select></label>
    <div ref={root} className="melody-fixture-grid">
      <SemanticBeatPattern key={state.generation} session={state.session} beat={state.beat} melodyEnabled />
    </div>
    <p aria-label="Five-row event counters">Kick: 0 · Snare: 0 · Hat: 0 · Bass: 0 · Melody: {state.played}</p>
    <p aria-label="Melody playback diagnostics">Total: {state.total} · Played this run: {state.played} · Latest onset: {state.latest?.toFixed(3) ?? '—'} s · Owner: {state.owner ?? 'abstain'} · Clock: {audio.currentTime.toFixed(3)} s · {audio.paused ? 'paused' : 'playing'}</p>
    <p aria-label="Current Melody note">Current MIDI: {state.currentPitch ?? '— (rest / no segmented note)'}</p>
    <button onClick={record}>Record 30 seconds</button><button onClick={exportTrace}>Export row trace</button>
    <p aria-live="polite">{recordingStatus}</p>
    <div aria-label="Quick Melody markers">{[['missed', 'Missed note'], ['extra', 'Extra note'], ['timing', 'Incorrect timing'], ['pitch', 'Incorrect pitch']].map(([kind, label]) =>
      <button key={kind} onClick={() => mark(kind)}>{label}</button>)}</div>
    <p aria-live="polite">{markers.filter(m => m.fixtureId === state.session?.id).length} saved human markers for this excerpt. Markers use the current fixture position and include A/B version, owner and nearest proposal pitch.</p>
  </section>;
}
