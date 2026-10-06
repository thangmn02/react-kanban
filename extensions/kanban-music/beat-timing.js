// Output deadlines cross realms as epoch milliseconds. The public music event
// uses song seconds and its audible playback-clock anchor, not arrival time.
export function outputTiming(context, targetAudioTime, monitorOnly = false) {
  if (!Number.isFinite(context.currentTime) || !Number.isFinite(targetAudioTime)) return undefined;

  let output;
  try { output = !monitorOnly && context.getOutputTimestamp?.(); }
  catch { /* Unsupported output-clock capabilities use the sampled boundary. */ }
  const targetOutputTime = output && Number.isFinite(output.contextTime) && Number.isFinite(output.performanceTime) && output.performanceTime > 0
    ? Date.now() - performance.now() + output.performanceTime
      + (targetAudioTime - (context.baseLatency || 0) - (context.outputLatency || 0) - output.contextTime) * 1000
    : Date.now() + (targetAudioTime - context.currentTime) * 1000;

  return { targetOutputTime };
}

export function audibleClock(clock, delaySeconds = 0) {
  const validNumbers = clock
    && [clock.currentTime, clock.playbackRate, clock.sampledAt].every(Number.isFinite);
  if (!validNumbers || clock.currentTime < 0 || clock.playbackRate <= 0 || clock.playbackRate > 16) {
    return undefined;
  }

  const currentTime = clock.currentTime - delaySeconds * clock.playbackRate;
  return {
    playing: clock.playing,
    paused: clock.paused,
    playbackRate: clock.playbackRate,
    ...(typeof clock.seeking === 'boolean' ? { seeking: clock.seeking } : {}),
    ...(typeof clock.buffering === 'boolean' ? { buffering: clock.buffering } : {}),
    ...(Number.isSafeInteger(clock.generation) && clock.generation >= 0 ? { generation: clock.generation } : {}),
    currentTime: Math.max(0, currentTime),
    sampledAt: clock.sampledAt + Math.max(0, -currentTime / clock.playbackRate) * 1000,
  };
}

// HTML media is authoritative for both tab capture and native monitoring.
// Old companions lack lifecycle flags and use sampled-clock discontinuities.
export function parsePlaybackClock(clock) {
  if (!clock || typeof clock.playing !== 'boolean' || typeof clock.paused !== 'boolean') {
    return undefined;
  }

  const parsed = audibleClock(clock);
  if (!parsed || clock.sampledAt < 0
    || ['seeking', 'buffering'].some(key => clock[key] !== undefined && typeof clock[key] !== 'boolean')
    || clock.generation !== undefined && (!Number.isSafeInteger(clock.generation) || clock.generation < 0)) {
    return undefined;
  }

  return parsed;
}

export function clockAdvancing(clock) {
  return Boolean(clock?.playing && !clock.paused && !clock.seeking && !clock.buffering);
}

export function playbackPosition(clock, now = Date.now()) {
  return clock.currentTime + (clockAdvancing(clock) ? Math.max(0, now - clock.sampledAt) / 1000 * clock.playbackRate : 0);
}

export function clockDiscontinuity(previous, next) {
  if (!previous) return false;
  if (next.seeking && !previous.seeking || next.generation !== undefined
    && previous.generation !== undefined && next.generation !== previous.generation) return true;
  return clockAdvancing(previous) && clockAdvancing(next)
    && Math.abs(next.currentTime - playbackPosition(previous, next.sampledAt)) > .75;
}

export function playbackTiming(clock, timing, delaySeconds = 0) {
  const playbackClock = audibleClock(clock, delaySeconds);
  if (!playbackClock || !Number.isFinite(timing?.targetOutputTime)) return undefined;

  const targetPlaybackTime = Math.max(0, playbackClock.currentTime
    + (timing.targetOutputTime - playbackClock.sampledAt) / 1000 * playbackClock.playbackRate);
  return { targetPlaybackTime, playbackClock };
}

export function playbackTraces(traces, timing, targetOutputTime) {
  return traces?.map((trace) => ({
    ...trace,
    ...(timing ? { targetPlaybackTime: timing.targetPlaybackTime } : {}),
    ...(Number.isFinite(targetOutputTime)
      ? { targetTime: targetOutputTime, targetClock: 'epoch-ms' }
      : {}),
  }));
}

export function parsePlaybackTiming(value) {
  const clock = parsePlaybackClock(value?.playbackClock);
  if (!Number.isFinite(value?.targetPlaybackTime) || value.targetPlaybackTime < 0 || !clock) {
    return undefined;
  }

  return { targetPlaybackTime: value.targetPlaybackTime, playbackClock: clock };
}

export function playbackDeadline({ targetPlaybackTime, playbackClock }) {
  return playbackClock.sampledAt + (targetPlaybackTime - playbackClock.currentTime) / playbackClock.playbackRate * 1000;
}
