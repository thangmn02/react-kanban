/** Generated-fixture checks against real Auth, task/Notes RPCs, RLS and history. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';
import {qualificationTarget} from './qualification-target.mjs';
import {handleNoteImages} from '../server/note-images.ts';

const {config,root,target,staging}=await qualificationTarget('scratch/notes-completion-261027-1806/local-workflow-services');
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,options),actors={},users=[],workspaces=[],paths=[],results=[];
const ok=response=>{assert.ifError(response.error);return response.data;};
const rpc=async(who,name,request)=>ok(await actors[who].client.rpc(name,{request:{...request,actorUserId:actors[who].id}}));
const rejected=async(promise,code)=>{const response=await promise;assert.ok(response.error,'Operation must fail closed');if(code)assert.equal(response.error.code,code);};
const check=async(name,action)=>{await action();results.push({name,status:'PASS'});console.log(`PASS ${name}`);};
const saved=async who=>ok(await actors[who].client.rpc('list_saved_context',{actor_user_id:actors[who].id}));
const saveReference=(who,kind,id,value=true)=>rpc(who,'set_saved_context',{resourceType:kind,resourceId:id,saved:value});
let workspaceId,task,comment,note;
try{
  for(const role of ['owner','admin','member','viewer','unrelated']){const email=`workflow-qualification-${randomUUID()}@example.invalid`,password=`${randomUUID()}!aB9`;const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user.id);const client=createClient(config.API_URL,config.ANON_KEY,options);ok(await client.auth.signInWithPassword({email,password}));actors[role]={id:user.id,client};}
  workspaceId=ok(await actors.owner.client.rpc('create_workspace_with_owner',{workspace_name:`Workflow qualification ${randomUUID()}`}));workspaces.push(workspaceId);
  for(const role of ['admin','member','viewer'])ok(await admin.from('workspace_members').insert({workspace_id:workspaceId,user_id:actors[role].id,role}));
  const board=ok(await admin.from('boards').insert({title:'Generated workflow board',workspace_id:workspaceId,created_by:actors.owner.id}).select().single());
  const list=ok(await admin.from('lists').insert({title:'Generated workflow list',board_id:board.id,workspace_id:workspaceId,position:0}).select().single());
  task=ok(await admin.from('tasks').insert({title:'Original generated task',board_id:board.id,list_id:list.id,workspace_id:workspaceId,created_by:actors.owner.id,position:0}).select().single());
  await check('task comments preserve original identity, enforce actor/role CAS and retry one token',async()=>{
    const request={id:randomUUID(),taskId:task.id,writeToken:randomUUID(),action:'create',body:'Original task comment',expectedRevision:0};comment=await rpc('member','mutate_task_comment',request);assert.equal((await rpc('member','mutate_task_comment',{...request,body:'Altered replay body'})).body,'Original task comment');
    for(const role of ['viewer','unrelated'])await rejected(actors[role].client.rpc('mutate_task_comment',{request:{...request,id:randomUUID(),writeToken:randomUUID(),actorUserId:actors[role].id}}),'42501');
    await rejected(actors.owner.client.rpc('mutate_task_comment',{request:{...request,actorUserId:actors.member.id}}),'42501');
    await rejected(actors.owner.client.from('task_comments').insert({...comment,id:randomUUID()}));
    await rejected(actors.member.client.rpc('mutate_task_comment',{request:{id:comment.id,taskId:task.id,action:'edit',body:'Stale edit',expectedRevision:0,writeToken:randomUUID(),actorUserId:actors.member.id}}),'PT409');
    assert.equal(ok(await actors.viewer.client.from('task_comments').select('*').eq('id',comment.id)).length,1);assert.equal(ok(await actors.unrelated.client.from('task_comments').select('*').eq('id',comment.id)).length,0);
  });
  await check('saving task and comment stores references and resolves current original text',async()=>{
    await saveReference('viewer','task',task.id);await saveReference('viewer','task_comment',comment.id);await saveReference('viewer','task_comment',comment.id);const references=await saved('viewer');assert.equal(references.length,2);assert.equal(references.find(row=>row.resourceType==='task_comment').source.preview,'Original task comment');
    comment=await rpc('member','mutate_task_comment',{id:comment.id,taskId:task.id,action:'edit',body:'Edited original task comment',expectedRevision:comment.revision,writeToken:randomUUID()});assert.equal((await saved('viewer')).find(row=>row.resourceType==='task_comment').source.preview,comment.body);
    assert.equal(ok(await admin.from('notes').select('id').eq('workspace_id',workspaceId)).length,0,'Saving a comment must not create a note');
    assert.equal(ok(await actors.member.client.rpc('list_saved_context',{actor_user_id:actors.viewer.id})).length,0);await rejected(actors.viewer.client.rpc('set_saved_context',{request:{actorUserId:actors.member.id,resourceType:'task',resourceId:task.id,saved:true}}),'42501');
  });
  await check('archived/deleted/revoked sources expose no previews and stale references remain removable',async()=>{
    for(const [table,id]of [['lists',list.id],['boards',board.id],['tasks',task.id]]){ok(await admin.from(table).update({archived_at:new Date().toISOString()}).eq('id',id));assert.ok((await saved('viewer')).every(row=>row.source===null));assert.equal(ok(await actors.viewer.client.from('task_comments').select('id').eq('task_id',task.id)).length,0);ok(await admin.from(table).update({archived_at:null}).eq('id',id));}
    ok(await admin.from('workspace_members').delete().eq('workspace_id',workspaceId).eq('user_id',actors.viewer.id));assert.ok((await saved('viewer')).every(row=>row.source===null));await saveReference('viewer','task_comment',comment.id,false);assert.equal((await saved('viewer')).length,1);ok(await admin.from('workspace_members').insert({workspace_id:workspaceId,user_id:actors.viewer.id,role:'viewer'}));
    comment=await rpc('admin','mutate_task_comment',{id:comment.id,taskId:task.id,action:'delete',expectedRevision:comment.revision,writeToken:randomUUID()});await saveReference('viewer','task',task.id,false);await rejected(actors.member.client.rpc('mutate_task_comment',{request:{id:comment.id,taskId:task.id,action:'edit',body:'Resurrect',expectedRevision:comment.revision,writeToken:randomUUID(),actorUserId:actors.member.id}}),'PT409');
  });
  note=await rpc('owner','save_note',{id:randomUUID(),workspaceId,title:'Original note',content:{html:'<p>Original history text</p>',checklist:[]},expectedRevision:0,writeToken:randomUUID()});
  await check('note history is owner-private and restores the same ID with CAS/idempotent tokens',async()=>{
    const first=note;note=await rpc('owner','save_note',{id:note.id,workspaceId,title:'Later note',content:{html:'<p>Later text</p>',checklist:[]},expectedRevision:note.revision,writeToken:randomUUID()});
    const revisions=ok(await actors.owner.client.from('note_revisions').select('*').eq('note_id',note.id));assert.equal(revisions.length,1);assert.deepEqual(revisions[0].content,first.content);
    note=await rpc('owner','set_note_access',{id:note.id,expectedRevision:note.revision,userId:actors.member.id,permission:'edit'});assert.equal(ok(await actors.member.client.from('note_revisions').select('*').eq('note_id',note.id)).length,0);
    await rejected(actors.owner.client.rpc('restore_note_revision',{request:{actorUserId:actors.owner.id,noteId:note.id,revisionId:revisions[0].id,expectedRevision:note.revision,writeToken:note.write_token}}),'PT409');
    const request={noteId:note.id,revisionId:revisions[0].id,expectedRevision:note.revision,writeToken:randomUUID()};const restored=await rpc('owner','restore_note_revision',request),retry=await rpc('owner','restore_note_revision',request);assert.equal(restored.id,first.id);assert.deepEqual(restored.content,first.content);assert.equal(retry.revision,restored.revision);note=retry;
    await rejected(actors.owner.client.rpc('restore_note_revision',{request:{...request,actorUserId:actors.owner.id,writeToken:randomUUID()}}),'PT409');
    await rejected(actors.member.client.rpc('restore_note_revision',{request:{...request,actorUserId:actors.member.id,writeToken:randomUUID(),expectedRevision:note.revision}}),'42501');
  });
  await check('note bookmarks and saved references agree through both entry points',async()=>{
    await rpc('owner','save_note_presentation',{id:note.id,presentation:{pinned:true,x:42}});assert.equal((await saved('owner')).filter(row=>row.resourceId===note.id).length,1);await saveReference('owner','note',note.id,false);const presentation=ok(await actors.owner.client.from('note_user_presentation').select('*').eq('note_id',note.id).single()).presentation;assert.equal(presentation.pinned,false);assert.equal(presentation.x,42);
    await saveReference('member','note',note.id);note=await rpc('owner','set_note_access',{id:note.id,expectedRevision:note.revision,userId:actors.member.id,permission:null});assert.equal((await saved('member')).find(row=>row.resourceId===note.id).source,null);await saveReference('member','note',note.id,false);
  });
  if(!staging)await check('mixed bookmark APIs follow one lock order in two real database sessions',async()=>{
    await rpc('owner','save_note_presentation',{id:note.id,presentation:{pinned:true}});
    const claims=JSON.stringify({sub:actors.owner.id,role:'authenticated'}),actorLock=`hashtextextended('saved-context:${actors.owner.id}',0)`;
    const sql=body=>`begin;set local statement_timeout='8s';set local role authenticated;select set_config('request.jwt.claims','${claims}',true);${body};commit;`;
    const run=statement=>new Promise((resolve,reject)=>{const child=spawn('docker',['exec','supabase_db_react-kanban','psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-c',statement],{windowsHide:true,stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',bytes=>errors+=bytes);child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(errors)));});
    const left=run(sql(`select pg_advisory_xact_lock(${actorLock});select pg_sleep(0.4);select public.set_saved_context('${JSON.stringify({actorUserId:actors.owner.id,resourceType:'note',resourceId:note.id,saved:true})}'::jsonb)`));
    await new Promise(resolve=>setTimeout(resolve,100));const right=run(sql(`select public.save_note_presentation('${JSON.stringify({actorUserId:actors.owner.id,id:note.id,presentation:{pinned:false}})}'::jsonb)`));await Promise.all([left,right]);assert.equal((await saved('owner')).some(row=>row.resourceId===note.id),false);
  });
  await check('both bookmark APIs enforce the same new-reference bound without partial presentation writes',async()=>{
    const references=Array.from({length:500},()=>({id:randomUUID(),owner_user_id:actors.owner.id,workspace_id:workspaceId,title:'Generated bound fixture',content:{html:'',checklist:[]}}));ok(await admin.from('notes').insert(references));const existing=ok(await admin.from('saved_context').select('*').eq('user_id',actors.owner.id));if(existing.length)ok(await admin.from('saved_context').delete().eq('user_id',actors.owner.id));ok(await admin.from('saved_context').insert(references.slice(0,499).map(row=>({user_id:actors.owner.id,resource_type:'note',resource_id:row.id}))));await saveReference('owner','note',references[499].id);await rejected(actors.owner.client.rpc('save_note_presentation',{request:{actorUserId:actors.owner.id,id:note.id,presentation:{pinned:true}}}));assert.equal((await saved('owner')).length,500);await saveReference('owner','note',references[0].id,false);await rpc('owner','save_note_presentation',{id:note.id,presentation:{pinned:true}});assert.equal((await saved('owner')).length,500);
  });
  await check('history retains uppercase/repeated image identities while unused assets can retire',async()=>{
    const bytes=await sharp({create:{width:40,height:30,channels:3,background:'#336699'}}).png().toBuffer(),session=ok(await actors.owner.client.auth.getSession()).session;
    const upload=async()=>{const id=randomUUID();paths.push(`${note.id}/${id}`);const response=await handleNoteImages(new Request('http://127.0.0.1/api/note-images',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'X-Note-Id':note.id,'X-Note-Image-Id':id,'Content-Type':'image/png'},body:bytes}),{supabaseUrl:config.API_URL,anonKey:config.ANON_KEY,serviceRoleKey:config.SERVICE_ROLE_KEY});assert.equal(response.status,200,await response.clone().text());return response.json();};
    const retained=await upload(),unused=await upload();note=await rpc('owner','save_note',{id:note.id,workspaceId,title:note.title,content:{html:`<img data-kora-note-image="${retained.id.toUpperCase()}"><img data-kora-note-image="${retained.id}">`,checklist:[]},expectedRevision:note.revision,writeToken:randomUUID()});note=await rpc('owner','save_note',{id:note.id,workspaceId,title:note.title,content:{html:'<p>Image retained in history</p>',checklist:[]},expectedRevision:note.revision,writeToken:randomUUID()});await rejected(actors.owner.client.rpc('retire_note_image',{request:{id:retained.id,actorUserId:actors.owner.id}}),'PT409');await rpc('owner','retire_note_image',{id:unused.id});assert.equal(ok(await admin.from('note_images').select('state').eq('id',unused.id).single()).state,'retired');
  });
}catch(error){results.push({name:'qualification failure',status:'FAIL',message:error.message});process.exitCode=1;}
finally{
  if(paths.length){const response=await admin.storage.from('kora-note-images').remove(paths);if(response.error)results.push({name:'asset cleanup',status:'FAIL',message:response.error.message});}
  for(const id of workspaces){const response=await admin.from('workspaces').delete().eq('id',id);if(response.error)results.push({name:'workspace cleanup',status:'FAIL',message:response.error.message});}
  for(const id of users){const response=await admin.auth.admin.deleteUser(id);if(response.error)results.push({name:'identity cleanup',status:'FAIL',message:response.error.message});}
  for(const actor of Object.values(actors))await actor.client.removeAllChannels();
  await writeFile(`${root}/workflow-results.json`,JSON.stringify({at:new Date().toISOString(),target,results},null,2));console.log(JSON.stringify(results));if(results.some(row=>row.status==='FAIL'))process.exitCode=1;
}
