/** End-to-end Settings with real local Auth, profile and private Storage services. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';

const root = resolve('scratch/integration-261027-0739/connected-ui'); await mkdir(root, { recursive: true });
const backup = JSON.parse(await readFile('scratch/integration-261027-0739/local-database-before-ui/backup-manifest.json', 'utf8'));
assert.equal(backup.restoreVerified, true); assert.equal(backup.target, 'local Docker Supabase only');
const cli = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '--output', 'json'], { encoding: 'utf8', timeout: 30000 }); assert.equal(cli.status, 0);
const config = JSON.parse(cli.stdout); assert.equal(config.API_URL, 'http://127.0.0.1:54321');
const buildLog = openSync(resolve(root, 'build.log'), 'w');
try {
  const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', resolve(root, 'site')], { env: { ...process.env, VITE_AUTH_MODE: 'supabase', VITE_SUPABASE_URL: config.API_URL, VITE_SUPABASE_ANON_KEY: config.ANON_KEY }, stdio: ['ignore', buildLog, buildLog], timeout: 120000 });
  assert.equal(build.status, 0, 'The actual connected frontend must build.');
} finally { closeSync(buildLog); }
const site = resolve(root, 'site');
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = resolve(site, '.' + (extname(path) ? decodeURIComponent(path) : '/index.html'));
    if (!file.startsWith(site + sep)) throw Error('Outside site');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream' }); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
const value = result => { if (result.error) throw Error(result.error.message); return result.data; };
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const client = createClient(config.API_URL, config.ANON_KEY, options);
const email = `kora-ui-${randomUUID()}@example.invalid`, password = randomUUID() + '!aB9';
let browser, userId, workspaceId, page;
const results = [];
try {
  // Refuse an occupied deterministic port; never reuse an unknown server.
  await new Promise((done, fail) => { server.once('error', fail); server.listen(5174, '127.0.0.1', done); });
  await writeFile(resolve(root, 'process.json'), JSON.stringify({ pid: process.pid, port: 5174, command: process.argv, startedAt: new Date().toISOString(), worktree: process.cwd() }, null, 2));
  userId = value(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Connected UI' } })).user.id;
  value(await client.auth.signInWithPassword({ email, password }));
  workspaceId = value(await client.rpc('create_workspace_with_owner', { workspace_name: 'Connected UI qualification' }));
  const board = value(await client.from('boards').insert({ title: 'Profile qualification', workspace_id: workspaceId, created_by: userId }).select().single());
  value(await client.from('lists').insert(['To-do', 'Doing', 'Done'].map((title, position) => ({ title, position, workspace_id: workspaceId, board_id: board.id }))));
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); page = await context.newPage();
  const login = async () => { await page.goto('http://127.0.0.1:5174/auth/sign-in'); await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).last().click(); await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible(); };
  const settings = async () => { await page.getByRole('button', { name: 'Open user menu' }).click(); await page.getByRole('button', { name: 'Settings', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible(); };
  await login(); await settings();
  await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Cancelled connected edit'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(value(await client.from('profiles').select('full_name').eq('id', userId).single()).full_name, 'Connected UI'); results.push('cancel leaves remote identity unchanged');
  await settings(); await page.getByRole('textbox', { name: 'Display name', exact: true }).fill('Saved connected identity');
  const image = Buffer.from(await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 400; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#2563eb'; ctx.fillRect(0, 0, 800, 400); ctx.fillStyle = '#f97316'; ctx.fillRect(250, 0, 300, 400); return canvas.toDataURL('image/png').split(',')[1]; }), 'base64');
  await page.getByLabel('Choose an image').setInputFiles({ name: 'qualification.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('slider', { name: 'Zoom', exact: true })).toBeVisible();
  const preview = page.getByAltText('Profile image preview'); const bounds = await preview.boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2); await page.mouse.up();
  expect(Number(await page.getByRole('slider', { name: 'Horizontal position', exact: true }).inputValue())).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Save profile', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
  let row = value(await client.from('profiles').select('full_name,avatar_url').eq('id', userId).single()); assert.equal(row.full_name, 'Saved connected identity'); assert.ok(row.avatar_url.startsWith(`kora-profile-images/${userId}/`));
  const path = row.avatar_url.slice('kora-profile-images/'.length); const signed = value(await client.storage.from('kora-profile-images').createSignedUrl(path, 60));
  const response = await fetch(signed.signedUrl); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/jpeg'); assert.ok((await response.arrayBuffer()).byteLength <= 524288);
  results.push('real UI crop/drag saves bounded JPEG to owner-private storage and updates profile');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click(); await page.reload(); await page.getByRole('button', { name: 'Open user menu' }).click(); await expect(page.getByRole('dialog', { name: 'Your Kora identity' })).toContainText('Saved connected identity');
  await page.screenshot({ path: resolve(root, 'saved-identity.png') });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await login(); await settings(); await expect(page.getByRole('textbox', { name: 'Display name', exact: true })).toHaveValue('Saved connected identity'); results.push('reload, sign-out and real password sign-in retain identity');
  await page.getByRole('button', { name: 'Restore Kora image' }).click(); await page.getByRole('button', { name: 'Save profile', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Profile saved.' })).toBeVisible();
  row = value(await client.from('profiles').select('avatar_url').eq('id', userId).single()); assert.equal(row.avatar_url, null);
  assert.ok((await client.storage.from('kora-profile-images').createSignedUrl(path, 60)).error); results.push('default restoration retires the previous owned image');
} catch (error) {
  process.exitCode = 1; results.push(`FAIL: ${error.stack}`); if (page) await page.screenshot({ path: resolve(root, 'failure.png') }).catch(() => {});
} finally {
  await browser?.close(); if (server.listening) await new Promise(done => server.close(done));
  if (userId) { const files = value(await admin.storage.from('kora-profile-images').list(userId)); if (files.length) value(await admin.storage.from('kora-profile-images').remove(files.map(file => `${userId}/${file.name}`))); }
  if (workspaceId) value(await admin.from('workspaces').delete().eq('id', workspaceId));
  if (userId) value(await admin.auth.admin.deleteUser(userId));
  await writeFile(resolve(root, 'results.json'), JSON.stringify({ at: new Date().toISOString(), target: 'local Supabase', mockedNetwork: false, browserClosed: true, results }, null, 2));
  console.log(JSON.stringify(results));
}
