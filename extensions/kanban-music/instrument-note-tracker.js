const binHz = 44100 / 4096;
const cosine = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0)
  / Math.max(1e-9, Math.hypot(...a) * Math.hypot(...b));

// Select one harmonic voice from the isolated instrumental stem. A retained
// harmonic profile prevents a quieter accompaniment from stealing each note.
// Sequence counts attacks (including repeated pitches), never sustain frames.
export class InstrumentNoteTracker {
  constructor() {
    this.note = 0; this.active = false; this.lastNoteAt = -Infinity; this.lastAttackEnergy = 0;
    this.lastSeen = -Infinity; this.lastPublish = -Infinity; this.previousEnergy = 0;
    this.profile = null; this.pitch = null; this.candidatePitch = null; this.candidateFrames = 0;
  }
  analyze(spectrum, time, isolatedFraction = 1) {
    const candidates = [];
    let total = 0;
    for (let bin = 10; bin < 700; bin++) total += spectrum[bin] ** 2;
    for (let midi = 45; midi <= 96; midi++) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const harmonics = [];
      for (let h = 1; h <= 6; h++) {
        const bin = Math.round(hz * h / binHz);
        harmonics.push(bin < spectrum.length - 1 ? Math.max(spectrum[bin - 1], spectrum[bin], spectrum[bin + 1]) : 0);
      }
      const fundamental = harmonics[0];
      const score = harmonics.reduce((sum, value, h) => sum + value / (h + 1), 0);
      // Require a fundamental, not a subharmonic whose upper partials coincide.
      if (fundamental < score * .18) continue;
      const similarity = this.profile ? cosine(harmonics, this.profile) : 1;
      candidates.push({ midi, harmonics, score, similarity });
    }
    candidates.sort((a, b) => b.score - a.score);
    const strongest = candidates[0];
    // Adjacent MIDI candidates share FFT bins. Their ordering can swap as a
    // single piano note decays; keep the incumbent while its evidence is close.
    const incumbent = time - this.lastSeen < 80 ? candidates.find((candidate) => candidate.midi === this.pitch
      && candidate.similarity >= .8 && candidate.score >= (strongest?.score || 0) * .85) : null;
    const retained = this.profile && time - this.lastSeen < 600
      ? candidates.find((candidate) => candidate.similarity >= .88 && candidate.score >= (strongest?.score || 0) * .6) : null;
    const best = incumbent || retained || strongest;
    const energy = best?.score || 0;
    // Ignore inaudible separation residue as well as weak source assignment.
    const tonal = best && energy >= .3 && total > .002 && energy ** 2 > total * .035 && isolatedFraction >= .12;
    let attack = false;
    if (tonal && (!this.profile || time - this.lastSeen >= 600 || best.similarity >= .8)) {
      if (this.candidatePitch === best.midi) this.candidateFrames++;
      else { this.candidatePitch = best.midi; this.candidateFrames = 1; }
      const changedPitch = this.candidateFrames >= 2 && this.pitch !== best.midi;
      const rising = energy > Math.max(.02, this.previousEnergy * 1.45);
      // Separation can expose a faint tail or subharmonic just before the
      // full attack. Refine that attack's pitch as it grows, without flashing
      // again. Later pitch changes and repeated attacks remain independent.
      const refinement = changedPitch && time - this.lastNoteAt < 100 && energy > this.lastAttackEnergy * 4;
      if (refinement) this.pitch = best.midi;
      // A faint leading FFT window can favor a subharmonic before the attack
      // settles. Confirm its pitch before publishing so refinement is not
      // counted as another note.
      if (!refinement && this.candidateFrames >= 2 && time - this.lastNoteAt >= 55 && (changedPitch || rising || !this.active)) {
        this.note++; this.lastNoteAt = time; this.lastAttackEnergy = energy; attack = true; this.pitch = best.midi;
      }
      this.active = true; this.lastSeen = time;
      const norm = Math.max(1e-8, Math.hypot(...best.harmonics));
      const next = best.harmonics.map((value) => value / norm);
      this.profile = this.profile && best.similarity >= .8 ? next.map((value, i) => this.profile[i] * .9 + value * .1) : next;
    } else if (time - this.lastSeen >= 80) {
      this.active = false; this.candidateFrames = 0; this.candidatePitch = null;
    }
    const publish = attack || time - this.lastPublish >= 90 || (!this.active && this.wasActive);
    this.wasActive = this.active;
    this.previousEnergy = tonal ? energy : 0;
    if (!publish) return null;
    this.lastPublish = time;
    return { active: this.active, level: this.active ? Math.min(1, energy / 30) : 0, note: this.note };
  }
}
