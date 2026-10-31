// Source-delay candidate only. One audible branch; a route change fades the old
// branch out before the successor is heard, so the two never overlap (no echo).
// Analysis connections on source are never disconnected.
export const OUTPUT_FADE_SECONDS = .012;
// Timers are not sample-accurate; release only after the ramp has rendered.
const RELEASE_MARGIN_MS = 25;

export function createSmoothAudioOutput(context, source, { fade = OUTPUT_FADE_SECONDS, schedule = setTimeout } = {}) {
  let route, generation = 0;
  const retiring = new Set();
  const rendering = () => context.state === 'running';
  function release(previous) {
    if (previous.released) return;
    previous.released = true;
    retiring.delete(previous);
    try { source.disconnect(previous.delay || previous.gain); } catch { /* Already released. */ }
    previous.delay?.disconnect();
    previous.gain.disconnect();
    previous.done();
  }
  // Returns whether the retired branch was audible, and a promise for its release.
  function retire() {
    const previous = route;
    route = undefined;
    if (!previous) return { audible: false, released: Promise.resolve() };
    const gain = previous.gain.gain, now = context.currentTime;
    const audible = rendering() && gain.value > 0 && !previous.muted;
    const released = new Promise(done => { previous.done = done; });
    gain.cancelScheduledValues?.(now);
    if (audible && gain.linearRampToValueAtTime) {
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + fade);
      retiring.add(previous);
      schedule(() => release(previous), Math.ceil(fade * 1000) + RELEASE_MARGIN_MS);
    } else {
      gain.setValueAtTime?.(0, now);
      gain.value = 0;
      release(previous);
    }
    return { audible, released };
  }
  return {
    replace(bufferMs = 0, { muted = false } = {}) {
      if (!Number.isFinite(bufferMs) || bufferMs < 0 || bufferMs > 500) throw new RangeError('Invalid output delay');
      // A DelayNode cannot be flushed. Retire it; its successor starts empty.
      const { audible } = retire();
      const gain = context.createGain();
      gain.gain.value = 0;
      const delay = bufferMs ? context.createDelay(.5) : undefined;
      try {
        if (delay) { delay.delayTime.value = bufferMs / 1000; source.connect(delay); delay.connect(gain); }
        else source.connect(gain);
        gain.connect(context.destination);
      } catch (error) {
        try { source.disconnect(delay || gain); } catch { /* Connection was not established. */ }
        delay?.disconnect(); gain.disconnect();
        throw error;
      }
      route = { gain, delay, muted, generation: ++generation };
      if (muted) return;
      const now = context.currentTime, param = gain.gain;
      if (!rendering() || !param.linearRampToValueAtTime) { param.value = 1; return; }
      // Undelayed successors wait for the old fade; delayed ones start silent anyway.
      const start = now + (audible && !delay ? fade : 0);
      param.setValueAtTime(0, start);
      param.linearRampToValueAtTime(1, start + fade);
    },
    // Fades the audible branch, then disconnects it exactly once.
    stop: () => retire().released,
    snapshot: () => ({ connected: Boolean(route), generation, delayNodePresent: Boolean(route?.delay),
      configuredDelayMs: route?.delay ? route.delay.delayTime.value * 1000 : 0, gain: route?.gain.gain.value ?? 0,
      muted: Boolean(route?.muted), retiring: retiring.size, fadeMs: fade * 1000 }),
  };
}
