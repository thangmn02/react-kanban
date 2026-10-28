/** Built UI with real local Auth/RLS/RPCs; only deliberate outage injection intercepts requests. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {Readable} from 'node:stream';
import sharp from 'sharp';
import {handleNoteImages} from '../server/note-images.ts';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { qualificationTarget } from './qualification-target.mjs';
import { chromium, expect } from '@playwright/test';

const { root: targetRoot, config, target } = await qualificationTarget('scratch/product-completion-261027-0846/notes-browser');
const root = resolve(targetRoot); await mkdir(root, { recursive: true });
const buildLog = openSync(resolve(root, 'build.log'), 'w');
try {
  const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', resolve(root, 'site')], { env: { ...process.env, VITE_AUTH_MODE: 'supabase', VITE_ENABLE_NOTES_PREVIEW: 'true', VITE_SUPABASE_URL: config.API_URL, VITE_SUPABASE_ANON_KEY: config.ANON_KEY }, stdio: ['ignore', buildLog, buildLog], timeout: 180000 });
  assert.equal(build.status, 0, 'Connected frontend build must succeed.');
} finally { closeSync(buildLog); }
const site = resolve(root, 'site');
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1').pathname, file = resolve(site, '.' + (extname(path) ? decodeURIComponent(path) : '/index.html'));
    if(path==='/api/note-images'&&request.method==='POST'){
      const headers=new Headers();for(const[key,item]of Object.entries(request.headers))if(item)headers.set(key,Array.isArray(item)?item.join(','):item);
      const reply=await handleNoteImages(new Request('http://127.0.0.1:5174/api/note-images',{method:'POST',headers,body:Readable.toWeb(request),duplex:'half'}),{supabaseUrl:config.API_URL,anonKey:config.ANON_KEY,serviceRoleKey:config.SERVICE_ROLE_KEY});
      response.writeHead(reply.status,Object.fromEntries(reply.headers));response.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    if (!file.startsWith(site + sep)) throw Error('Outside site');
    const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream' }); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
const value = response => { if (response.error) throw Error(response.error.message); return response.data; };
const options = { auth: { persistSession: false, autoRefreshToken: false } }, admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const users = [], actors = {}, results = [];
let browser, workspaceId, ownerPage, viewerPage;
const base = 'http://127.0.0.1:5174';
try {
  await new Promise((done, fail) => { server.once('error', fail); server.listen(5174, '127.0.0.1', done); });
  await writeFile(resolve(root, 'process.json'), JSON.stringify({ pid: process.pid, port: 5174, command: process.argv, startedAt: new Date().toISOString(), worktree: process.cwd() }, null, 2));
  for (const role of ['owner', 'viewer']) {
    const email = `notes-ui-${randomUUID()}@example.invalid`, password = `${randomUUID()}!aB9`;
    const user = value(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Notes ${role}` } })).user; users.push(user.id);
    const client = createClient(config.API_URL, config.ANON_KEY, options); value(await client.auth.signInWithPassword({ email, password })); actors[role] = { email, password, id: user.id, client };
  }
  workspaceId = value(await actors.owner.client.rpc('create_workspace_with_owner', { workspace_name: 'Notes browser qualification' }));
  value(await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: actors.viewer.id, role: 'viewer' }));
  const board = value(await actors.owner.client.from('boards').insert({ workspace_id: workspaceId, created_by: actors.owner.id, title: 'Notes continuity' }).select().single());
  const lists = value(await actors.owner.client.from('lists').insert(['To-do', 'Doing', 'Done'].map((title, position) => ({ workspace_id: workspaceId, board_id: board.id, title, position }))).select());
  const task = value(await actors.owner.client.from('tasks').insert({ workspace_id: workspaceId, board_id: board.id, list_id: lists.find(row => row.title === 'To-do').id, title: 'Task context retained', created_by: actors.owner.id, position: 0 }).select().single());
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), viewerContext = await browser.newContext({ viewport: { width: 1100, height: 850 } });
  ownerPage = await ownerContext.newPage(); viewerPage = await viewerContext.newPage();
  const login = async (page, actor) => { await page.goto(`${base}/auth/sign-in`); await page.getByLabel('Email', { exact: true }).fill(actor.email); await page.getByLabel('Password', { exact: true }).fill(actor.password); await page.getByRole('button', { name: 'Sign in', exact: true }).last().click(); await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible(); await page.goto(`${base}/notes`); await expect(page.getByRole('heading', { name: 'Notes', exact: true, level: 1 })).toBeVisible(); };
  await login(ownerPage, actors.owner); await login(viewerPage, actors.viewer);
  await ownerPage.getByRole('button', { name: 'New note', exact: true }).click();
  await ownerPage.getByLabel('Note title', { exact: true }).fill('Connected thought');
  await ownerPage.getByRole('button', { name: 'Edit / expand' }).click(); await ownerPage.getByRole('textbox', { name: 'Note content', exact: true }).fill('Rich connected content');
  await ownerPage.getByLabel('Checklist item', { exact: true }).fill('Retain this checklist'); await ownerPage.getByRole('button', { name: 'Add', exact: true }).click();
  await ownerPage.getByRole('button', { name: 'Pin note', exact: true }).click();
  await expect.poll(async () => value(await actors.owner.client.from('notes').select('title').eq('workspace_id', workspaceId))[0]?.title).toBe('Connected thought');
  await expect(ownerPage.getByRole('status').filter({ hasText: 'All changes saved.' })).toBeVisible();
  const note = value(await actors.owner.client.from('notes').select('*').eq('workspace_id', workspaceId).single());
  const connectedCard=ownerPage.getByRole('article',{name:'Note: Connected thought',exact:true});
  const imageBytes=await sharp({create:{width:320,height:180,channels:3,background:'#3377aa'}}).png().toBuffer();
  await connectedCard.getByLabel('Choose note image',{exact:true}).setInputFiles({name:'qualification-note.png',mimeType:'image/png',buffer:imageBytes});
  await expect(connectedCard.getByRole('img',{name:'qualification-note.png',exact:true})).toBeVisible();
  await connectedCard.getByRole('button',{name:'Resize note image',exact:true}).press('ArrowRight');
  await expect.poll(async()=>value(await actors.owner.client.from('notes').select('content').eq('id',note.id).single()).content.html).toContain('data-kora-note-image');
  await expect(ownerPage.getByRole('status').filter({hasText:'All changes saved.'})).toBeVisible();
  assert.equal(value(await actors.viewer.client.from('notes').select('id').eq('id', note.id)).length, 0);
  await ownerPage.reload(); await expect(ownerPage.getByLabel('Note title', { exact: true })).toHaveValue('Connected thought'); await expect(ownerPage.getByText('Retain this checklist', { exact: true })).toBeVisible();
  results.push('private rich note/checklist/pin persist through a real session reload');
  await expect(ownerPage.getByRole('img',{name:'qualification-note.png',exact:true})).toBeVisible();results.push('real editor image upload, private download and keyboard resize survive reload');
  await ownerPage.getByRole('button', { name: 'Sharing & comments' }).click();
  await ownerPage.getByLabel('Note permission for Notes viewer', { exact: true }).selectOption('comment');
  await expect.poll(async () => value(await actors.viewer.client.from('notes').select('id').eq('id', note.id)).length).toBe(1);
  await ownerPage.getByRole('dialog', { name: 'Note sharing and comments' }).getByRole('button', { name: 'Close', exact: true }).click();
  await viewerPage.getByRole('button', { name: 'Refresh / retry' }).click(); await expect(viewerPage.getByLabel('Note title', { exact: true })).toHaveValue('Connected thought'); await expect(viewerPage.getByLabel('Note title', { exact: true })).toHaveAttribute('readonly', '');
  await viewerPage.getByRole('button', { name: 'Sharing & comments' }).click(); await viewerPage.getByLabel('New note comment').fill('A real shared comment'); await viewerPage.getByRole('button', { name: 'Add comment', exact: true }).click(); await expect(viewerPage.getByText('A real shared comment', { exact: true })).toBeVisible();
  await viewerPage.getByRole('button', { name: 'Edit comment', exact: true }).click();
  await viewerPage.getByLabel('Edit note comment', { exact: true }).fill('Updated real shared comment');
  await viewerPage.getByRole('button', { name: 'Save comment', exact: true }).click();
  await expect(viewerPage.getByText('Updated real shared comment', { exact: true })).toBeVisible();
  await viewerPage.getByRole('button', { name: 'Delete comment', exact: true }).click();
  await expect(viewerPage.getByText('Updated real shared comment', { exact: true })).toHaveCount(0);
  await viewerPage.getByRole('dialog', { name: 'Note sharing and comments' }).getByRole('button', { name: 'Close', exact: true }).click();
  results.push('comment author edits and deletes a real persisted comment');
  results.push('real explicit comment grant exposes read-only note content and permits comments');
  await ownerPage.getByRole('button', { name: 'Sharing & comments' }).click(); await ownerPage.getByLabel('Note permission for Notes viewer', { exact: true }).selectOption(''); await ownerPage.getByRole('dialog', { name: 'Note sharing and comments' }).getByRole('button', { name: 'Close', exact: true }).click();
  await viewerPage.getByRole('button', { name: 'Refresh / retry' }).click(); await expect(viewerPage.getByLabel('Note title', { exact: true })).toHaveCount(0); results.push('grant revocation removes content from a second signed-in browser');
  const outage = /\/rest\/v1\/(?:notes(?:\?|$)|rpc\/save_note(?:$|\?))/;
  const draftDiagnostics = [];
  const recordDraftState = async label => {
    const server = value(await actors.owner.client.from('notes').select('revision,title').eq('id', note.id).single());
    const drafts = await ownerPage.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('kora:notes-draft:')).map(key => { const value = JSON.parse(localStorage.getItem(key)); return { baseRevision: value.baseRevision, title: value.note.title, content: value.content, layout: value.layout }; }));
    draftDiagnostics.push({ label, server, drafts }); await writeFile(resolve(root, 'draft-diagnostics.json'), JSON.stringify(draftDiagnostics, null, 2));
  };
  await recordDraftState('before-outage');
  await ownerPage.route(outage, route => route.abort('failed'));
  await ownerPage.getByLabel('Note title', { exact: true }).fill('Durable outage draft'); await ownerPage.waitForTimeout(1000); await recordDraftState('edited-outage'); await ownerPage.reload();
  await expect(ownerPage.getByText(/Device drafts \(/)).toBeVisible(); await ownerPage.getByText(/Device drafts \(/).click(); await expect(ownerPage.getByText('Durable outage draft', { exact: true })).toBeVisible();
  await ownerPage.unroute(outage); await ownerPage.getByRole('button', { name: 'Refresh / retry' }).click(); await expect(ownerPage.getByLabel('Note title', { exact: true })).toBeVisible();
  await recordDraftState('before-recovery');
  await ownerPage.getByRole('button', { name: 'Resume draft', exact: true }).click(); await expect.poll(async () => value(await actors.owner.client.from('notes').select('title').eq('id', note.id).single()).title).toBe('Durable outage draft');
  results.push('outage/reload exposes retained device draft and resumes against its original revision');
  await ownerPage.goto(`${base}/notes?task=${task.id}&taskBoard=${board.id}`); const taskDialog = ownerPage.getByRole('dialog', { name: 'Edit task', exact: true }); await expect(taskDialog).toBeVisible();
  await taskDialog.getByLabel('Title', { exact: true }).fill('Unsaved task draft'); await taskDialog.getByRole('button', { name: 'Task notes', exact: true }).click();
  const taskNotes = ownerPage.getByRole('dialog', { name: 'Quick Notes', exact: true }); await expect(taskNotes).toBeVisible(); await taskNotes.getByRole('button', { name: 'New note', exact: true }).click(); await taskNotes.getByLabel('Quick note title', { exact: true }).fill('Task-linked thought');
  await taskNotes.getByRole('button', { name: 'Close', exact: true }).click(); await expect(taskDialog.getByLabel('Title', { exact: true })).toHaveValue('Unsaved task draft'); results.push('task-to-note overlay preserves the unsaved task editor');
  await ownerPage.screenshot({ path: resolve(root, 'task-context.png') });
  await ownerPage.goto(`${base}/notes`);
  const originalCard = ownerPage.getByRole('article', { name: 'Note: Durable outage draft', exact: true });
  await expect(originalCard).toBeVisible(); await originalCard.getByRole('button', { name: 'Convert note to task', exact: true }).click();
  await expect.poll(async () => value(await actors.owner.client.from('notes').select('content').eq('id', note.id).single()).content.convertedTaskId).toBe(note.id);
  assert.equal(value(await actors.owner.client.from('tasks').select('id').eq('id', note.id)).length, 1); results.push('connected note conversion creates one real linked task');
  await ownerPage.getByText('Manage and export notes', { exact: true }).click();
  await ownerPage.getByRole('listitem').filter({ hasText: 'Durable outage draft' }).getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await expect(originalCard).toHaveCount(0); await ownerPage.goto(`${base}/notes?filter=trash`);
  const trashRow = ownerPage.getByRole('listitem').filter({ hasText: 'Durable outage draft' }); await expect(trashRow).toBeVisible(); await trashRow.getByRole('button', { name: 'Restore', exact: true }).click(); await expect(trashRow).toHaveCount(0);
  await ownerPage.goto(`${base}/notes`); await expect(ownerPage.getByLabel('Note title', { exact: true }).filter({ hasNotText: 'none' }).first()).toBeVisible();
  assert.equal(value(await actors.owner.client.from('notes').select('deleted_at').eq('id', note.id).single()).deleted_at, null); results.push('owner soft deletion and restoration retain original content');
  const localId = randomUUID(), localKey = `kanban:${actors.owner.id}:${workspaceId}:notes-preview:v1`;
  const original = JSON.stringify([{ id: localId, title: 'Imported device note', html: '<p>Selected action for a task</p>', checklist: [], pinned: true, minimized: false, peek: true, expanded: true, x: 30, y: 40, width: 480, height: 550, taskId: null, taskBoardId: null, convertedTaskId: null, revision: 3, writeToken: randomUUID(), updatedAt: new Date().toISOString() }]);
  await ownerPage.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: localKey, raw: original });
  await ownerPage.getByRole('button', { name: 'Import device notes', exact: true }).click();
  await ownerPage.getByRole('region',{name:'Preview Notes import'}).getByRole('listitem').filter({hasText:'Imported device note'}).getByRole('checkbox').check(); await ownerPage.getByRole('button', { name: 'Import 1 private copy', exact: true }).click();
  await ownerPage.getByLabel('Search notes', { exact: true }).fill('Imported device note');
  const importedCard = ownerPage.getByRole('article', { name: 'Note: Imported device note', exact: true }); await expect(importedCard).toBeVisible();
  const imported = value(await actors.owner.client.from('notes').select('*').eq('workspace_id', workspaceId).eq('title', 'Imported device note').single()); assert.equal(imported.visibility, 'private');
  await ownerPage.getByRole('button', { name: 'Import device notes', exact: true }).click(); await ownerPage.getByRole('region',{name:'Preview Notes import'}).getByRole('listitem').filter({hasText:'Imported device note'}).getByRole('checkbox').check(); await ownerPage.getByRole('button', { name: 'Import 1 private copy', exact: true }).click();
  await expect(ownerPage.getByRole('button', { name: 'Import 1 private copy', exact: true })).toHaveCount(0);
  assert.equal(value(await actors.owner.client.from('notes').select('id').eq('workspace_id', workspaceId).eq('title', 'Imported device note')).length, 1);
  assert.equal(await ownerPage.evaluate(key => localStorage.getItem(key), localKey), original);
  const layout = value(await actors.owner.client.from('note_user_presentation').select('*').eq('note_id', imported.id).single()); assert.equal(layout.presentation.pinned, true);
  results.push('explicit private import is duplicate-safe, restores own layout and preserves the exact device original');
  const editor = importedCard.getByRole('textbox', { name: 'Note content', exact: true }); await editor.click(); await editor.press('ControlOrMeta+a');
  await importedCard.getByRole('button', { name: 'Selected text to task', exact: true }).click();
  await expect.poll(async () => value(await actors.owner.client.from('tasks').select('id').eq('board_id', board.id).eq('title', 'Selected action for a task')).length).toBe(1);
  await expect(ownerPage.getByRole('status').filter({ hasText: 'All changes saved.' })).toBeVisible();
  await editor.click(); await editor.press('ControlOrMeta+a'); await importedCard.getByRole('button', { name: 'Selected text to task', exact: true }).click();
  await expect(ownerPage.getByRole('status').filter({ hasText: 'All changes saved.' })).toBeVisible();
  assert.equal(value(await actors.owner.client.from('tasks').select('id').eq('board_id', board.id).eq('title', 'Selected action for a task')).length, 1);
  results.push('selected rich-text content converts to one real task across repeated attempts');
  const grip = importedCard.getByRole('button', { name: 'Move note: Imported device note', exact: true }), gripBox = await grip.boundingBox(); assert(gripBox);
  await ownerPage.mouse.move(gripBox.x + 10, gripBox.y + 10); await ownerPage.mouse.down();
  for (const offset of [65, 10, 70, 15, 75, 20]) await ownerPage.mouse.move(gripBox.x + offset, gripBox.y + 10);
  await ownerPage.mouse.up(); await expect(ownerPage.getByRole('button', { name: 'Restore note: Imported device note', exact: true })).toBeVisible();
  await ownerPage.getByRole('button', { name: 'Restore note: Imported device note', exact: true }).click(); await expect(importedCard).toBeVisible();
  results.push('real pointer shake enters ephemeral Peek and restores the note');
  await ownerPage.goto(`${base}/notes?scope=personal`); await ownerPage.getByRole('button', { name: 'New note', exact: true }).click(); await ownerPage.getByLabel('Note title', { exact: true }).fill('Personal private thought');
  await expect.poll(async () => value(await actors.owner.client.from('notes').select('id').is('workspace_id', null)).length).toBe(1); assert.equal(value(await actors.viewer.client.from('notes').select('id').is('workspace_id', null)).length, 0); results.push('personal destination remains private outside workspace visibility');
  await ownerPage.screenshot({ path: resolve(root, 'personal-notes.png') });
} catch (error) { process.exitCode = 1; results.push(`FAIL: ${error.stack}`); if (ownerPage) await ownerPage.screenshot({ path: resolve(root, 'failure.png') }).catch(() => {}); }
finally {
  await browser?.close(); if (server.listening) await new Promise(done => server.close(done));
  if(users.length){const notes=await admin.from('notes').select('id').in('owner_user_id',users);if(notes.error)results.push(`FAIL cleanup: ${notes.error.message}`);else if(notes.data.length){const images=await admin.from('note_images').select('object_path').in('note_id',notes.data.map(note=>note.id));if(images.error)results.push(`FAIL cleanup: ${images.error.message}`);else if(images.data.length){const removed=await admin.storage.from('kora-note-images').remove(images.data.map(image=>image.object_path));if(removed.error)results.push(`FAIL cleanup: ${removed.error.message}`);}}}
  if (workspaceId) { const response = await admin.from('workspaces').delete().eq('id', workspaceId); if (response.error) results.push(`FAIL cleanup: ${response.error.message}`); }
  for (const id of users) { const response = await admin.auth.admin.deleteUser(id); if (response.error) results.push(`FAIL cleanup: ${response.error.message}`); }
  await writeFile(resolve(root, 'results.json'), JSON.stringify({ at: new Date().toISOString(), target, realAuthentication: true, fakeResponses: false, browserClosed: true, results }, null, 2)); console.log(JSON.stringify(results));
}
