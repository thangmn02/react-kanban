import { describe, expect, it } from 'vitest';
import { advanceLane, createLanes, createOnsetActivity, crossedStation, laneStations, previewActivity, quietActivity, smoothActivity, tau } from './visual-activity';

describe('artistic activity input', () => {
  it('uses only new existing onset counts, without Lead or tempo fabrication', () => {
    const input = createOnsetActivity();
    input.observe({ kick: 1, melody: 5 });
    expect(input.sample(1)).toEqual({ low: 1, mid: 0, high: 0, attack: 1 });
    input.observe({ kick: 1, melody: 6 });
    expect(input.sample(10).low).toBeLessThan(.1);
    expect(input.sample(.1).attack).toBeLessThan(.001);
    input.reset(); expect(input.sample(.1)).toEqual(quietActivity());
  });
  it('has real zero targets for preview silence and bounded smoothing', () => {
    expect(previewActivity(1, true)).toEqual(quietActivity());
    expect(smoothActivity(quietActivity(), { low: 8, mid: NaN, high: -1, attack: 4 }, .1)).toEqual({
      low: 1 - Math.exp(-.5), mid: 0, high: 0, attack: 1 - Math.exp(-.5),
    });
  });
});

describe('orbital arrival causality', () => {
  it('illuminates only the crossed station and then decays', () => {
    const lane = createLanes()[0]; lane.angle = laneStations[0] - .001;
    expect(advanceLane(lane, .05, 1)).toEqual([0]);
    expect(lane.glows).toEqual([1, 0]);
    expect(advanceLane(lane, .05, 1)).toEqual([]);
    expect(lane.glows[0]).toBeLessThan(1);
    expect(lane.glows[1]).toBe(0);
  });
  it('handles wrapping and reverse crossings without repeated proximity triggers', () => {
    expect(crossedStation(tau - .05, tau + .05, 0)).toBe(true);
    expect(crossedStation(.2, .1, .15)).toBe(true);
    expect(crossedStation(.15, .15, .15)).toBe(false);
  });
  it('keeps independent lanes and bounded phases over long playback', () => {
    const lanes = createLanes();
    for (let i = 0; i < 18000; i++) lanes.forEach(l => advanceLane(l, 1 / 30, .8));
    lanes.forEach(l => { expect(l.angle).toBeLessThan(tau * 2); expect(l.glows.every(g => g >= 0 && g <= 1)).toBe(true); });
    expect(lanes[0].angle).not.toBe(lanes[1].angle);
  });
});
