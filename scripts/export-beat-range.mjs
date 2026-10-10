import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { primaryMelodyTracker } from '../server/primary-melody-tracker.ts';
import { parseManifest, parseChunk, MAX_RESPONSE_BYTES } from '../src/features/music/event-track.ts';
import { LEAD_ANALYSIS_VERSION, LEAD_POLICY_VERSION, parseLeadProvenance } from '../src/features/music/lead-events.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Expected bounded analysis input and output directory');
const value = JSON.parse(await readFile(input, 'utf8'));
const { job, offset, candidates, onsets } = value;
const { start, end } = job.requestedRange;
if (![start, end, offset].every(Number.isFinite) || start < 0 || start % 30 || end <= start || end - start > 300 || offset < 0
  || !Array.isArray(candidates) || candidates.length > 12 || !Array.isArray(onsets) || onsets.length > 200000) throw new Error('Invalid range analysis');
const leadMode=job.analysisVersion===LEAD_ANALYSIS_VERSION;
if(leadMode && (value.leadTrack?.version!==LEAD_POLICY_VERSION || !Array.isArray(value.leadTrack.events)
  || value.leadTrack.events.length>200000))throw new Error('Missing versioned Lead analysis');
const tracked = leadMode ? {notes:value.leadTrack.events,policyVersion:LEAD_POLICY_VERSION,sections:value.leadTrack.sections}
  : primaryMelodyTracker.track(candidates, value.duration, job.leadDecision?.source);
const { notes, ...decision } = tracked;
const attacks = [
  ...onsets.map(event => ({ type: event.row, playbackTime: event.time + offset, confidence: event.confidence, duration: event.duration ?? 0 })),
  ...notes.map(note => {
    const lead=leadMode?parseLeadProvenance({policyVersion:note.policyVersion,source:note.source,kind:note.kind,
      detector:note.detector,inputSha256:note.inputSha256,...(note.pitch!==undefined?{midiPitch:note.pitch}:{})}):undefined;
    if(leadMode&&!lead)throw new Error('Invalid Lead provenance');
    return { type: 'melody', playbackTime: note.start + offset, confidence: leadMode?note.confidence:note.amp,
      duration: Math.min(30, note.end - note.start),...(lead?{lead}:{}) };
  }),
].filter(event => event.playbackTime >= start && event.playbackTime < end).sort((a, b) => a.playbackTime - b.playbackTime);
const events = attacks.map((event, index) => ({ ...event, duration: Math.min(event.duration, end - event.playbackTime),
  eventId: createHash('sha256').update(`${job.analysisVersion}:${event.type}:${event.playbackTime}:${index}`).digest('hex'), source: 'server-cache' }));
const descriptors = [];
await mkdir(output, { recursive: true });
for (let index = start / 30; index < Math.ceil(end / 30); index++) {
  const chunkEvents = events.filter(event => Math.floor(event.playbackTime / 30) === index);
  const revision = createHash('sha256').update(JSON.stringify({ index, events: chunkEvents })).digest('hex');
  const manifest = parseManifest({ version: 1, revision, asset: job.asset, analysisVersion: job.analysisVersion,
    duration: job.duration, chunkSeconds: 30, melodyPolicy: 'dominant-monophonic' }, job.asset);
  const chunk = { schemaVersion: 2, revision, index, events: chunkEvents };
  const payload = JSON.stringify(chunk);
  if (!manifest || !parseChunk({ version: 1, revision, index, events: chunkEvents.map(event => ({ id: event.eventId, row: event.type,
    time: event.playbackTime, duration: event.duration, confidence: event.confidence,lead:event.lead })) }, manifest, index) || Buffer.byteLength(payload) > MAX_RESPONSE_BYTES) throw new Error('Invalid range output');
  await writeFile(join(output, `${index}.json`), payload);
  descriptors.push({ index, revision, count: chunkEvents.length, bytes: Buffer.byteLength(payload) });
}
await writeFile(join(output, 'result.json'), JSON.stringify({ chunks: descriptors, leadDecision: decision, eventCount: events.length }));
