import { BeatDetector } from './beat-detector.js';

// Chrome's documented offscreen recipe uses both constraints with the same ID.
// Video tracks are stopped immediately and are never rendered or analyzed.
export function tabConstraints(streamId) {
  const mandatory = { chromeMediaSource: 'tab', chromeMediaSourceId: streamId };
  return { audio: { mandatory: { ...mandatory } }, video: { mandatory: { ...mandatory } } };
}

export function createCaptureEngine({ getUserMedia, createAudioContext, onBeat, onStop,
  now = () => performance.now(), schedule = setInterval, cancel = clearInterval }) {
  let generation = 0;
  let active;
  let requestedId;

  function stop(reason = 'stopped') {
    generation++;
    requestedId = undefined;
    const previous = active;
    active = undefined;
    if (!previous) return;
    cancel(previous.interval);
    previous.stream.getTracks().forEach((track) => track.stop());
    previous.source?.disconnect();
    previous.analyser?.disconnect();
    void previous.context?.close().catch(() => {});
    onStop(previous.captureId, reason);
  }

  async function start(streamId, captureId) {
    stop('replaced');
    const request = ++generation;
    requestedId = captureId;
    let stream;
    try {
      stream = await getUserMedia(tabConstraints(streamId));
      if (request !== generation) { stream.getTracks().forEach((track) => track.stop()); return false; }
      stream.getVideoTracks().forEach((track) => track.stop());
      if (!stream.getAudioTracks().length) throw new Error('No audio track');
      const state = { stream, captureId, leaseUntil: now() + 6000, lastAudio: now(), interval: undefined };
      active = state;
      state.context = createAudioContext();
      state.source = state.context.createMediaStreamSource(stream);
      state.analyser = state.context.createAnalyser();
      state.analyser.fftSize = 2048;
      state.analyser.smoothingTimeConstant = 0;
      state.source.connect(state.analyser);
      // Capturing suppresses normal tab output. Restore it exactly once.
      state.source.connect(state.context.destination);
      await state.context.resume();
      if (request !== generation) return false;
      if (state.context.state !== 'running') throw new Error('Audio context unavailable');
      const detector = new BeatDetector(state.context.sampleRate);
      const spectrum = new Float32Array(state.analyser.frequencyBinCount);
      stream.getAudioTracks().forEach((track) => track.addEventListener('ended', () => {
        if (active === state) stop('ended');
      }, { once: true }));
      // Offscreen documents have no visible animation frame. Sample at 60 Hz
      // with a timer while the audio graph runs, reusing all FFT buffers.
      state.interval = schedule(() => {
        if (active !== state) return;
        const time = now();
        if (time > state.leaseUntil || state.context.state !== 'running') { stop('expired'); return; }
        state.analyser.getFloatFrequencyData(spectrum);
        const result = detector.analyze(spectrum, time);
        if (result.audible) state.lastAudio = time;
        if (time - state.lastAudio > 2500) { stop('silent'); return; }
        if (result.hits.length) onBeat(captureId, result.hits);
      }, 1000 / 60);
      return true;
    } catch {
      if (request === generation) {
        if (active) stop('failed');
        else { stream?.getTracks().forEach((track) => track.stop()); onStop(captureId, 'failed'); }
      } else stream?.getTracks().forEach((track) => track.stop());
      return false;
    }
  }

  return { start, stop, stopCapture(captureId) { if (requestedId === captureId) stop(); }, renew(captureId) {
    if (active?.captureId !== captureId || active.context?.state !== 'running'
      || !active.stream.getAudioTracks().some((track) => track.readyState === 'live')) return false;
    active.leaseUntil = now() + 6000;
    return true;
  } };
}
