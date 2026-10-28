/** Only generated staging fixtures for the isolated Windows qualification app. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { qualificationTarget } from './qualification-target.mjs';

const { config, staging, root } = await qualificationTarget('scratch/product-completion-261027-0846/native'); assert.equal(staging, true);
const path = resolve(root, 'owned-fixture.json'), options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options), value = response => { if (response.error) throw Error(response.error.message); return response.data; };
if (process.argv.includes('--cleanup')) {
  const fixture = JSON.parse(await readFile(path, 'utf8')); assert.equal(fixture.target, config.API_URL); assert.match(fixture.email, /^native-qualification-[a-f0-9-]+@example\.invalid$/);
  const user = value(await admin.auth.admin.getUserById(fixture.userId)).user; assert.equal(user.email, fixture.email);
  const files = value(await admin.storage.from('kora-profile-images').list(fixture.userId)); if (files.length) value(await admin.storage.from('kora-profile-images').remove(files.map(file => `${fixture.userId}/${file.name}`)));
  const notes=value(await admin.from('notes').select('id').eq('owner_user_id',fixture.userId));
  if(notes.length){const images=value(await admin.from('note_images').select('object_path').in('note_id',notes.map(note=>note.id)));if(images.length)value(await admin.storage.from('kora-note-images').remove(images.map(image=>image.object_path)));}
  value(await admin.from('workspaces').delete().eq('id', fixture.workspaceId)); value(await admin.auth.admin.deleteUser(fixture.userId));
  await writeFile(resolve(root, 'cleanup.json'), JSON.stringify({ at: new Date().toISOString(), ownedIdentityRemoved: true, ownedWorkspaceRemoved: true, ownedImagesRemoved: true })); console.log('Owned native staging fixtures cleaned.'); process.exit(0);
}
const email = `native-qualification-${randomUUID()}@example.invalid`, password = `${randomUUID()}!aB9`;
const user = value(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Windows qualification' } })).user;
const client = createClient(config.API_URL, config.ANON_KEY, options); value(await client.auth.signInWithPassword({ email, password }));
const workspaceId = value(await client.rpc('create_workspace_with_owner', { workspace_name: 'Windows qualification' }));
const board = value(await client.from('boards').insert({ workspace_id: workspaceId, created_by: user.id, title: 'Windows workflow' }).select().single());
const lists = value(await client.from('lists').insert(['To-do', 'Doing', 'Done'].map((title, position) => ({ workspace_id: workspaceId, board_id: board.id, title, position }))).select());
const task = value(await client.from('tasks').insert({ workspace_id: workspaceId, board_id: board.id, list_id: lists.find(row => row.title === 'To-do').id, title: 'Native connected task', created_by: user.id, position: 0, due_date: '2026-10-27', repeat_interval: 'daily' }).select().single());
await writeFile(path, JSON.stringify({ target: config.API_URL, email, password, userId: user.id, workspaceId, boardId: board.id, taskId: task.id, createdAt: new Date().toISOString() }, null, 2), { flag: 'wx' });
let browser;
try {
  browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  for (const [name, width, height] of [['landscape', 800, 400], ['portrait', 400, 800]]) {
    const png = await page.evaluate(({ width, height }) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const drawing = canvas.getContext('2d'); drawing.fillStyle = '#2563eb'; drawing.fillRect(0, 0, width, height); drawing.fillStyle = '#f97316'; drawing.fillRect(width / 3, 0, width / 3, height); return canvas.toDataURL('image/png').split(',')[1]; }, { width, height });
    await writeFile(resolve(root, `${name}.png`), Buffer.from(png, 'base64'));
  }
  await writeFile(resolve(root, 'invalid-image.txt'), 'This is deliberately not an image.');
} finally { await browser?.close(); }
await mkdir(resolve(root, 'screenshots'), { recursive: true }); console.log('Generated native account, canonical board/task and image fixtures prepared. Credentials remain in ignored private task files.');
