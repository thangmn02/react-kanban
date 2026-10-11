export const LEAD_AUDIO_VERSION = 'server-lead-pulse-range-v1';
export const LEAD_AUDIO_FRAMES = 8820;

export async function createLeadAudioTap({ context, source, Node = globalThis.AudioWorkletNode }) {
  if (context.sampleRate !== 44100 || !context.audioWorklet || !Node) return null;
  await context.audioWorklet.addModule(new URL('./lead-audio-worklet.js', import.meta.url));
  const node = new Node(context, 'kora-lead-audio');
  let packet;
  node.port.onmessage = ({ data }) => {
    packet?.samples.fill(0);
    packet = undefined;
    if (data.samples instanceof ArrayBuffer && data.samples.byteLength === LEAD_AUDIO_FRAMES * 2
      && Number.isSafeInteger(data.sequence) && data.sequence > 0 && Number.isFinite(data.endTime) && data.endTime >= 0) {
      packet = { sequence: data.sequence, endTime: data.endTime, samples: new Uint8Array(data.samples) };
    }
    node.port.postMessage('ack');
  };
  source.connect(node); node.connect(context.destination);
  return {
    read() {
      const value = packet; packet = undefined;
      if (!value) return;
      let binary = '';
      for (const byte of value.samples) binary += String.fromCharCode(byte);
      const pcm = btoa(binary);
      value.samples.fill(0);
      return { sequence: value.sequence, endTime: value.endTime, pcm };
    },
    stop() {
      packet?.samples.fill(0); packet = undefined;
      node.port.onmessage = null; node.port.close(); node.disconnect();
      try { source.disconnect(node); } catch { /* The original graph may already be closed. */ }
    },
  };
}
