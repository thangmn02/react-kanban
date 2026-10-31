import { proposeLayers, PROPOSAL_METHOD, SUGGESTION_METHOD } from './proposals.js';

const $ = id => document.getElementById(id), canvas = $('canvas'), g = canvas.getContext('2d');
const LANES = { main: [0, 330], ghosts: [334, 352], taps: [362, 386], c5: [394, 416], c6: [424, 446], lead: [458, 490], listened: [500, 512], axis: [518, 560] };
const STATUS_COLOR = { unreviewed: '--pending', accepted: '--accept', rejected: '--reject', uncertain: '--uncertain' };
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const LEAD_MAP = { vocal: 'Vocal', synth: 'Synth/Electronic', piano: 'Piano', guitar: 'Guitar', sampled: 'Other', other: 'Other', none: 'No Clear Lead' };

let audio = null;          // { buffer, file, sha256, duration, sampleRate }
let doc = null;            // the annotation being edited
let draft = null;          // imported tap draft (kora-lead-labels-v1)
let view = { t0: 0, t1: 1 }, selected = null, range = null, drag = null, specImage = null, candidates = null;
let suggestions = [], ctx = null, playing = null, playhead = 0, history = [], future = [];

const now = () => new Date().toISOString();
const inRegion = t => doc && t >= doc.region.start && t < doc.region.end;
const storageKey = () => doc && `leadAnno:${doc.audio.sha256}:${doc.region.start.toFixed(2)}:${doc.region.end.toFixed(2)}`;
const save = () => { try { localStorage.setItem(storageKey(), JSON.stringify(doc)); } catch { /* Private mode: export still works. */ } };
function mutate(fn) { history.push(JSON.stringify({ markers: doc.markers, leadRegions: doc.leadRegions })); if (history.length > 200) history.shift(); future = []; fn(); save(); render(); }
function restore(from, to) { if (!from.length) return; to.push(JSON.stringify({ markers: doc.markers, leadRegions: doc.leadRegions })); Object.assign(doc, JSON.parse(from.pop())); save(); render(); }

// ---------- audio ----------
async function sha256(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function loadAudio(bytes, name) {
  ctx ||= new AudioContext();
  const hash = await sha256(bytes), buffer = await ctx.decodeAudioData(bytes.slice(0));
  stop(); doc = null; draft = null; candidates = null; specImage = null; suggestions = []; selected = null; range = null; history = []; future = []; playhead = 0;
  $('play').disabled = true;
  audio = { buffer, file: name, sha256: hash, duration: buffer.duration, sampleRate: buffer.sampleRate };
  render();
  $('audioInfo').textContent = `${name} · ${buffer.duration.toFixed(1)} s · SHA-256 ${hash.slice(0, 12)}…`;
  $('analyse').disabled = false;
}
function mono(start, end) {
  const b = audio.buffer, s0 = Math.max(0, Math.floor(start * b.sampleRate)), s1 = Math.min(b.length, Math.ceil(end * b.sampleRate)), out = new Float32Array(s1 - s0);
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < out.length; i++) out[i] += d[s0 + i] / b.numberOfChannels; }
  return { samples: out, offset: s0 / b.sampleRate };
}

