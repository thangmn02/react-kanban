// One audible branch; analysis connections on source are never disconnected.
export function createDelayedAudioOutput(context, source) {
  let route,generation=0;
  function disconnect() {
    const previous = route;
    route = undefined;
    if (!previous) return;
    previous.gain.gain.cancelScheduledValues?.(context.currentTime);
    previous.gain.gain.setValueAtTime?.(0, context.currentTime);
    previous.gain.gain.value = 0;
    try { source.disconnect(previous.delay || previous.gain); } catch { /* Already released. */ }
    previous.delay?.disconnect();
    previous.gain.disconnect();
  }
  return {
    replace(bufferMs = 0,{muted=false}={}) {
      if (!Number.isFinite(bufferMs) || bufferMs < 0 || bufferMs > 500) throw new RangeError('Invalid output delay');
      // A DelayNode cannot be flushed. Detach it before constructing its successor.
      disconnect();
      const gain = context.createGain();
      gain.gain.value = 0;
      const delay = bufferMs ? context.createDelay(.5) : undefined;
      try {
        if (delay) { delay.delayTime.value = bufferMs / 1000; source.connect(delay); delay.connect(gain); }
        else source.connect(gain);
        gain.connect(context.destination);
        route = { gain, delay, generation:++generation };
        gain.gain.value = muted?0:1;
      } catch (error) {
        try { source.disconnect(delay || gain); } catch { /* Connection was not established. */ }
        delay?.disconnect(); gain.disconnect();
        throw error;
      }
    },
    stop: disconnect,
    snapshot:()=>({connected:Boolean(route),generation,delayNodePresent:Boolean(route?.delay),
      configuredDelayMs:route?.delay?route.delay.delayTime.value*1000:0,gain:route?.gain.gain.value??0}),
  };
}
