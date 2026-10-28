/** Real Notes Auth/RLS/RPC qualification against a restore-verified target. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { qualificationTarget } from './qualification-target.mjs';

const { root, config, staging, target } = await qualificationTarget('scratch/product-completion-261027-0846/notes-services');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options), anonymous = createClient(config.API_URL, config.ANON_KEY, options);
const ok = response => { if (response.error) throw Object.assign(Error(response.error.message), { code: response.error.code }); return response.data; };
const users = [], workspaces = [], results = [], actors = {};
const check = async (name, fn) => { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const rpc = async (actor, name, request) => ok(await actors[actor].client.rpc(name, { request }));
const create = (actor, workspaceId, extra = {}) => rpc(actor, 'save_note', { id: randomUUID(), workspaceId, title: 'Private thought', content: { html: '<p>Original</p>', checklist: [] }, expectedRevision: 0, writeToken: randomUUID(), ...extra });
const access = (row, user, permission) => rpc('owner', 'set_note_access', { id: row.id, expectedRevision: row.revision, userId: actors[user].id, permission });
const read = async (actor, id) => ok(await actors[actor].client.from('notes').select('*').eq('id', id));
const denied = async promise => assert.ok((await promise).error, 'The operation must be denied.');
let workspaceId;
try {
  const nonce = randomUUID();
  for (const role of ['owner', 'admin', 'member', 'viewer', 'unrelated']) {
    const email = `notes-${nonce}-${role}@example.invalid`, password = `${randomUUID()}!aB9`;
    const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user; users.push(user.id);
    const client = createClient(config.API_URL, config.ANON_KEY, options); ok(await client.auth.signInWithPassword({ email, password })); const originalRpc = client.rpc.bind(client); client.rpc = (name, args) => originalRpc(name, args?.request ? { ...args, request: { actorUserId: user.id, ...args.request } } : args); actors[role] = { client, id: user.id };
  }
  workspaceId = ok(await actors.owner.client.rpc('create_workspace_with_owner', { workspace_name: `Notes qualification ${nonce}` })); workspaces.push(workspaceId);
  for (const role of ['admin', 'member', 'viewer']) ok(await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: actors[role].id, role }));
  const board = ok(await actors.owner.client.from('boards').insert({ workspace_id: workspaceId, created_by: actors.owner.id, title: 'Notes qualification' }).select().single());
  const list = ok(await actors.owner.client.from('lists').insert({ workspace_id: workspaceId, board_id: board.id, title: 'To-do', position: 0 }).select().single());
  const task = ok(await actors.owner.client.from('tasks').insert({ workspace_id: workspaceId, board_id: board.id, list_id: list.id, title: 'Linked task', created_by: actors.owner.id, position: 0 }).select().single());
  let note = await create('owner', workspaceId);
  await check('private personal and workspace isolation; anonymous and direct-write denial', async () => {
    const personal = await create('owner', null);
    for (const role of ['admin', 'member', 'viewer', 'unrelated']) { assert.equal((await read(role, note.id)).length, 0); assert.equal((await read(role, personal.id)).length, 0); }
    const anonymousRead = await anonymous.from('notes').select('id').eq('id', note.id); assert.ok(anonymousRead.error || !anonymousRead.data.length);
    await denied(actors.owner.client.from('notes').update({ title: 'Bypass' }).eq('id', note.id));
    await denied(actors.viewer.client.rpc('save_note', { request: { id: randomUUID(), workspaceId, expectedRevision: 0, writeToken: randomUUID(), content: { html: '', checklist: [] } } }));
  });
  await check('workspace visibility respects membership and workspace write roles', async () => {
    note = await rpc('owner', 'set_note_access', { id: note.id, expectedRevision: note.revision, visibility: 'workspace' });
    for (const role of ['admin', 'member', 'viewer']) assert.equal((await read(role, note.id)).length, 1);
    assert.equal((await read('unrelated', note.id)).length, 0);
    note = await rpc('member', 'save_note', { id: note.id, workspaceId, expectedRevision: note.revision, writeToken: randomUUID(), title: 'Member edit', content: note.content });
    await denied(actors.viewer.client.rpc('save_note', { request: { id: note.id, workspaceId, expectedRevision: note.revision, writeToken: randomUUID(), content: note.content } }));
    note = await rpc('owner', 'set_note_access', { id: note.id, expectedRevision: note.revision, visibility: 'private' });
  });
  await check('explicit view/comment/edit; comments authorship; owner-only management', async () => {
    note = await access(note, 'viewer', 'view');
    await denied(actors.viewer.client.rpc('mutate_note_comment', { request: { noteId: note.id, id: randomUUID(), action: 'create', body: 'Denied' } }));
    note = await access(note, 'viewer', 'comment');
    const comment = await rpc('viewer', 'mutate_note_comment', { noteId: note.id, id: randomUUID(), action: 'create', body: 'A real comment' });
    note = await access(note, 'member', 'edit');
    await denied(actors.member.client.rpc('mutate_note_comment', { request: { noteId: note.id, id: comment.id, action: 'delete', expectedRevision: comment.revision } }));
    await rpc('owner', 'mutate_note_comment', { noteId: note.id, id: comment.id, action: 'delete', expectedRevision: comment.revision });
    await denied(actors.member.client.rpc('set_note_access', { request: { id: note.id, expectedRevision: note.revision, visibility: 'workspace' } }));
    await denied(actors.owner.client.rpc('set_note_access', { request: { id: note.id, expectedRevision: note.revision, userId: actors.unrelated.id, permission: 'view' } }));
  });
  await check('concurrent compare-and-swap has one winner; retry is idempotent', async () => {
    const request = { id: note.id, workspaceId, expectedRevision: note.revision, writeToken: randomUUID(), title: 'Winner', content: note.content };
    const writes = await Promise.all([actors.owner.client.rpc('save_note', { request }), actors.member.client.rpc('save_note', { request: { ...request, writeToken: randomUUID(), title: 'Other' } })]);
    assert.equal(writes.filter(row => !row.error).length, 1);
    const failure = writes.find(row => row.error).error;
    assert.equal(failure.code, 'PT409', `Concurrent writer failed unexpectedly: ${failure.message}`);
    const winner = writes.find(row => !row.error).data; note = winner;
    const actor = winner.write_token === request.writeToken ? 'owner' : 'member';
    const retried = await rpc(actor, 'save_note', { ...request, title: winner.title, writeToken: winner.write_token }); assert.equal(retried.revision, winner.revision);
  });
  await check('explicit import retries preserve original remote content and deleted state', async () => {
    const importKey = `device:${nonce}`; let imported = await create('owner', workspaceId, { importKey });
    const retried = await create('owner', workspaceId, { importKey, title: 'Must not overwrite' }); assert.equal(retried.id, imported.id); assert.equal(retried.title, imported.title);
    imported = await rpc('owner', 'set_note_deleted', { id: imported.id, expectedRevision: imported.revision, deleted: true });
    await assert.rejects(create('owner', workspaceId, { importKey }));
    await rpc('owner', 'set_note_deleted', { id: imported.id, expectedRevision: imported.revision, deleted: false });
  });
  await check('per-user presentation; valid task links; invalid document rollback', async () => {
    await rpc('viewer', 'save_note_presentation', { id: note.id, presentation: { x: 123, pinned: true } });
    assert.equal(ok(await actors.owner.client.from('note_user_presentation').select('*').eq('note_id', note.id)).length, 0);
    assert.equal(ok(await actors.viewer.client.from('note_user_presentation').select('*').eq('note_id', note.id)).length, 1);
    await rpc('viewer', 'save_note_presentation', { id: note.id, presentation: { x: 999 }, onlyIfAbsent: true });
    assert.equal(ok(await actors.viewer.client.from('note_user_presentation').select('*').eq('note_id', note.id))[0].presentation.x, 123);
    note = await rpc('owner', 'save_note', { id: note.id, workspaceId, expectedRevision: note.revision, writeToken: randomUUID(), title: note.title, content: note.content, taskId: task.id });
    assert.equal(ok(await actors.viewer.client.from('note_task_links').select('*').eq('note_id', note.id))[0].task_id, task.id);
    await denied(actors.owner.client.rpc('save_note', { request: { id: note.id, workspaceId, expectedRevision: note.revision, writeToken: randomUUID(), title: 'Invalid', content: { html: '', checklist: [{ id: 'x', text: 'bad', isDone: 'yes' }] } } }));
    assert.equal((await read('owner', note.id))[0].revision, note.revision);
  });
  await check('session renewal and explicit stale-account denial', async () => {
    ok(await actors.owner.client.auth.refreshSession()); assert.equal((await read('owner', note.id)).length, 1);
    await denied(actors.owner.client.rpc('save_note', { request: { actorUserId: actors.member.id, id: note.id, workspaceId, expectedRevision: note.revision, writeToken: randomUUID(), title: 'Stale account', content: note.content } }));
    assert.equal((await read('owner', note.id))[0].revision, note.revision);
  });
  await check('revocation and membership removal apply immediately; rejoin cannot revive grants', async () => {
    note = await access(note, 'viewer', null); assert.equal((await read('viewer', note.id)).length, 0);
    await denied(actors.viewer.client.rpc('save_note_presentation', { request: { id: note.id, presentation: {} } }));
    ok(await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', actors.member.id));
    assert.equal((await read('member', note.id)).length, 0);
    ok(await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: actors.member.id, role: 'member' })); assert.equal((await read('member', note.id)).length, 0);
    note = await rpc('owner', 'set_note_deleted', { id: note.id, expectedRevision: note.revision, deleted: true });
    assert.equal((await read('owner', note.id)).length, 1);
    note = await rpc('owner', 'set_note_deleted', { id: note.id, expectedRevision: note.revision, deleted: false }); assert.equal(note.deleted_at, null);
  });
} catch (error) { results.push({ name: 'qualification failure', status: 'FAIL', message: error.message }); process.exitCode = 1; }
finally {
  for (const id of workspaces) { const response = await admin.from('workspaces').delete().eq('id', id); if (response.error) results.push({ name: 'workspace cleanup', status: 'FAIL', message: response.error.message }); }
  for (const id of users) { const response = await admin.auth.admin.deleteUser(id); if (response.error) results.push({ name: 'identity cleanup', status: 'FAIL', message: response.error.message }); }
  await writeFile(`${root}/connected-notes-results.json`, JSON.stringify({ at: new Date().toISOString(), localOnly: !staging, target, backupRestoreVerified: true, results }, null, 2));
  console.log(JSON.stringify(results)); if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
}