// ---------- analysis ----------
async function analyse() {
  const start = Math.max(0, +$('start').value), end = Math.min(audio.duration, start + Math.min(30, Math.max(10, +$('length').value)));
  const key = `leadAnno:${audio.sha256}:${start.toFixed(2)}:${end.toFixed(2)}`;
  let stored; try { stored = JSON.parse(localStorage.getItem(key)); } catch { /* none */ }
  const pre = .5, { samples, offset } = mono(start - pre, end), layers = proposeLayers(samples, audio.sampleRate, { minHz: +$('bandLo').value, maxHz: +$('bandHi').value }), result = layers.strong;
  specImage = spectrogramImage(result.spectrogram, offset);
  suggestions = layers.suggestions.map(o => ({ time: +(offset + o.time).toFixed(4), pitchMidi: o.pitchMidi })).filter(o => o.time >= start && o.time < end);
  if (stored?.version === 'kora-lead-annotation-v1') doc = stored;
  else {
    doc = { version: 'kora-lead-annotation-v1', audio: { file: audio.file, sha256: audio.sha256, duration: audio.duration, sampleRate: audio.sampleRate },
      region: { start, end }, proposalMethod: PROPOSAL_METHOD, suggestionMethod: { ...SUGGESTION_METHOD, minHz: +$('bandLo').value, maxHz: +$('bandHi').value }, created: now(), markers: [], leadRegions: [], listened: new Array(Math.ceil((end - start) / .05)).fill(0), draftImport: null };
    let id = 1;
    for (const o of result.onsets) { const t = +(offset + o.time).toFixed(4); if (inRegion(t)) doc.markers.push({ id: id++, time: t, originalTime: t, origin: 'proposal', status: 'unreviewed', pitchMidi: o.pitchMidi, strength: +o.strength.toFixed(3) }); }
    if (draft) mergeDraft();
  }
  view = { t0: doc.region.start, t1: Math.min(doc.region.end, doc.region.start + 6) }; history = []; future = []; selected = doc.markers[0]?.id ?? null; candidates = null;
  if ($('showCandidates').checked) await runCandidates();
  save(); render(); $('play').disabled = false;
}
/** Draft taps help review but are never verified: they mark agreeing proposals, or become unreviewed markers. */
function mergeDraft() {
  if (!doc || !draft) return;
  const taps = draft.taps.filter(inRegion); let id = Math.max(0, ...doc.markers.map(m => m.id)) + 1;
  for (const t of taps) {
    const near = doc.markers.filter(m => m.origin === 'proposal').sort((a, b) => Math.abs(a.time - t) - Math.abs(b.time - t))[0];
    if (near && Math.abs(near.time - t) <= .06 && near.draftTap === undefined) { near.draftTap = t; continue; }
    const ghost = suggestions.filter(o => Math.abs(o.time - t) <= .06).sort((a, b) => Math.abs(a.time - t) - Math.abs(b.time - t))[0];
    if (ghost) { suggestions = suggestions.filter(o => o !== ghost); doc.markers.push({ id: id++, time: ghost.time, originalTime: ghost.time, origin: 'suggestion', status: 'unreviewed', pitchMidi: ghost.pitchMidi, draftTap: t }); continue; }
    doc.markers.push({ id: id++, time: t, originalTime: t, origin: 'draft-tap', status: 'unreviewed' });
  }
  doc.markers.sort((a, b) => a.time - b.time);
  const sections = (draft.sections || []).map((s, i, all) => ({ start: s.time, end: all[i + 1]?.time ?? audio.duration, label: LEAD_MAP[s.source] || 'Unknown' }))
    .filter(s => s.end > doc.region.start && s.start < doc.region.end).map(s => ({ ...s, start: Math.max(s.start, doc.region.start), end: Math.min(s.end, doc.region.end), draft: true }));
  if (!doc.leadRegions.length) doc.leadRegions = sections;
  doc.draftImport = { file: draft.file, sha256: draft.sha256, tapsInRegion: taps.length, note: 'owner key-press taps; unreviewed draft, not ground truth' };
}
async function runCandidates() {
  // Comparison lanes only: never merged into the human reference.
  try {
    const [{ createLeadTracker }, { createLeadContourTracker }] = await Promise.all([import('/ext/lead-tracker.js'), import('/ext/lead-contour-tracker.js')]);
    const warm = 2, { samples, offset } = mono(doc.region.start - warm, doc.region.end), lanes = {};
    for (const [name, make] of [['c5', createLeadTracker], ['c6', createLeadContourTracker]]) {
      const tracker = make(audio.sampleRate), times = [];
      for (let i = 0; i < samples.length; i += 128) for (const e of tracker.push(samples.subarray(i, i + 128), offset + Math.min(samples.length, i + 128) / audio.sampleRate)) if (inRegion(e.audioTime)) times.push(e.audioTime);
      lanes[name] = times;
    }
    candidates = lanes;
  } catch { candidates = { error: 'Candidate modules unavailable on this page' }; }
}
function spectrogramImage(s, offset) {
  const img = new ImageData(s.frames, 256), { mag, frames, bins } = s;
  let max = 0; for (const v of mag) if (v > max) max = v;
  for (let f = 0; f < frames; f++) for (let y = 0; y < 256; y++) {
    // Log-frequency rows from 150 Hz to 5 kHz.
    const hz = 150 * (5000 / 150) ** (1 - y / 255), k = Math.min(bins - 1, Math.max(0, Math.round(hz / s.hzPerBin) - s.k0));
    const v = Math.min(1, Math.log1p(60 * mag[f * bins + k] / max) / Math.log1p(60)), i = (y * frames + f) * 4;
    img.data[i] = 20 + 235 * v ** 1.4; img.data[i + 1] = 30 + 180 * v; img.data[i + 2] = 60 + 120 * (1 - v); img.data[i + 3] = 255;
  }
  const off = new OffscreenCanvas(frames, 256); off.getContext('2d').putImageData(img, 0, 0);
  return { canvas: off, t0: offset + s.frameTime(0), t1: offset + s.frameTime(frames - 1) };
}

