// Small deterministic PRNG so a saved reading can be reproduced from its seed.
// Based on mulberry32 — tiny, fast, and good enough for cosmetic rolls.

export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function createRng(seed: string) {
  let state = hashSeed(seed) || 1;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Pick an index from a weight table using a 0..1 roll. */
export function pickWeighted<T extends string>(roll: number, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let threshold = roll * total;
  for (const [key, weight] of entries) {
    threshold -= weight;
    if (threshold <= 0) return key;
  }
  return entries[entries.length - 1][0];
}
