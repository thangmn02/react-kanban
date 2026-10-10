import type { FixtureNote } from './melody-fixture-clock';
import type { MediaAsset } from '../event-track';
import type { LeadProvenance } from '../lead-events';

export interface PitchFrame { time: number; hz: number; voiced: boolean }
export interface DemoFixture {
  id: string; label: string; audioSha256: string; analysisAudioSha256: string;
  originalUrl: string; inputUrl: string; rawPitchUrl: string;
  inputLabel: string; start: number; end: number; version: string;
  baseline: FixtureNote[]; basicPitch: FixtureNote[]; frames: PitchFrame[];
  provenance: Record<string, unknown>;
  lead?: (FixtureNote & Partial<Omit<LeadProvenance, 'source' | 'detector' | 'midiPitch'>> & { confidence?: number })[];
  sections?: {start:number;end:number;source:string|null}[];
  asset?: MediaAsset;
}
export interface ProposalDecision { note: FixtureNote; reason: string; accepted: boolean }
// One fixed private candidate, not calibration or production confidence thresholds.
export const fusionPolicy = Object.freeze({ duplicateSeconds: .04, clusterSeconds: .045,
  minimumActivation: .5, pitchMargin: .1, minimumDuration: .12,
  baselineOnsetGuard: .08, additionSpacing: .12, unsupportedActivation: .65, unsupportedMargin: .15 });

export function compareMelodyDetectors(input: DemoFixture) {
  const baseline = input.baseline.map(n => ({ ...n }));
  const decisions: ProposalDecision[] = [];
  const reject = (note: FixtureNote, reason: string) => decisions.push({ note: { ...note }, reason, accepted: false });
  const ordered = input.basicPitch.map(n => ({ ...n })).sort((a,b) => a.start-b.start || (b.amp ?? 0)-(a.amp ?? 0));
  const unique: FixtureNote[] = [];
  for (const note of ordered) {
    if (typeof note.pitch!=='number' || ![note.start,note.end,note.pitch,note.amp].every(Number.isFinite) || note.start<input.start || note.start>=input.end
      || note.end-note.start<fusionPolicy.minimumDuration) { reject(note,'invalid-or-short'); continue; }
    const duplicate = unique.find(n => n.pitch===note.pitch && Math.abs(n.start-note.start)<=fusionPolicy.duplicateSeconds);
    if (duplicate) {
      if ((note.amp ?? 0)>(duplicate.amp ?? 0)) { reject({ ...duplicate },'duplicate'); Object.assign(duplicate,note); }
      else reject(note,'duplicate');
    } else unique.push(note);
  }
  unique.sort((a,b)=>a.start-b.start);
  const winners: { note: FixtureNote; margin: number }[] = [];
  for (let i=0;i<unique.length;) {
    const start=unique[i].start, cluster: FixtureNote[]=[];
    while (i<unique.length && unique[i].start-start<=fusionPolicy.clusterSeconds) cluster.push(unique[i++]);
    cluster.sort((a,b)=>(b.amp ?? 0)-(a.amp ?? 0));
    const best=cluster[0], competitor=cluster.find(n => n.pitch!==best.pitch);
    const margin=(best.amp ?? 0)-(competitor?.amp ?? 0);
    if ((best.amp ?? 0)<fusionPolicy.minimumActivation || margin<fusionPolicy.pitchMargin) {
      cluster.forEach(n => reject(n,'uncertain-pitch-cluster')); continue;
    }
    winners.push({ note:best, margin });
    cluster.slice(1).forEach(n => reject(n,'competing-pitch'));
  }
  const basicPitch: FixtureNote[]=[];
  for (const {note} of winners) {
    const previous=basicPitch.at(-1);
    if (previous && note.start-previous.start<fusionPolicy.additionSpacing) { reject(note,'dense-onset'); continue; }
    if (previous && previous.end>note.start) previous.end=note.start;
    basicPitch.push({ ...note,end:Math.min(note.end,input.end),detector:'basic-pitch',experimental:true,verified:false,
      evidence:'activation-and-pitch-margin; primary role unverified' });
  }
  const added: FixtureNote[]=[];
  for (const {note,margin} of winners) {
    if (!basicPitch.some(n => n.start===note.start && n.pitch===note.pitch)) continue;
    if (baseline.some(n => Math.abs(n.start-note.start)<=fusionPolicy.baselineOnsetGuard)) { reject(note,'baseline-onset-duplicate'); continue; }
    if (baseline.some(n => n.start<=note.start && n.end>note.start)) { reject(note,'baseline-note-protected'); continue; }
    const next=baseline.find(n => n.start>note.start);
    const end=Math.min(note.end,input.end,next?.start ?? input.end);
    if (end-note.start<fusionPolicy.minimumDuration) { reject(note,'insufficient-baseline-gap'); continue; }
    const frames=input.frames.filter(f => f.voiced && f.hz>0 && f.time>=note.start && f.time<Math.min(end,note.start+.15));
    const compatible=frames.filter(f => Math.abs(69+12*Math.log2(f.hz/440)-Number(note.pitch))<=1).length;
    if (frames.length>=4 && compatible/frames.length<.5) { reject(note,'available-f0-disagrees'); continue; }
    if (frames.length<4 && ((note.amp ?? 0)<fusionPolicy.unsupportedActivation || margin<fusionPolicy.unsupportedMargin)) {
      reject(note,'no-f0-support-and-uncertain-bp'); continue;
    }
    if (added.length && note.start-added.at(-1)!.start<fusionPolicy.additionSpacing) { reject(note,'dense-addition'); continue; }
    if (added.at(-1) && added.at(-1)!.end>note.start) added.at(-1)!.end=note.start;
    const accepted={ ...note,end,detector:'melodia-basic-pitch-fusion',experimental:true,verified:false,
      evidence:frames.length>=4?'BP onset + compatible voiced MELODIA frames':'strong isolated BP proposal in MELODIA gap; primary role unverified' };
    added.push(accepted);decisions.push({note:accepted,reason:accepted.evidence,accepted:true});
  }
  const fusion=[...baseline,...added].sort((a,b)=>a.start-b.start);
  return { baseline,basicPitch,fusion,added,decisions,policy:fusionPolicy };
}