// ---------- drawing ----------
const X = t => (t - view.t0) / (view.t1 - view.t0) * canvas.width, T = x => view.t0 + x / canvas.width * (view.t1 - view.t0);
function render() {
  const w = canvas.width; g.clearRect(0, 0, w, canvas.height);
  if (!doc) { g.fillStyle = css('--muted'); g.font = '28px system-ui'; g.fillText('Load an audio file, choose a region, then Analyse region.', 30, 60); return; }
  const [m0, m1] = LANES.main;
  if ($('view').value === 'spec' && specImage) {
    const sx = (view.t0 - specImage.t0) / (specImage.t1 - specImage.t0) * specImage.canvas.width, sw = (view.t1 - view.t0) / (specImage.t1 - specImage.t0) * specImage.canvas.width;
    g.imageSmoothingEnabled = false; g.drawImage(specImage.canvas, sx, 0, sw, 256, 0, m0, w, m1 - m0);
  } else {
    const b = audio.buffer, d = b.getChannelData(0), sr = b.sampleRate; g.strokeStyle = css('--wave'); g.beginPath();
    for (let x = 0; x < w; x += 2) { const a = Math.floor(T(x) * sr), z = Math.floor(T(x + 2) * sr); let lo = 0, hi = 0; for (let i = a; i < z; i += 4) { const v = d[i] || 0; if (v < lo) lo = v; if (v > hi) hi = v; }
      const mid = (m0 + m1) / 2, h = (m1 - m0) / 2; g.moveTo(x, mid - hi * h); g.lineTo(x, mid - lo * h); }
    g.stroke();
  }
  if (range) { g.fillStyle = 'rgba(37,99,235,.18)'; g.fillRect(X(Math.min(range.a, range.b)), m0, X(Math.max(range.a, range.b)) - X(Math.min(range.a, range.b)), m1 - m0); }
  for (const m of doc.markers) {
    const x = X(m.time); if (x < -10 || x > w + 10) continue;
    // Unreviewed markers are light so they read on the spectrogram; every line gets a dark outline.
    const color = m.status === 'unreviewed' && $('view').value === 'spec' ? '#f1f5f9' : css(STATUS_COLOR[m.status]), sel = m.id === selected;
    g.globalAlpha = m.status === 'rejected' ? .5 : 1;
    g.setLineDash(m.status === 'unreviewed' ? [7, 5] : []);
    g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = sel ? 7 : 5; g.beginPath(); g.moveTo(x, m0 + 18); g.lineTo(x, m1); g.stroke();
    g.strokeStyle = color; g.lineWidth = sel ? 4 : 2.5; g.beginPath(); g.moveTo(x, m0 + 18); g.lineTo(x, m1); g.stroke(); g.setLineDash([]);
    g.fillStyle = color; g.beginPath();
    if (m.origin === 'proposal' || m.origin === 'suggestion') g.arc(x, m0 + 10, sel ? 9 : 7, 0, 7); else if (m.origin === 'draft-tap') { g.moveTo(x, m0 + 2); g.lineTo(x - 8, m0 + 17); g.lineTo(x + 8, m0 + 17); } else g.rect(x - 7, m0 + 3, 14, 14);
    g.fill(); if (sel) { g.strokeStyle = css('--select'); g.lineWidth = 3; g.stroke(); } g.globalAlpha = 1;
  }
  { const [y0, y1] = LANES.ghosts; g.fillStyle = css('--muted'); g.globalAlpha = .55; for (const o of suggestions) { const x = X(o.time); g.beginPath(); g.moveTo(x, y0); g.lineTo(x - 6, y1); g.lineTo(x + 6, y1); g.fill(); } g.globalAlpha = 1; g.font = '17px system-ui'; g.fillText('Suggestions (click to add)', 6, y0 + 14); }
  lane('taps', 'Draft taps', $('showTaps').checked ? doc.markers.flatMap(m => m.draftTap !== undefined ? [m.draftTap] : m.origin === 'draft-tap' ? [m.originalTime] : []) : null, '#a855f7');
  lane('c5', 'Candidate-5', $('showCandidates').checked && candidates?.c5 ? candidates.c5 : null, '#0ea5e9');
  lane('c6', 'Candidate-6', $('showCandidates').checked && candidates?.c6 ? candidates.c6 : null, '#14b8a6');
  const [l0, l1] = LANES.lead; g.font = '20px system-ui';
  for (const r of doc.leadRegions) { const a = X(r.start), b = X(r.end); g.fillStyle = r.draft ? 'rgba(148,163,184,.35)' : 'rgba(22,163,74,.25)'; g.fillRect(a, l0, b - a, l1 - l0); g.fillStyle = css('--ink'); g.fillText(r.label + (r.draft ? ' (draft)' : ''), Math.max(a, 0) + 6, l1 - 8); }
  const [h0, h1] = LANES.listened, n = doc.listened.length;
  doc.listened.forEach((v, i) => { const a = X(doc.region.start + i * .05), b = X(doc.region.start + (i + 1) * .05); g.fillStyle = v ? css('--accept') : css('--line'); g.fillRect(a, h0, b - a + 1, h1 - h0); });
  g.fillStyle = css('--muted'); g.font = '20px system-ui';
  const step = niceStep((view.t1 - view.t0) / 12); for (let t = Math.ceil(view.t0 / step) * step; t < view.t1; t += step) { const x = X(t); g.fillRect(x, LANES.axis[0], 1, 8); g.fillText(t.toFixed(step < 1 ? 2 : 1) + 's', x + 3, LANES.axis[1] - 6); }
  g.fillStyle = css('--play'); g.fillRect(X(playhead) - 1, 0, 3, LANES.lead[1]);
  details(); progress(); void n;
}
function lane(key, label, times, color) {
  const [y0, y1] = LANES[key]; g.fillStyle = css('--muted'); g.font = '16px system-ui'; g.fillText(label, 6, y1 - 6);
  if (!times) return; g.fillStyle = color; for (const t of times) { const x = X(t); g.fillRect(x - 1.5, y0, 3, y1 - y0); }
}
const niceStep = s => [.05, .1, .25, .5, 1, 2, 5, 10].find(v => v >= s) || 10;
function details() {
  const m = doc.markers.find(x => x.id === selected), t = $('detail');
  if (!m) { t.innerHTML = '<tr><td>None selected</td><td></td></tr>'; return; }
  const note = m.pitchMidi ? ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m.pitchMidi % 12] + (Math.floor(m.pitchMidi / 12) - 1) : '—';
  t.innerHTML = `<tr><td>Time</td><td>${m.time.toFixed(3)} s</td></tr><tr><td>Moved by</td><td>${((m.time - m.originalTime) * 1000).toFixed(1)} ms</td></tr>
    <tr><td>Status</td><td>${m.status}${m.batch ? ' (batch)' : ''}</td></tr><tr><td>Origin</td><td>${m.origin === 'proposal' ? 'Onset proposal (' + PROPOSAL_METHOD.id + ')' : m.origin === 'suggestion' ? 'Band suggestion (' + SUGGESTION_METHOD.id + ')' : m.origin === 'draft-tap' ? 'Your earlier tap (draft)' : 'Added by you'}</td></tr>
    <tr><td>Draft tap nearby</td><td>${m.draftTap !== undefined ? ((m.draftTap - m.time) * 1000).toFixed(0) + ' ms' : '—'}</td></tr><tr><td>Pitch hint (rough)</td><td>${note}</td></tr>`;
  if (document.activeElement !== $('timeEdit')) $('timeEdit').value = m.time.toFixed(3);
}
function stats() {
  const c = { unreviewed: 0, accepted: 0, rejected: 0, uncertain: 0 }; for (const m of doc.markers) c[m.status]++;
  const listened = doc.listened.filter(Boolean).length / doc.listened.length, labelled = doc.leadRegions.some(r => !r.draft);
  return { ...c, listened, labelled, complete: c.unreviewed === 0 && listened >= .98 && labelled };
}
function progress() {
  const s = stats();
  $('progress').innerHTML = `<tr><td>Markers</td><td>${doc.markers.length}</td></tr><tr><td>Accepted / uncertain / rejected</td><td>${s.accepted} / ${s.uncertain} / ${s.rejected}</td></tr>
    <tr><td>Still unreviewed</td><td class="${s.unreviewed ? 'warn' : 'ok'}">${s.unreviewed}</td></tr><tr><td>Region listened</td><td class="${s.listened >= .98 ? 'ok' : 'warn'}">${(s.listened * 100).toFixed(0)}%</td></tr>
    <tr><td>Lead region labelled</td><td class="${s.labelled ? 'ok' : 'warn'}">${s.labelled ? 'yes' : 'not yet (draft only)'}</td></tr>
    <tr><td>Human-verified?</td><td class="${s.complete ? 'ok' : 'warn'}">${s.complete ? 'yes — complete review' : 'no — draft'}</td></tr>`;
}

