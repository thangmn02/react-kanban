import type { BeatBand } from '../../features/music/mediaBridge';

export interface VisualActivity { low: number; mid: number; high: number; attack: number }
export const quietActivity = (): VisualActivity => ({ low: 0, mid: 0, high: 0, attack: 0 });
const bounded = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

/** Artistic activity envelopes, not an FFT, RMS measurement or instrument classifier. */
export function createOnsetActivity() {
  let hits: Partial<Record<BeatBand, number>> = {};
  let activity = quietActivity();
  return {
    reset() { hits = {}; activity = quietActivity(); },
    observe(onsets: Partial<Record<BeatBand, number>>) {
      for (const band of ['kick', 'clap', 'hat', 'bass'] as const) {
        const count = onsets[band] ?? 0;
        if (count > (hits[band] ?? 0)) {
          if (band === 'bass' || band === 'kick') activity.low = 1;
          if (band === 'clap') activity.mid = 1;
          if (band === 'hat') activity.high = 1;
          activity.attack = 1;
        }
        hits[band] = count;
      }
    },
    sample(dt: number): VisualActivity {
      const value = { ...activity };
      activity = { low: activity.low * Math.exp(-dt * 2.6), mid: activity.mid * Math.exp(-dt * 3),
        high: activity.high * Math.exp(-dt * 4), attack: activity.attack * Math.exp(-dt * 6) };
      return value;
    },
  };
}

/** Explicit silent synthetic preview; does not pretend to be music analysis. */
export function previewActivity(time: number, silence = false): VisualActivity {
  if (silence) return quietActivity();
  const phrase = .55 + .35 * Math.sin(time * .27);
  return { low: bounded(.18 + phrase * Math.exp(-(time % .72) * 4)),
    mid: bounded(.12 + phrase * (.5 + .5 * Math.sin(time * 2.4))),
    high: bounded(.08 + phrase * Math.exp(-(time % .36) * 8)),
    attack: Math.exp(-(time % .72) * 9) };
}

export function smoothActivity(previous: VisualActivity, target: VisualActivity, dt: number): VisualActivity {
  const alpha = 1 - Math.exp(-Math.max(0, Math.min(dt, .1)) * 5);
  return Object.fromEntries(Object.keys(previous).map(key => {
    const k = key as keyof VisualActivity;
    return [k, previous[k] + (bounded(target[k]) - previous[k]) * alpha];
  })) as unknown as VisualActivity;
}

export const tau = Math.PI * 2;
export const laneStations = [.15, Math.PI + .15];
export function crossedStation(before: number, after: number, station: number): boolean {
  if (after === before) return false;
  return Math.floor((before - station) / tau) !== Math.floor((after - station) / tau);
}
export interface OrbitLane {
  angle: number; speed: number; glows: number[];
  trail: { x: number; y: number }[];
}
export function createLanes(): OrbitLane[] {
  return [0, 1, 2, 3].map(i => ({ angle: .15 - .65 - i * .7, speed: .35 + i * .1,
    glows: [0, 0], trail: [] }));
}
export function advanceLane(lane: OrbitLane, dt: number, energy: number) {
  const step = Math.max(0, Math.min(.1, dt));
  const before = lane.angle;
  lane.angle += step * lane.speed * (.3 + bounded(energy) * 1.7);
  const arrivals: number[] = [];
  lane.glows = lane.glows.map((glow, i) => {
    if (crossedStation(before, lane.angle, laneStations[i])) { arrivals.push(i); return 1; }
    return glow * Math.exp(-step * 2.8);
  });
  // Keep phase numerically bounded without changing the visible geometry.
  if (lane.angle >= tau * 2) lane.angle -= tau;
  return arrivals;
}

export function frameSummary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length * .5)] ?? 0,
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] ?? 0 };
}
