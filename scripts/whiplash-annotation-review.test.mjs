import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const template = await readFile(new URL('./whiplash-annotation-review.html', import.meta.url), 'utf8');
const excerpt = { input: 'W1', role: 'ensemble candidate', sourceStart: 8, sourceEnd: 20,
  duration: 12, sourceSha256: 'source-hash', pcmSha256: 'pcm-hash', file: 'w1.wav', peaks: [.1, .8] };

function review() {
  const blobs = [];
  const dom = new JSDOM(template.replace('__BENCHMARK_MANIFEST__', JSON.stringify({ excerpts: [excerpt] })), {
    runScripts: 'dangerously', url: 'http://127.0.0.1/',
    beforeParse(window) {
      // Audio/canvas rendering is outside these export-integrity unit tests.
      window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} });
      window.Blob = Blob;
      window.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:unit-test'; };
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = () => {};
    },
  });
  const field = id => dom.window.document.getElementById(id);
  const complete = () => {
    field('kick').value = '1.020, 2.1';
    field('notes').value = 'Reviewed ensemble attacks and rests.';
    field('reviewer').value = 'Reviewer';
    for (const id of ['kick-complete', 'snare-complete', 'hat-complete', 'coverage', 'identity-check', 'verify']) field(id).checked = true;
  };
  const exported = async () => { field('export').click(); return blobs.length ? JSON.parse(await blobs.at(-1).text()) : undefined; };
  return { dom, field, blobs, complete, exported };
}

test('blank review exports pending rows, never an absent-class reference', async () => {
  const r = review();
  try {
    const [a] = await r.exported();
    assert.equal(a.verified, false);
    assert.deepEqual(a.rows, { kick: null, snare: null, hat: null });
    assert.equal(a.sourceSha256, excerpt.sourceSha256);
    assert.equal(a.pcmSha256, excerpt.pcmSha256);
  } finally { r.dom.window.close(); }
});

test('completed preliminary review retains identities and remains provisional', async () => {
  const r = review();
  try {
    r.complete();
    const [a] = await r.exported();
    assert.equal(a.verified, false);
    assert.equal(a.reviewComplete, true);
    assert.equal(a.referenceStatus,'provisional-human-reference');
    assert.equal(a.purpose, 'investigation-only');
    assert.deepEqual(a.rows, { kick: [1.02, 2.1], snare: [], hat: [] });
    assert.equal(a.sourceStart, 8);
    r.field('kick').dispatchEvent(new r.dom.window.Event('input'));
    assert.equal(r.field('verify').checked, false);
    assert.equal(r.field('kick-complete').checked, false);
  } finally { r.dom.window.close(); }
});

test('incomplete export retains typed marks, duplicate/end-boundary flags for later investigation, and uncertainty',async()=>{
  const r=review();
  try{
    r.field('kick').value='1.2 1.2 12.000';
    r.field('ambiguous-intervals').value='[{"start":1,"end":2,"rows":["kick"],"reason":"overlap"}]';
    const [a]=await r.exported();
    assert.deepEqual(a.provisionalRows.kick,[1.2,1.2,12]);
    assert.equal(a.rows.kick,null);
    assert.equal(a.onsetUncertaintyMs,null);
    assert.equal(a.rowConfidence.kick,'unassessed');
    assert.equal(a.ambiguousIntervals[0].reason,'overlap');
    assert.equal(a.scoringEligible,false);
  }finally{r.dom.window.close();}
});

test('unresolved masking cannot freeze a complete reference', async () => {
  const r = review();
  try {
    r.complete();
    r.field('ambiguous').value = '[{"time":2,"row":"snare","reason":"brass masks attack"}]';
    assert.equal(await r.exported(), undefined);
    assert.match(r.field('status').textContent, /resolve all ambiguity/);
  } finally { r.dom.window.close(); }
});

test('invalid or duplicate onset times are rejected', async () => {
  for (const value of ['12', '-0.1', 'NaN', '1,1']) {
    const r = review();
    try {
      r.complete(); r.field('kick').value = value;
      assert.equal(await r.exported(), undefined);
      assert.match(r.field('status').textContent, value==='NaN'?/Provisional timestamps must be finite/:/unique finite seconds/);
    } finally { r.dom.window.close(); }
  }
});

test('cymbal subtypes must belong to a combined-row onset', async () => {
  const r = review();
  try {
    r.complete();
    r.field('subtypes').value = '[{"time":1.5,"subtype":"ride"}]';
    assert.equal(await r.exported(), undefined);
    r.field('hat').value = '1.5';
    const [a] = await r.exported();
    assert.deepEqual(a.subtypes, [{ time: 1.5, subtype: 'ride' }]);
  } finally { r.dom.window.close(); }
});