// ---------- playback ----------
let clickBuffer;
function click(atCtx) {
  if (!clickBuffer) { clickBuffer = ctx.createBuffer(1, 220, ctx.sampleRate); const d = clickBuffer.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 2500 * i / ctx.sampleRate) * (1 - i / d.length) * .6; }
  const s = ctx.createBufferSource(); s.buffer = clickBuffer; s.connect(ctx.destination); s.start(atCtx); return s;
}
function play(from, to, loop) {
  stop(); ctx.resume();
  const rate = +$('rate').value, src = ctx.createBufferSource(); src.buffer = audio.buffer; src.playbackRate.value = rate; src.connect(ctx.destination);
  const at = ctx.currentTime + .05; src.start(at, from, (to - from)); const clicks = [];
  if ($('click').checked) for (const m of doc.markers) if (m.status !== 'rejected' && m.time >= from && m.time < to) clicks.push(click(at + (m.time - from) / rate));
  playing = { src, clicks, at, from, to, rate, loop, last: from };
  src.onended = () => { if (playing?.src !== src) return; const p = playing; playing = null; if (p.loop) play(p.from, p.to, true); else render(); };
  $('play').textContent = 'Pause ⏸';
}
function stop() { if (!playing) return; const p = playing; playing = null; try { p.src.stop(); } catch { /* ended */ } p.clicks.forEach(c => { try { c.stop(); } catch { /* ended */ } }); $('play').textContent = 'Play region ⏵'; }
function tick() {
  if (playing) {
    const t = playing.from + Math.max(0, ctx.currentTime - playing.at) * playing.rate; playhead = Math.min(playing.to, t);
    // Everything between the previous and current playhead counts as listened.
    for (let s = playing.last; s < playhead; s += .025) { const i = Math.floor((s - doc.region.start) / .05); if (i >= 0 && i < doc.listened.length) doc.listened[i] = 1; }
    playing.last = playhead; render();
  }
  requestAnimationFrame(tick);
}
const loopAround = m => play(Math.max(doc.region.start, m.time - .3), Math.min(doc.region.end, m.time + .5), true);

