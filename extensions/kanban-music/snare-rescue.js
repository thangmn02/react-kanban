// Snare rescue. A quiet snare that the model scores just under the snare line is kept only when
// the song's confident snares are sparse and the quiet hit lands where those confident snares land in the beat.
// Busy or syncopated songs (many confident snares, or near-misses off the snare beat) are left exactly as they are.
// On from Companion 0.3.39, after the owner compared TEST 2 (floor 0.03) with 0.3.38 by ear.
export const snareRescueEnabled = true;

export const SNARE_RESCUE = Object.freeze({
  floor: .03,              // lowest snare novelty that can be rescued (the normal line is .24)
  windowSeconds: 24,       // confident kicks and snares remembered for tempo and snare position
  maxRatePerMinute: 45,    // above this many confident snares a minute, nothing is rescued
  minConfident: 3,         // confident snares needed before their beat position is trusted
  minOnsets: 8,            // confident kicks + snares needed for a tempo
  minCoherence: .2,        // how well those onsets fit one beat grid (0 none, 1 perfect)
  tolerance: 1 / 12,       // how close, as a share of two beats, a quiet hit must be to the confident snares
  minShare: .25,           // share of confident snares that must sit at that position
  minGapSeconds: .15,      // never rescue right after another snare
});

const wrap = value => value - Math.round(value);

export class SnareRescue {
  constructor(options = {}) {
    this.options = { ...SNARE_RESCUE, ...options };
    this.reset();
  }

  reset() {
    this.kicks = [];
    this.snares = [];
    this.lastSnare = -Infinity;
    this.startTime = undefined;
    this.grid = undefined;
  }

  prune(time) {
    const after = time - this.options.windowSeconds;
    while (this.kicks.length && this.kicks[0] < after) { this.kicks.shift(); this.grid = undefined; }
    while (this.snares.length && this.snares[0] < after) { this.snares.shift(); this.grid = undefined; }
  }

  /** A confident (above the normal line) kick or snare. */
  observe(band, time) {
    if (!Number.isFinite(time) || (band !== 'kick' && band !== 'clap')) return;
    this.startTime ??= time;
    (band === 'kick' ? this.kicks : this.snares).push(time);
    if (band === 'clap') this.lastSnare = Math.max(this.lastSnare, time);
    this.grid = undefined;
  }

  /** A rescued snare, so the next rescue keeps its distance. */
  noteRescued(time) { if (Number.isFinite(time)) this.lastSnare = Math.max(this.lastSnare, time); }

  /** Beat period from a comb over confident onsets: the period they line up on best. */
  beatGrid() {
    if (this.grid !== undefined) return this.grid;
    const onsets = [...this.kicks, ...this.snares];
    this.grid = null;
    if (onsets.length < this.options.minOnsets) return null;
    let best = null;
    for (let period = .33; period <= 1; period += .002) {
      let re = 0, im = 0;
      for (const time of onsets) { const angle = 2 * Math.PI * time / period; re += Math.cos(angle); im += Math.sin(angle); }
      const coherence = Math.hypot(re, im) / onsets.length;
      if (!best || coherence > best.coherence) best = { period, coherence };
    }
    if (best.coherence >= this.options.minCoherence) this.grid = best;
    return this.grid;
  }

  /** Why a quiet snare at `time` is or is not rescued; `accepted` is the decision. */
  judge(time) {
    const o = this.options;
    this.prune(time);
    const confident = this.snares.length;
    const span = Math.max(8, Math.min(o.windowSeconds, time - (this.startTime ?? time)));
    const ratePerMinute = confident * 60 / span;
    if (confident < o.minConfident) return { accepted: false, reason: 'too-few-snares', ratePerMinute };
    if (ratePerMinute > o.maxRatePerMinute) return { accepted: false, reason: 'busy-song', ratePerMinute };
    if (time - this.lastSnare < o.minGapSeconds) return { accepted: false, reason: 'too-close', ratePerMinute };
    const grid = this.beatGrid();
    if (!grid) return { accepted: false, reason: 'no-tempo', ratePerMinute };
    const cycle = 2 * grid.period, phase = time / cycle;
    const near = this.snares.filter(snare => Math.abs(wrap(snare / cycle - phase)) <= o.tolerance).length;
    const share = near / confident;
    const accepted = near >= 2 && share >= o.minShare;
    return { accepted, reason: accepted ? 'on-snare-beat' : 'off-snare-beat', ratePerMinute, share, period: grid.period };
  }

  accepts(time) { return this.judge(time).accepted; }
}
