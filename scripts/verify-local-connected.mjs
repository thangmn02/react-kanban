/** Real Auth/PostgREST/Storage/realtime checks against a restore-verified qualified target. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { qualificationTarget } from './qualification-target.mjs';

const { root, config, staging, target } = await qualificationTarget('scratch/product-completion-261027-0846/connected-services');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15000) }) } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const anon = createClient(config.API_URL, config.ANON_KEY, options);
const results = [], users = [], channels = [], objects = [], clients = {};
let workspaceId;
const value = result => { if (result.error) throw Error(result.error.message); return result.data; };
const check = async (name, action) => { try { await action(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); } catch (error) { results.push({ name, status: 'FAIL', message: error.message }); process.exitCode = 1; console.log(`FAIL ${name}: ${error.message}`); } };
try {
  const nonce = randomUUID();
  for (const role of ['owner', 'admin', 'member', 'viewer', 'unrelated']) {
    const password = randomUUID() + '!aB9';
    const email = `kora-${nonce}-${role}@example.invalid`;
    const user = value(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Qualification ${role}` } })).user;
    users.push(user.id);
    const client = createClient(config.API_URL, config.ANON_KEY, options);
    value(await client.auth.signInWithPassword({ email, password }));
    clients[role] = { client, id: user.id };
  }
  const owner = clients.owner.client;
  workspaceId = value(await owner.rpc('create_workspace_with_owner', { workspace_name: `Kora qualification ${nonce}` }));
  for (const role of ['admin', 'member', 'viewer']) value(await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: clients[role].id, role }));
  const board = value(await owner.from('boards').insert({ workspace_id: workspaceId, created_by: clients.owner.id, title: 'Connected qualification' }).select().single());
  const lists = value(await owner.from('lists').insert(['To-do', 'Doing', 'Done'].map((title, position) => ({ workspace_id: workspaceId, board_id: board.id, title, position }))).select());
  const list = title => lists.find(row => row.title === title).id;
  const task = value(await owner.from('tasks').insert({ workspace_id: workspaceId, board_id: board.id, list_id: list('To-do'), title: 'Connected transaction', position: 0, created_by: clients.owner.id, due_date: '2026-10-27', repeat_interval: 'daily' }).select().single());
  const request = (kind, operationId = randomUUID()) => ({ taskId: task.id, boardId: board.id, workspaceId, kind, operationId });
  await check('authenticated workflow transaction and duplicate operation', async () => {
    const same = request('complete'); const responses = await Promise.all([owner.rpc('transition_task_workflow', { request: same }), owner.rpc('transition_task_workflow', { request: same })]);
    responses.forEach(value);
    const row = value(await owner.from('tasks').select('*').eq('id', task.id).single()); assert.equal(row.is_done, true); assert.equal(row.list_id, list('Done')); assert.ok(row.completed_at);
    const activity = value(await owner.from('task_activities').select('id').eq('id', same.operationId)); assert.equal(activity.length, 1);
    const occurrences = value(await owner.from('tasks').select('id').eq('board_id', board.id)); assert.equal(occurrences.length, 2);
    value(await owner.rpc('transition_task_workflow', { request: request('reopen') }));
    const reopened = value(await owner.from('tasks').select('*').eq('id', task.id).single()); assert.equal(reopened.is_done, false); assert.equal(reopened.completed_at, null); assert.equal(reopened.list_id, list('To-do'));
  });
  await check('actual owner/admin/member/viewer/unrelated workspace identities', async () => {
    for (const role of ['owner', 'admin', 'member']) { value(await clients[role].client.rpc('transition_task_workflow', { request: request('complete') })); value(await clients[role].client.rpc('transition_task_workflow', { request: request('reopen') })); }
    for (const role of ['viewer', 'unrelated']) assert.ok((await clients[role].client.rpc('transition_task_workflow', { request: request('complete') })).error, `${role} must not edit`);
    assert.equal(value(await clients.unrelated.client.from('tasks').select('id').eq('id', task.id)).length, 0);
    assert.equal(value(await clients.viewer.client.from('tasks').select('id').eq('id', task.id)).length, 1);
    const denied = await clients.viewer.client.from('workspace_members').insert({ workspace_id: workspaceId, user_id: clients.unrelated.id, role: 'admin' }); assert.ok(denied.error);
  });
  const bucket = 'kora-profile-images'; const path = `${clients.owner.id}/${nonce}.png`; objects.push(path);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=', 'base64');
  await check('authenticated profile save, real private upload and reauthentication persistence', async () => {
    value(await owner.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: false }));
    value(await owner.from('profiles').update({ full_name: 'Connected identity', avatar_url: `${bucket}/${path}`, updated_at: new Date().toISOString() }).eq('id', clients.owner.id).select().single());
    const signed = value(await owner.storage.from(bucket).createSignedUrl(path, 60)); const response = await fetch(signed.signedUrl); assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    const { data: session } = await owner.auth.getSession();
    const second = createClient(config.API_URL, config.ANON_KEY, options); value(await second.auth.setSession({ access_token: session.session.access_token, refresh_token: session.session.refresh_token }));
    const saved = value(await second.from('profiles').select('full_name,avatar_url').eq('id', clients.owner.id).single()); assert.equal(saved.full_name, 'Connected identity'); assert.equal(saved.avatar_url, `${bucket}/${path}`);
  });
  await check('private image reads, cross-owner upload/delete and anonymous denial', async () => {
    value(await clients.member.client.storage.from(bucket).createSignedUrl(path, 60));
    assert.ok((await clients.unrelated.client.storage.from(bucket).createSignedUrl(path, 60)).error);
    assert.ok((await anon.storage.from(bucket).createSignedUrl(path, 60)).error);
    assert.ok((await clients.member.client.storage.from(bucket).upload(`${clients.owner.id}/denied.png`, png, { contentType: 'image/png' })).error);
    const deniedProfile = value(await clients.member.client.from('profiles').update({ full_name: 'Forbidden' }).eq('id', clients.owner.id).select()); assert.equal(deniedProfile.length, 0);
    await clients.member.client.storage.from(bucket).remove([path]); value(await owner.storage.from(bucket).createSignedUrl(path, 60));
  });
  await check('realtime subscription, disconnect, resubscribe and authoritative refresh', async () => {
    let received = 0;
    const diagnostics = [];
    const session = value(await owner.auth.getSession()).session;
    await owner.realtime.setAuth(session.access_token);
    const subscribe = async () => {
      const channel = owner.channel(`qualification-${randomUUID()}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${task.id}` }, () => received++);
      channels.push(channel);
      await new Promise((resolve, reject) => {
        let joined = false, databaseReady = false;
        const timer = setTimeout(() => reject(Error('Realtime database subscription readiness timeout')), 20000);
        const ready = () => { if (joined && databaseReady) { clearTimeout(timer); resolve(); } };
        channel.on('system', {}, payload => {
          diagnostics.push({ status: payload.status, message: payload.message, extension: payload.extension });
          if (payload.extension === 'postgres_changes' && payload.status === 'ok') { databaseReady = true; ready(); }
          else if (payload.extension === 'postgres_changes' && payload.status === 'error') { clearTimeout(timer); reject(Error('Realtime rejected the database subscription.')); }
        });
        channel.subscribe(status => { if (status === 'SUBSCRIBED') { joined = true; ready(); } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(timer); reject(Error(`Realtime ${status}`)); } });
      });
      return channel;
    };
    const wait = async count => { const end = Date.now() + 20000; while (received < count && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 100)); await writeFile(`${root}/realtime-diagnostics.json`, JSON.stringify({ received, diagnostics }, null, 2)); assert.ok(received >= count, 'Actual task update must arrive through Realtime.'); };
    const first = await subscribe(); value(await owner.rpc('transition_task_workflow', { request: request('complete') })); await wait(1); await owner.removeChannel(first);
    value(await owner.rpc('transition_task_workflow', { request: request('reopen') }));
    assert.equal(value(await owner.from('tasks').select('is_done').eq('id', task.id).single()).is_done, false);
    await subscribe(); const before = received; value(await owner.rpc('transition_task_workflow', { request: request('complete') })); await wait(before + 1);
  });
  await check('real session renewal and dynamic membership revocation', async () => {
    value(await owner.auth.refreshSession()); assert.equal(value(await owner.from('tasks').select('id').eq('id', task.id)).length, 1);
    value(await admin.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', clients.member.id));
    assert.equal(value(await clients.member.client.from('tasks').select('id').eq('id', task.id)).length, 0);
    assert.ok((await clients.member.client.rpc('transition_task_workflow', { request: request('reopen') })).error);
    assert.ok((await clients.member.client.storage.from(bucket).createSignedUrl(path, 60)).error);
  });
  await check('real invitation acceptance, duplicate acceptance, expiry, cancellation and wrong-account denial', async () => {
    const invite = async email => value(await owner.rpc('invite_workspace_member_by_email', { target_workspace_id: workspaceId, member_email: email, member_role: 'viewer' }));
    const identity = async email => {
      const password = `${randomUUID()}!aB9`, user = value(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user; users.push(user.id);
      const client = createClient(config.API_URL, config.ANON_KEY, options); value(await client.auth.signInWithPassword({ email, password })); return { client, id: user.id };
    };
    const acceptedEmail = `invite-accepted-${randomUUID()}@example.invalid`, pending = await invite(acceptedEmail); assert.equal(pending.status, 'invite_created');
    assert.equal((await invite(acceptedEmail)).status, 'invite_existing');
    assert.ok((await clients.viewer.client.rpc('accept_workspace_invite', { invite_token: pending.invite.token })).error);
    const invited = await identity(acceptedEmail);
    assert.equal(value(await invited.client.rpc('accept_workspace_invite', { invite_token: pending.invite.token })).status, 'accepted');
    assert.equal(value(await invited.client.rpc('accept_workspace_invite', { invite_token: pending.invite.token })).status, 'already_accepted');
    assert.equal(value(await admin.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', invited.id)).length, 1);
    const expiredEmail = `invite-expired-${randomUUID()}@example.invalid`, expired = await invite(expiredEmail);
    value(await admin.from('workspace_invites').update({ expires_at: '2020-01-01T00:00:00Z' }).eq('id', expired.invite.id));
    const expiredUser = await identity(expiredEmail); assert.ok((await expiredUser.client.rpc('accept_workspace_invite', { invite_token: expired.invite.token })).error);
    const cancelledEmail = `invite-cancelled-${randomUUID()}@example.invalid`, cancelled = await invite(cancelledEmail);
    value(await owner.from('workspace_invites').delete().eq('id', cancelled.invite.id)); const cancelledUser = await identity(cancelledEmail);
    assert.ok((await cancelledUser.client.rpc('accept_workspace_invite', { invite_token: cancelled.invite.token })).error);
  });
} catch (error) {
  results.push({ name: 'qualification failure', status: 'FAIL', message: error.message }); process.exitCode = 1;
} finally {
  for (const channel of channels) { try { await channel.unsubscribe(); } catch { /* Preserve the check result. */ } }
  for (const { client } of Object.values(clients)) { try { await client.removeAllChannels(); } catch { /* Fixture cleanup still runs. */ } }
  if (objects.length) { const removed = await admin.storage.from('kora-profile-images').remove(objects); if (removed.error) results.push({ name: 'owned image cleanup', status: 'FAIL', message: removed.error.message }); }
  if (workspaceId) { const deleted = await admin.from('workspaces').delete().eq('id', workspaceId); if (deleted.error) results.push({ name: 'owned fixture cleanup', status: 'FAIL', message: deleted.error.message }); }
  for (const id of users) { const deleted = await admin.auth.admin.deleteUser(id); if (deleted.error) results.push({ name: 'owned identity cleanup', status: 'FAIL', message: deleted.error.message }); }
  await writeFile(`${root}/local-connected-results.json`, JSON.stringify({ at: new Date().toISOString(), target, backupVerified: true, hostedQualified: staging && !results.some(row => row.status === 'FAIL'), results }, null, 2));
  if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
  console.log(JSON.stringify(results));
}
