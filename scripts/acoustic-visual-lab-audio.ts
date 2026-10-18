import type { Clip } from './acoustic-visual-lab-core';
export class LabAudio {
  context?: AudioContext;
  buffer?: AudioBuffer;
  node?: AudioBufferSourceNode;
  clip?: Clip;
  position = 0;
  anchor = 0;
  playing = false;
  generation = 0;
  loadEpoch = 0;
  operationEpoch = 0;
  pendingPlay?: Promise<void>;
  get time() { return this.clip ? this.clip.sourceOffset + this.position + (this.playing ? Math.max(0, this.context!.currentTime - this.anchor) : 0) : 0; }
  async load(clip: Clip) {
    const epoch = ++this.loadEpoch;
    this.pause(); this.buffer = undefined; this.clip = undefined;
    if (!this.context || this.context.state === 'closed') this.context = new AudioContext({ sampleRate: 44100 });
    const response = await fetch(clip.audioUrl); if (!response.ok) throw Error('Audio unavailable');
    if (epoch !== this.loadEpoch) return false;
    const bytes = await response.arrayBuffer();
    if (epoch !== this.loadEpoch) return false;
    const hex = async (data: ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (await hex(bytes) !== clip.canonicalWavSha256) throw Error('WAV identity changed');
    if (epoch !== this.loadEpoch) return false;
    const buffer = await this.context.decodeAudioData(bytes.slice(0));
    if (epoch !== this.loadEpoch) return false;
    if (buffer.sampleRate !== clip.sampleRate) throw Error('Unexpected browser resampling; comparison stopped');
    const pcm = new DataView(new ArrayBuffer(buffer.length * buffer.numberOfChannels * 4));
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    for (let frame = 0; frame < buffer.length; frame++) for (let channel = 0; channel < channels.length; channel++) pcm.setFloat32((frame * channels.length + channel) * 4, channels[channel][frame], true);
    if (await hex(pcm.buffer) !== clip.decodedPcmSha256) throw Error('Browser decoded PCM differs; comparison stopped');
    if (epoch !== this.loadEpoch) return false;
    this.clip = clip; this.buffer = buffer; this.position = clip.start - clip.sourceOffset; this.generation++;
    return true;
  }
  async play() {
    if (!this.context || !this.buffer || !this.clip || this.playing) return;
    if (this.pendingPlay) return this.pendingPlay;
    const epoch = ++this.operationEpoch, context = this.context, buffer = this.buffer, clip = this.clip;
    const pending = (async () => {
      await context.resume();
      if (epoch !== this.operationEpoch || this.context !== context || this.buffer !== buffer || this.clip !== clip || this.playing) return;
      if (this.time >= clip.end) this.position = clip.start - clip.sourceOffset;
      const node = context.createBufferSource(); node.buffer = buffer; node.connect(context.destination);
      this.node = node; this.anchor = context.currentTime + .05; node.start(this.anchor, this.position); this.playing = true; this.generation++;
    })();
    this.pendingPlay = pending;
    try { await pending; } finally { if (this.pendingPlay === pending) this.pendingPlay = undefined; }
  }
  pause() {
    this.operationEpoch++; this.pendingPlay = undefined;
    if (this.playing) this.position += Math.max(0, this.context!.currentTime - this.anchor);
    this.playing = false; this.node?.stop(); this.node?.disconnect(); this.node = undefined; this.generation++;
  }
  seek(sourceTime: number) {
    const resume = this.playing || Boolean(this.pendingPlay); this.pause();
    if (this.clip) this.position = Math.max(this.clip.start, Math.min(this.clip.end, sourceTime)) - this.clip.sourceOffset;
    if (resume) return this.play();
  }
  close() { this.loadEpoch++; this.pause(); void this.context?.close(); }
}