// ---------- review actions ----------
const sel = () => doc?.markers.find(m => m.id === selected);
function setStatus(status) { const m = sel(); if (!m) return; mutate(() => { m.status = status; m.reviewedAt = now(); delete m.batch; }); next(1, true); }
function next(dir, onlyUnreviewed = false) {
  const list = doc.markers, i = list.findIndex(m => m.id === selected);
  for (let j = i + dir; j >= 0 && j < list.length; j += dir) if (!onlyUnreviewed || list[j].status === 'unreviewed') { select(list[j]); return; }
  if (onlyUnreviewed) for (let j = i + dir; j >= 0 && j < list.length; j += dir) { select(list[j]); return; }
}
function select(m) {
  selected = m.id; playhead = m.time;
  const span = view.t1 - view.t0; if (m.time < view.t0 || m.time > view.t1) { view.t0 = Math.max(doc.region.start, m.time - span / 2); view.t1 = view.t0 + span; }
  if (playing?.loop) loopAround(m); render();
}
function moveSelected(seconds) { const m = sel(); if (!m) return; mutate(() => { m.time = +(m.time + seconds).toFixed(4); doc.markers.sort((a, b) => a.time - b.time); }); }
const TAP_LAG = .046, TAP_WINDOW = [.12, .02];
function addAtPlayhead() {
  if (!inRegion(playhead)) return;
  // Reaction lag is in real time; at slower speeds it covers less media time.
  const rate = playing ? playing.rate : 1, lo = playhead - TAP_WINDOW[0] * rate, hi = playhead + TAP_WINDOW[1] * rate;
  const tapped = +playhead.toFixed(4), pick = list => list.filter(x => x.time >= lo && x.time <= hi).sort((a, b) => Math.abs(playhead - TAP_LAG * rate - a.time) - Math.abs(playhead - TAP_LAG * rate - b.time))[0];
  const marker = pick(doc.markers.filter(m => m.status !== 'accepted' && m.origin !== 'manual')), ghost = marker ? null : pick(suggestions);
  if (marker) { mutate(() => { marker.status = 'accepted'; marker.reviewedAt = now(); marker.confirmedByTap = tapped; delete marker.batch; }); selected = marker.id; return; }
  const id = Math.max(0, ...doc.markers.map(m => m.id)) + 1;
  if (ghost) { suggestions = suggestions.filter(o => o !== ghost); mutate(() => { doc.markers.push({ id, time: ghost.time, originalTime: ghost.time, origin: 'suggestion', status: 'accepted', pitchMidi: ghost.pitchMidi, confirmedByTap: tapped, reviewedAt: now() }); doc.markers.sort((a, b) => a.time - b.time); }); selected = id; return; }
  // Nothing detected near the tap: keep it, lag-corrected, but as uncertain timing until you check it.
  const t = +(playhead - TAP_LAG * rate).toFixed(4);
  mutate(() => { doc.markers.push({ id, time: t, originalTime: t, origin: 'manual', status: 'uncertain', tappedAt: tapped, timing: 'tap, no onset found' }); doc.markers.sort((a, b) => a.time - b.time); }); selected = id;
}
/** Converts earlier free taps (added notes) the same way: snap to the onset just before, or mark timing uncertain. */
function snapMyTaps() {
  const taps = doc.markers.filter(m => m.origin === 'manual' && m.status === 'accepted' && !m.snapped);
  if (!taps.length || !confirm(`Snap ${taps.length} notes you added to the detected onset just before each (up to 120 ms)? Notes with no onset nearby become "uncertain" so you can check them.`)) return;
  mutate(() => { for (const tap of taps) {
    const lo = tap.time - TAP_WINDOW[0], hi = tap.time + TAP_WINDOW[1];
    const marker = doc.markers.filter(m => m !== tap && m.origin !== 'manual' && m.status !== 'accepted' && m.time >= lo && m.time <= hi).sort((a, b) => Math.abs(tap.time - TAP_LAG - a.time) - Math.abs(tap.time - TAP_LAG - b.time))[0];
    const ghost = marker ? null : suggestions.filter(o => o.time >= lo && o.time <= hi).sort((a, b) => Math.abs(tap.time - TAP_LAG - a.time) - Math.abs(tap.time - TAP_LAG - b.time))[0];
    if (marker) { marker.status = 'accepted'; marker.reviewedAt = now(); marker.confirmedByTap = tap.time; tap.remove = true; }
    else if (ghost) { suggestions = suggestions.filter(o => o !== ghost); doc.markers.push({ id: Math.max(...doc.markers.map(m => m.id)) + 1, time: ghost.time, originalTime: ghost.time, origin: 'suggestion', status: 'accepted', pitchMidi: ghost.pitchMidi, confirmedByTap: tap.time, reviewedAt: now() }); tap.remove = true; }
    else { tap.tappedAt = tap.time; tap.time = +(tap.time - TAP_LAG).toFixed(4); tap.status = 'uncertain'; tap.snapped = true; tap.timing = 'tap, no onset found'; }
  } doc.markers = doc.markers.filter(m => !m.remove).sort((a, b) => a.time - b.time); });
}
function resetRegion() {
  if (!doc || !confirm('Delete every marker and decision for this region and start it again from fresh proposals?')) return;
  try { localStorage.removeItem(storageKey()); } catch { /* none stored */ }
  doc = null; void analyse();
}
function rejectUnreviewed() {
  const left = doc.markers.filter(m => m.status === 'unreviewed'); if (!left.length) return;
  const heard = doc.listened.filter(Boolean).length / doc.listened.length;
  if (heard < .98) { alert('Listen to the whole region first, so remaining proposals are known to be wrong.'); return; }
  if (!confirm(`Reject the ${left.length} proposals you have not accepted? You listened to the whole region.`)) return;
  mutate(() => left.forEach(m => { m.status = 'rejected'; m.reviewedAt = now(); m.batch = true; }));
}
function removeSelected() { const m = sel(); if (!m || m.origin !== 'manual') return; mutate(() => { doc.markers = doc.markers.filter(x => x !== m); }); selected = null; render(); }
function batchAccept() {
  if (!range) { alert('Shift-drag across a passage first.'); return; }
  const a = Math.min(range.a, range.b), b = Math.max(range.a, range.b), list = doc.markers.filter(m => m.status === 'unreviewed' && m.time >= a && m.time < b);
  const bins = doc.listened.slice(Math.floor((a - doc.region.start) / .05), Math.ceil((b - doc.region.start) / .05)), heard = bins.filter(Boolean).length / Math.max(1, bins.length);
  if (heard < .95) { alert(`Listen to this passage first (${(heard * 100).toFixed(0)}% heard). Batch review never accepts unheard notes.`); return; }
  if (!list.length || !confirm(`Accept ${list.length} unreviewed markers between ${a.toFixed(2)} s and ${b.toFixed(2)} s? They will be marked as batch-reviewed.`)) return;
  mutate(() => list.forEach(m => { m.status = 'accepted'; m.batch = true; m.reviewedAt = now(); }));
}
function setLead() {
  const t = Math.max(doc.region.start, Math.min(doc.region.end, playhead)), label = $('lead').value;
  mutate(() => {
    const kept = doc.leadRegions.filter(r => !r.draft).flatMap(r => r.end <= t || r.start >= doc.region.end ? [r] : r.start < t ? [{ ...r, end: t }] : []);
    const nextStart = kept.filter(r => r.start > t).map(r => r.start).sort((x, y) => x - y)[0] ?? doc.region.end;
    doc.leadRegions = [...kept, { start: t, end: nextStart, label, setAt: now() }].sort((x, y) => x.start - y.start);
  });
}
function exportDoc() {
  const s = stats(), out = { ...doc, exportedAt: now(), humanVerified: s.complete,
    review: { unreviewed: s.unreviewed, listenedShare: +s.listened.toFixed(3), leadRegionLabelled: s.labelled },
    // Only explicitly accepted markers are reference onsets; uncertain ones are kept apart.
    verifiedOnsets: s.complete ? doc.markers.filter(m => m.status === 'accepted').map(m => m.time) : [],
    acceptedOnsetsDraft: doc.markers.filter(m => m.status === 'accepted').map(m => m.time),
    uncertainOnsets: doc.markers.filter(m => m.status === 'uncertain').map(m => m.time),
    leadRegions: doc.leadRegions.filter(r => !r.draft) };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = `${doc.audio.file.replace(/\.[^.]+$/, '')}.${doc.region.start.toFixed(1)}-${doc.region.end.toFixed(1)}.lead-annotation.json`; a.click();
}

