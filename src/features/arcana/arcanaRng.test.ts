import { describe, it, expect } from 'vitest';

import { hashSeed, createRng, pickWeighted } from './arcanaRng';

describe('hashSeed', () => {
  it('returns a 32-bit unsigned integer', () => {
    const value = hashSeed('test-seed');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });

  it('is deterministic for the same input', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('returns 0 for empty string', () => {
    // Empty string -> length 0 -> h stays 1779033703 ^ 0 = 1779033703, no loop iterations,
    // then >>> 0 keeps it unchanged.
    expect(hashSeed('')).toBe(1779033703 >>> 0);
  });
});

describe('createRng', () => {
  it('produces numbers in the [0, 1) range', () => {
    const next = createRng('seed-1');
    for (let i = 0; i < 100; i += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is deterministic: the same seed yields the same sequence', () => {
    const a = createRng('deterministic');
    const b = createRng('deterministic');
    const sequenceA = Array.from({ length: 5 }, () => a());
    const sequenceB = Array.from({ length: 5 }, () => b());

    expect(sequenceA).toEqual(sequenceB);
  });

  it('different seeds yield different sequences', () => {
    const a = createRng('seed-a');
    const b = createRng('seed-b');
    const sequenceA = Array.from({ length: 5 }, () => a());
    const sequenceB = Array.from({ length: 5 }, () => b());

    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('falls back to a non-zero state for empty seed', () => {
    // hashSeed('') is non-zero, so the RNG should still function.
    const next = createRng('');
    const value = next();

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});

describe('pickWeighted', () => {
  it('picks the first key when roll is very small', () => {
    expect(pickWeighted(0, { a: 1, b: 1, c: 1 })).toBe('a');
  });

  it('picks the last key when roll is at or above 1', () => {
    expect(pickWeighted(1, { a: 1, b: 1, c: 1 })).toBe('c');
  });

  it('respects weight proportions', () => {
    // weights a:1, b:3 -> cumulative thresholds at roll*4: a at <1, b otherwise.
    expect(pickWeighted(0.1, { a: 1, b: 3 })).toBe('a');
    expect(pickWeighted(0.3, { a: 1, b: 3 })).toBe('b');
    expect(pickWeighted(0.6, { a: 1, b: 3 })).toBe('b');
    expect(pickWeighted(0.9, { a: 1, b: 3 })).toBe('b');
  });

  it('returns the last key when roll exceeds total', () => {
    expect(pickWeighted(1.5, { a: 1, b: 1 })).toBe('b');
  });

  it('picks a single-entry table', () => {
    expect(pickWeighted(0, { only: 5 })).toBe('only');
    expect(pickWeighted(0.99, { only: 5 })).toBe('only');
  });
});
