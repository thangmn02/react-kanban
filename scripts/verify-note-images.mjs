/** Real image/Auth/RLS/Storage and private invalidation checks. Generated fixtures only. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { handleNoteImages } from '../server/note-images.ts';
import { qualificationTarget } from './qualification-target.mjs';

const { config, root, target } = await qualificationTarget('scratch/notes-completion-261027-1806/local-images');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options), actors = {}, users = [], workspaces = [], paths = [], channels = [], results = [];
const serverConfig = { supabaseUrl: config.API_URL, anonKey: config.ANON_KEY, serviceRoleKey: config.SERVICE_ROLE_KEY };
const ok = response => { assert.ifError(response.error); return response.data; };
const rpc = async (who, name, request) => ok(await actors[who].client.rpc(name, { request: { ...request, actorUserId: actors[who].id } }));
const denied = async promise => assert.ok((await promise).error, 'The operation must fail closed.');
const check = async (name, run) => { await run(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
const bytes = await sharp({ create: { width: 320, height: 180, channels: 3, background: '#3377aa' } }).png().toBuffer();
let note, workspaceId;
const imageRequest = (who, id) => new Request('http://127.0.0.1/api/note-images', { method: 'POST', headers: { Authorization: `Bearer ${actors[who].token}`, 'X-Note-Id': note.id, 'X-Note-Image-Id': id, 'Content-Type': 'image/png' }, body: bytes });
const join = (who, topic) => new Promise(resolve => {
  const channel = actors[who].client.channel(topic, { config: { private: true, broadcast: { ack:true } } }); channels.push({ client: actors[who].client, channel });
  const timer = setTimeout(() => resolve({ status: 'TIMEOUT', channel }), 12000);
  channel.subscribe(status => { if (['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(status)) { clearTimeout(timer); resolve({ status, channel }); } });
});
try {
  for (const role of ['owner','editor','viewer','unrelated']) {
    const email = `note-image-${randomUUID()}@example.invalid`, password = `${randomUUID()}!aB9`;
    const user = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user; users.push(user.id);
    const client = createClient(config.API_URL, config.ANON_KEY, options), session = ok(await client.auth.signInWithPassword({ email, password })).session;
    await client.realtime.setAuth(session.access_token); actors[role] = { id: user.id, token: session.access_token, client };
  }
  workspaceId = ok(await actors.owner.client.rpc('create_workspace_with_owner', { workspace_name: `Image qualification ${randomUUID()}` })); workspaces.push(workspaceId);
  for (const role of ['editor','viewer']) ok(await admin.from('workspace_members').insert({ workspace_id: workspaceId, user_id: actors[role].id, role: role === 'editor' ? 'member' : 'viewer' }));
  note = await rpc('owner','save_note',{ id: randomUUID(), workspaceId, expectedRevision: 0, writeToken: randomUUID(), title: 'Private images', content: { html: '<p>Text survives uploads</p>', checklist: [] } });
  note = await rpc('owner','set_note_access',{ id: note.id, expectedRevision: note.revision, userId: actors.editor.id, permission: 'edit' });
  note = await rpc('owner','set_note_access',{ id: note.id, expectedRevision: note.revision, userId: actors.viewer.id, permission: 'view' });
  let image;
  await check('private image upload; final response loss retries one stable attachment', async () => {
    const id = randomUUID(); paths.push(`${note.id}/${id}`);
    const first = await handleNoteImages(imageRequest('editor', id), serverConfig); assert.equal(first.status,200,await first.clone().text()); // caller loses this response
    const retry = await handleNoteImages(imageRequest('editor', id), serverConfig); assert.equal(retry.status,200,await retry.clone().text()); image = await retry.json(); assert.equal(image.id,id);
    assert.equal(ok(await admin.from('note_images').select('*').eq('id',id)).length,1);
    assert.ok(ok(await actors.viewer.client.storage.from('kora-note-images').download(`${note.id}/${id}`)).size>0);
    await denied(actors.unrelated.client.storage.from('kora-note-images').download(`${note.id}/${id}`));
  });
  await check('finalize commit with lost response preserves bytes and reconciles ready state', async () => {
    const id = randomUUID(); paths.push(`${note.id}/${id}`); const original = globalThis.fetch; let dropped = false;
    globalThis.fetch = async (input, init) => { const response = await original(input,init); const url = input instanceof Request ? input.url : String(input); if (!dropped && url.includes('/rpc/finalize_note_image')) { dropped = true; throw TypeError('Simulated lost finalize response after commit'); } return response; };
    try { const response = await handleNoteImages(imageRequest('editor',id),serverConfig); assert.equal(response.status,200,await response.clone().text()); assert.equal(dropped,true); }
    finally { globalThis.fetch = original; }
    assert.ok(ok(await actors.owner.client.storage.from('kora-note-images').download(`${note.id}/${id}`)).size>0);
  });
  await check('direct bucket/metadata writes, forged foreign image references and viewer uploads are denied', async () => {
    await denied(actors.editor.client.storage.from('kora-note-images').upload(`${note.id}/${randomUUID()}`,bytes,{ contentType:'image/png' }));
    await denied(actors.editor.client.from('note_images').update({ state:'ready' }).eq('id',image.id));
    await denied(actors.editor.client.storage.from('kora-note-images').update(`${note.id}/${image.id}`,bytes));
    const removed = await actors.editor.client.storage.from('kora-note-images').remove([`${note.id}/${image.id}`]);
    assert.ok(removed.error || removed.data.length===0); assert.ok(ok(await actors.owner.client.storage.from('kora-note-images').download(`${note.id}/${image.id}`)).size>0);
    const response = await handleNoteImages(imageRequest('viewer',randomUUID()),serverConfig); assert.equal(response.status,403);
    const foreign = await rpc('owner','save_note',{ id:randomUUID(),workspaceId,expectedRevision:0,writeToken:randomUUID(),title:'Other note',content:{html:'',checklist:[]} });
    await denied(actors.owner.client.rpc('save_note',{request:{actorUserId:actors.owner.id,id:foreign.id,workspaceId,expectedRevision:foreign.revision,writeToken:randomUUID(),content:{html:`<img data-kora-note-image="${image.id}">`,checklist:[]}}}));
  });
  await check('typed image references prevent retiring uppercase or repeated in-use identities', async () => {
    note = await rpc('owner','save_note',{id:note.id,workspaceId,expectedRevision:note.revision,writeToken:randomUUID(),title:note.title,content:{html:`<img data-kora-note-image="${image.id.toUpperCase()}" width="200"><img data-kora-note-image="${image.id}" width="200">`,checklist:[]}});
    await denied(actors.owner.client.rpc('retire_note_image',{request:{actorUserId:actors.owner.id,id:image.id}}));
    await denied(actors.owner.client.rpc('save_note',{request:{actorUserId:actors.owner.id,id:note.id,workspaceId,expectedRevision:note.revision,writeToken:randomUUID(),content:{html:`<img data-kora-note-image="${image.id}" src="https://foreign.test/image.png">`,checklist:[]}}}));
  });
  await check('creator account deletion preserves shared image; revocation and Trash enforce parent access', async () => {
    ok(await admin.auth.admin.deleteUser(actors.editor.id));
    assert.equal(ok(await admin.from('note_images').select('created_by').eq('id',image.id).single()).created_by,null);
    assert.ok(ok(await actors.viewer.client.storage.from('kora-note-images').download(`${note.id}/${image.id}`)).size>0);
    note = ok(await actors.owner.client.from('notes').select('*').eq('id',note.id).single());
    note = await rpc('owner','set_note_access',{id:note.id,expectedRevision:note.revision,userId:actors.viewer.id,permission:null});
    await denied(actors.viewer.client.storage.from('kora-note-images').download(`${note.id}/${image.id}`));
    note = await rpc('owner','set_note_deleted',{id:note.id,expectedRevision:note.revision,deleted:true});
    assert.ok(ok(await actors.owner.client.storage.from('kora-note-images').download(`${note.id}/${image.id}`)).size>0);
    note = await rpc('owner','set_note_deleted',{id:note.id,expectedRevision:note.revision,deleted:false});
  });
  await check('private Broadcast joins enforce identity and notifications contain no resource identifiers', async () => {
    const own = await join('owner',`notes:user:${actors.owner.id}`); assert.equal(own.status,'SUBSCRIBED');
    const foreign = await join('unrelated',`notes:user:${actors.owner.id}`); assert.notEqual(foreign.status,'SUBSCRIBED');
    let received; const notification = new Promise(resolve => { received=resolve; });
    own.channel.on('broadcast',{event:'invalidate'},event=>received(event.payload));
    note = await rpc('owner','set_note_access',{id:note.id,expectedRevision:note.revision,userId:actors.viewer.id,permission:'view'});
    const payload = await Promise.race([notification,new Promise((_,reject)=>setTimeout(()=>reject(Error('No private invalidation received')),7000))]);
    assert.equal(payload.version,1); assert.ok(Object.keys(payload).every(key=>['id','version'].includes(key))); // Realtime adds its own message UUID.
    assert.ok(![note.id,...Object.values(actors).map(actor=>actor.id)].includes(payload.id));
    const sent = await own.channel.send({type:'broadcast',event:'invalidate',payload:{version:99}}); assert.notEqual(sent,'ok');
  });
  await check('scope movement resets grants and requires CAS; cleanup excludes ready media', async () => {
    const personal = await rpc('owner','move_note',{id:note.id,workspaceId:null,expectedRevision:note.revision});
    assert.equal(personal.id,note.id); assert.equal(personal.visibility,'private');
    assert.equal(ok(await actors.viewer.client.from('notes').select('id').eq('id',note.id)).length,0);
    await denied(actors.owner.client.rpc('move_note',{request:{actorUserId:actors.owner.id,id:note.id,workspaceId,expectedRevision:note.revision}}));
    note = await rpc('owner','move_note',{id:note.id,workspaceId,expectedRevision:personal.revision});
    await denied(actors.owner.client.rpc('note_image_cleanup_candidates'));
    const cleanup = ok(await admin.rpc('note_image_cleanup_candidates')); assert.ok(!cleanup.some(row=>paths.includes(row.object_path)));
  });
} catch(error) { results.push({name:'qualification failure',status:'FAIL',message:error.message}); process.exitCode=1; }
finally {
  for (const {client,channel} of channels) await client.removeChannel(channel);
  if(paths.length) { const removed=await admin.storage.from('kora-note-images').remove(paths); if(removed.error) results.push({name:'image cleanup',status:'FAIL',message:removed.error.message}); }
  for(const id of workspaces) { const response=await admin.from('workspaces').delete().eq('id',id); if(response.error)results.push({name:'workspace cleanup',status:'FAIL',message:response.error.message}); }
  for(const id of users) { const response=await admin.auth.admin.deleteUser(id); if(response.error && !/not found/i.test(response.error.message))results.push({name:'identity cleanup',status:'FAIL',message:response.error.message}); }
  for(const actor of Object.values(actors)) await actor.client.removeAllChannels();
  await writeFile(`${root}/image-results.json`,JSON.stringify({at:new Date().toISOString(),target,results},null,2)); console.log(JSON.stringify(results));
  if(results.some(row=>row.status==='FAIL'))process.exitCode=1;
}