// ---------- events ----------
$('file').onchange = async e => { const f = e.target.files[0]; if (f) await loadAudio(await f.arrayBuffer(), f.name); };
$('draft').onchange = async e => { const f = e.target.files[0]; if (!f) return; const d = JSON.parse(await f.text());
  if (d.version !== 'kora-lead-labels-v1') { alert('Not a tap-label file.'); return; }
  if (audio && d.sha256 !== audio.sha256 && !confirm('These taps were made on a different audio file. Import anyway?')) return;
  draft = d; if (doc) mutate(mergeDraft); };
$('load').onchange = async e => { const f = e.target.files[0]; if (!f) return; const d = JSON.parse(await f.text()); if (d.version !== 'kora-lead-annotation-v1') return alert('Not an annotation file.');
  if (audio && d.audio.sha256 !== audio.sha256) return alert('This annotation belongs to a different audio file.');
  $('start').value = d.region.start; $('length').value = (d.region.end - d.region.start).toFixed(1); localStorage.setItem(`leadAnno:${d.audio.sha256}:${d.region.start.toFixed(2)}:${d.region.end.toFixed(2)}`, JSON.stringify(d)); if (audio) await analyse(); };
$('analyse').onclick = analyse;
$('play').onclick = () => playing ? stop() : play(inRegion(playhead) ? playhead : doc.region.start, doc.region.end, $('loopRegion').checked);
$('accept').onclick = () => setStatus('accepted'); $('reject').onclick = () => setStatus('rejected'); $('uncertain').onclick = () => setStatus('uncertain');
$('nudgeL').onclick = () => moveSelected(-.005); $('nudgeR').onclick = () => moveSelected(.005);
$('timeEdit').onchange = () => { const m = sel(), v = +$('timeEdit').value; if (m && inRegion(v)) moveSelected(v - m.time); };
$('setLead').onclick = setLead; $('snap').onclick = snapMyTaps; $('reset').onclick = resetRegion; $('rejectRest').onclick = rejectUnreviewed; $('batch').onclick = batchAccept; $('export').onclick = exportDoc;
$('undo').onclick = () => restore(history, future); $('redo').onclick = () => restore(future, history);
$('view').onchange = render; $('showTaps').onchange = render;
$('showCandidates').onchange = async () => { if ($('showCandidates').checked && doc && !candidates) await runCandidates(); render(); };
const zoom = (factor, at = (view.t0 + view.t1) / 2) => { const span = Math.min(doc.region.end - doc.region.start, Math.max(.5, (view.t1 - view.t0) * factor));
  view.t0 = Math.max(doc.region.start, Math.min(doc.region.end - span, at - (at - view.t0) * span / (view.t1 - view.t0))); view.t1 = view.t0 + span; render(); };
