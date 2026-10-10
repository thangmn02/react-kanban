import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAuthGate, config } from './lead-test-edge-auth.mjs';

const password = 'test_fixture_'.padEnd(43, 'x');
const credential = `kora-test:${password}`;
const digest = createHash('sha256').update(credential).digest('hex');
const authorization = `Basic ${btoa(credential)}`;
function setup(readEnvironment = () => ({ digest, siteId: 'test-site' })) {
  let calls = 0;
  const context = { site: { id: 'test-site' }, next: async () => {
    calls++;
    return new Response('original audio', { status: 206, headers: {
      'Content-Range': 'bytes 0-13/100', 'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000', 'CDN-Cache-Control': 'public',
      'Netlify-CDN-Cache-Control': 'public', 'Set-Cookie': 'unrelated=1',
    } });
  } };
  return { handler: createAuthGate(readEnvironment), context, calls: () => calls };
}

test('gate applies to every path and runtime failures cannot fall through', () => {
  assert.deepEqual(config, { path: '/*', onError: 'fail' });
});

for (const path of ['/', '/index.html', '/kora-lead-test/asset.wav', '/.netlify/images?url=/asset.wav', '/unknown']) {
  test(`missing and incorrect credentials deny ${path}, including Range and HEAD`, async () => {
    const gate = setup();
    for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
      for (const auth of ['', 'Bearer invalid', 'Basic !!!', `Basic ${btoa('kora-test:' + 'z'.repeat(43))}`, authorization + ', ' + authorization]) {
        const response = await gate.handler(new Request('https://test.netlify.app' + path, {
          method, headers: { Authorization: auth, Range: 'bytes=0-100' },
        }), gate.context);
        assert.equal(response.status, 401);
        assert.match(response.headers.get('Cache-Control'), /no-store/);
        assert.match(response.headers.get('WWW-Authenticate'), /^Basic /);
      }
    }
    assert.equal(gate.calls(), 0);
  });
}

test('missing or invalid server configuration and wrong project fail closed', async () => {
  for (const settings of [{}, { digest: 'invalid', siteId: 'test-site' }, { digest, siteId: 'production-site' }]) {
    const gate = setup(() => settings);
    assert.equal((await gate.handler(new Request('https://test.netlify.app/', { headers: { Authorization: authorization } }), gate.context)).status, 503);
    assert.equal(gate.calls(), 0);
  }
  const gate = setup(() => { throw new Error('unavailable'); });
  assert.equal((await gate.handler(new Request('https://test.netlify.app/'), gate.context)).status, 503);
});

test('authorized audio preserves Range response and forbids every shared-cache directive', async () => {
  const gate = setup();
  const response = await gate.handler(new Request('https://test.netlify.app/audio.wav', {
    headers: { Authorization: authorization, Range: 'bytes=0-13', 'If-None-Match': 'old' },
  }), gate.context);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 0-13/100');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Vary'), 'Authorization');
  for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Netlify-CDN-Cache-Control']) assert.match(response.headers.get(header), /no-store/);
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(await response.text(), 'original audio');
  assert.equal(gate.calls(), 1);
});

test('authorized mutation methods cannot reach downstream content', async () => {
  const gate = setup();
  assert.equal((await gate.handler(new Request('https://test.netlify.app/', { method: 'POST', headers: { Authorization: authorization } }), gate.context)).status, 405);
  assert.equal(gate.calls(), 0);
});

test('downstream exceptions return an unavailable response without its details', async () => {
  const gate = setup();
  gate.context.next = () => { throw new Error('internal authentication detail'); };
  const response = await gate.handler(new Request('https://test.netlify.app/', { headers: { Authorization: authorization } }), gate.context);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Test source unavailable.');
});
