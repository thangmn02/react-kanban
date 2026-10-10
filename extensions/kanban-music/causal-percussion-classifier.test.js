import { describe, it, expect } from 'vitest';
import { CausalPercussionClassifier } from './causal-percussion-classifier.js';
describe('causal learned identity', () => {
  it('abstains on nonpercussion and never reassigns another class', () => {
    const classifier = new CausalPercussionClassifier();
    const frames = [[.1,.1,0,.1,.1,.9],[.8,.1,0,.1,.1,.9],[.1,.1,0,.1,.1,.9]];
    expect(frames.flatMap((s,i)=>classifier.push(s,i*.01).events)).toEqual([]);
  });
  it('preserves simultaneous independent classes and repeated hats', () => {
    const classifier = new CausalPercussionClassifier();
    const scores = [.1,.9,.1,.9,.1];
    const events = scores.flatMap((s,i)=>classifier.push([s,s,0,s,0,.05],i*.01).events);
    expect(events.filter(e=>e.band==='hat').map(e=>e.audioTime)).toEqual([.01,.03]);
    expect(events.filter(e=>e.band==='kick')).toHaveLength(2);
    expect(events.filter(e=>e.band==='clap')).toHaveLength(2);
  });
  it('clears pending peaks after an input discontinuity', () => {
    const classifier = new CausalPercussionClassifier();
    classifier.push([.1,0,0,0,0,.05],0); classifier.push([.9,0,0,0,0,.05],.01);
    expect(classifier.push([.1,0,0,0,0,.05],4).events).toEqual([]);
  });
});