$('zoomIn').onclick = () => zoom(.5, sel()?.time); $('zoomOut').onclick = () => zoom(2); $('zoomAll').onclick = () => { view = { t0: doc.region.start, t1: doc.region.end }; render(); };
const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * canvas.width, y: (e.clientY - r.top) / r.height * canvas.height }; };
canvas.onpointerdown = e => {
  if (!doc) return; const p = pos(e), t = T(p.x); canvas.setPointerCapture(e.pointerId);
  if (e.shiftKey) { range = { a: t, b: t }; drag = { kind: 'range' }; return; }
  const hit = doc.markers.filter(m => Math.abs(X(m.time) - p.x) < 10).sort((a, b) => Math.abs(X(a.time) - p.x) - Math.abs(X(b.time) - p.x))[0];
  if (p.y >= LANES.ghosts[0] && p.y <= LANES.ghosts[1]) {
    const ghost = suggestions.filter(o => Math.abs(X(o.time) - p.x) < 10).sort((a, b) => Math.abs(X(a.time) - p.x) - Math.abs(X(b.time) - p.x))[0];
    if (ghost) { const id = Math.max(0, ...doc.markers.map(m => m.id)) + 1; suggestions = suggestions.filter(o => o !== ghost);
      mutate(() => { doc.markers.push({ id, time: ghost.time, originalTime: ghost.time, origin: 'suggestion', status: 'accepted', pitchMidi: ghost.pitchMidi, reviewedAt: now() }); doc.markers.sort((a, b) => a.time - b.time); }); selected = id; render(); return; }
  }
  if (hit && p.y < LANES.main[1]) { selected = hit.id; drag = { kind: 'marker', marker: hit, started: false }; render(); return; }
  range = null; playhead = Math.max(doc.region.start, Math.min(doc.region.end, t)); if (playing) play(playhead, doc.region.end, $('loopRegion').checked); render();
};
canvas.onpointermove = e => {
  if (!drag) return; const t = T(pos(e).x);
  if (drag.kind === 'range') { range.b = t; render(); return; }
  if (!drag.started) { history.push(JSON.stringify({ markers: doc.markers, leadRegions: doc.leadRegions })); future = []; drag.started = true; }
  drag.marker.time = +Math.max(doc.region.start, Math.min(doc.region.end, t)).toFixed(4); render();
};
canvas.onpointerup = () => { if (drag?.kind === 'marker' && drag.started) { doc.markers.sort((a, b) => a.time - b.time); save(); } drag = null; render(); };
canvas.onwheel = e => { if (!doc) return; e.preventDefault(); const t = T(pos(e).x);
  if (e.shiftKey) { const shift = (view.t1 - view.t0) * Math.sign(e.deltaY) * .15; const span = view.t1 - view.t0; view.t0 = Math.max(doc.region.start, Math.min(doc.region.end - span, view.t0 + shift)); view.t1 = view.t0 + span; render(); }
  else zoom(e.deltaY > 0 ? 1.25 : .8, t); };
document.addEventListener('keydown', e => {
  if (!doc || ['INPUT', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'checkbox') return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 'z') { e.preventDefault(); restore(history, future); return; }
  if (e.ctrlKey && k === 'y') { e.preventDefault(); restore(future, history); return; }
  if (k === ' ') { e.preventDefault(); $('play').click(); }
  else if (k === 'a') setStatus('accepted'); else if (k === 'r') setStatus('rejected'); else if (k === 'u') setStatus('uncertain');
  else if (k === 'n' || k === 'arrowright') { e.preventDefault(); next(1); } else if (k === 'p' || k === 'arrowleft') { e.preventDefault(); next(-1); }
  else if (k === 'l') { const m = sel(); if (m) loopAround(m); } else if (k === 'm') addAtPlayhead();
  else if (k === 'delete' || k === 'backspace') removeSelected();
  else if (k === '[') moveSelected(e.shiftKey ? -.001 : -.005); else if (k === ']') moveSelected(e.shiftKey ? .001 : .005);
  else if (k === 'escape') { stop(); range = null; render(); }
});
requestAnimationFrame(tick); render();

// Owner-preview convenience: ?src=/downloads/<slug>.wav&name=…&start=…&draft=… loads local files served on loopback.
const q = new URLSearchParams(location.search);
if (q.get('src')) (async () => {
  await loadAudio(await (await fetch(q.get('src'))).arrayBuffer(), q.get('name') || q.get('src'));
  if (q.get('draft')) { draft = await (await fetch(q.get('draft'))).json(); }
  if (q.get('start')) { $('start').value = q.get('start'); $('length').value = q.get('length') || 24; await analyse(); }
})();
window.leadEditor = { get doc() { return doc; }, get candidates() { return candidates; }, stats: () => doc && stats() };
