/** Inspect existing client contracts and exercise legacy writes only in an offline clone. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

export function legacySchemaSnapshot(sql){
  return JSON.parse(sql(`select jsonb_build_object(
    'columns',(select coalesce(jsonb_object_agg(table_schema||'.'||table_name||'.'||column_name,jsonb_build_object('type',udt_schema||'.'||udt_name,'nullable',is_nullable,'default',column_default)),'{}') from information_schema.columns where table_schema in ('public','app_private')),
    'functions',(select coalesce(jsonb_object_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',coalesce(p.proacl,acldefault('f',p.proowner)))),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prokind='f'),
    'policies',(select coalesce(jsonb_object_agg(schemaname||'.'||tablename||'.'||policyname,to_jsonb(p)),'{}') from pg_policies p where schemaname in ('public','app_private','storage')),
    'constraints',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||k.conname,pg_get_constraintdef(k.oid)),'{}') from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private')),
    'buckets',(select coalesce(jsonb_object_agg(id,to_jsonb(b)),'{}') from storage.buckets b),
    'grants',(select coalesce(jsonb_object_agg(table_schema||'.'||table_name||'.'||grantee||'.'||privilege_type,is_grantable),'{}') from information_schema.role_table_grants where table_schema in ('public','app_private')),
    'publications',(select coalesce(jsonb_object_agg(pubname||'.'||schemaname||'.'||tablename,true),'{}') from pg_publication_tables)
  )`));
}

/** `declared` names the only existing contracts a batch may change, each exactly: a function may get a new definition
 * (same owner and permissions; its behaviour is proven separately) and a constraint one stated definition. */
export function verifyLegacySchema(before,after,declared={}){
  const totals={};
  for(const group of ['columns','functions','policies','constraints','buckets','grants','publications']){
    for(const [key,value]of Object.entries(before[group])){
      if(group==='functions'&&declared.functions?.includes(key)){
        const next=after.functions?.[key];
        assert.ok(next&&isDeepStrictEqual(next.owner,value.owner)&&isDeepStrictEqual(next.acl,value.acl),'A declared function changed its owner or permissions.');
        continue;
      }
      if(group==='constraints'&&Object.hasOwn(declared.constraints??{},key)){
        assert.ok(after.constraints?.[key]===declared.constraints[key],'A declared constraint differs from its stated definition.');
        continue;
      }
      assert.ok(isDeepStrictEqual(after[group]?.[key],value),'An existing '+group+' contract changed; private details withheld.');
    }
    totals[group]=Object.keys(before[group]).length;
  }
  // New mandatory fields can break an old INSERT even if every old field remains.
  const oldTables=new Set(Object.keys(before.columns).map(key=>key.slice(0,key.lastIndexOf('.'))));
  for(const[key,value]of Object.entries(after.columns))if(!Object.hasOwn(before.columns,key)&&oldTables.has(key.slice(0,key.lastIndexOf('.'))))assert.ok(value.nullable==='YES'||value.default!==null,'A new mandatory column lacks a legacy-compatible default.');
  return totals;
}

/** Old-shape note documents (no labels) must get the same verdict from the replaced validator, for every stored
 * document and for fixtures on both sides of each limit. Runs in the offline clone only. */
export const noteValidator={key:'app_private.valid_note_document(document jsonb)',
  constraint:{'public.notes.notes_content_schema_version_check':'CHECK ((content_schema_version = ANY (ARRAY[1, 2])))'}};
export function keepOldNoteValidator(sql){
  const definition=sql("select pg_get_functiondef('app_private.valid_note_document(jsonb)'::regprocedure)");
  const copy=definition.replace('FUNCTION app_private.valid_note_document(','FUNCTION kora_proof.valid_note_document(');
  assert.ok(copy!==definition,'The current validator must be copied exactly.');
  sql('create schema kora_proof;'+copy+';');
}
const item=(extra={})=>({id:'a',text:'b',isDone:false,...extra});
export const oldNoteFixtures=[{html:'',checklist:[]},{html:'<p>x</p>',checklist:[item()]},{html:'x',checklist:[],convertedTaskId:null},{html:'x',checklist:[],other:1},
  {html:'x'.repeat(60000),checklist:[]},{html:'x'.repeat(60001),checklist:[]},{html:'x',checklist:Array(100).fill(item())},{html:'x',checklist:Array(101).fill(item())},
  {html:'x',checklist:[item({id:''})]},{html:'x',checklist:[item({id:'a'.repeat(101)})]},{html:'x',checklist:[item({text:'t'.repeat(500)})]},{html:'x',checklist:[item({text:'t'.repeat(501)})]},
  {html:'x',checklist:[item({isDone:'no'})]},{html:'x',checklist:[1]},{html:'x',checklist:{}},{html:'x'},{checklist:[]},{html:1,checklist:[]},{},[],null,'x',1,
  {html:'x',checklist:[],pad:'p'.repeat(262144)}];
export function proveNoteValidator(sql){
  const fixtures=JSON.stringify(oldNoteFixtures).replaceAll("'","''");
  const stored=`select content as document from public.notes union all select content from public.note_revisions`;
  const result=JSON.parse(sql(`with stored as (${stored}),fixture as (select value as document from jsonb_array_elements('${fixtures}'::jsonb)),
    every as (select document from stored union all select document from fixture)
    select jsonb_build_object('stored',(select count(*) from stored),'fixtures',(select count(*) from fixture),
      'accepted',(select count(*) from fixture where kora_proof.valid_note_document(document)),
      'labelled',(select count(*) from stored where document ? 'labels'),
      'different',(select count(*) from every where kora_proof.valid_note_document(document) is distinct from app_private.valid_note_document(document)),
      'versions',(select coalesce(jsonb_agg(distinct content_schema_version),'[]') from public.notes))`));
  assert.equal(result.different,0,'The replaced validator judges an old-shape note differently.');
  assert.equal(result.labelled,0,'Stored notes predate labels.');
  assert.ok(result.accepted>0&&result.accepted<result.fixtures,'The fixtures must cover accepted and refused notes.');
  assert.ok(result.versions.every(version=>version===1),'Every existing note stays at schema version 1.');
  sql('drop schema kora_proof cascade');
  return {status:'PASS',storedDocuments:result.stored,fixtures:result.fixtures,acceptedFixtures:result.accepted,hostedWrites:false};
}

export function exerciseLegacyTaskWrites(sql){
  const actor=JSON.parse(sql("select jsonb_build_object('userId',user_id,'workspaceId',workspace_id) from public.workspace_members where role='owner' order by workspace_id,user_id limit 1"));
  assert.ok(actor?.userId&&actor.workspaceId,'A recovered workspace owner is required for the legacy RLS rehearsal.');
  for(const value of Object.values(actor))assert.match(value,/^[a-f0-9-]{36}$/);
  const board=randomUUID(),first=randomUUID(),second=randomUUID(),task=randomUUID();
  const claims=JSON.stringify({sub:actor.userId,role:'authenticated'}).replaceAll("'","''");
  const result=sql(`begin;
    set local role authenticated;
    set local request.jwt.claims='${claims}';
    set local request.jwt.claim.sub='${actor.userId}';
    insert into public.boards(id,workspace_id,created_by,title) values('${board}','${actor.workspaceId}','${actor.userId}','Legacy client compatibility');
    insert into public.lists(id,workspace_id,board_id,title,position) values('${first}','${actor.workspaceId}','${board}','To-do',0),('${second}','${actor.workspaceId}','${board}','Done',1);
    insert into public.tasks(id,workspace_id,board_id,list_id,created_by,title,description,priority,start_date,due_date,category1,category2,assignees,image,is_done,repeat_interval,position)
      values('${task}','${actor.workspaceId}','${board}','${first}','${actor.userId}','Legacy task','','Low',null,null,null,null,'{}',null,false,null,0);
    do $$begin
      if not exists(select 1 from public.tasks where id='${task}' and title='Legacy task') then raise exception 'Legacy task read failed';end if;
    end$$;
    update public.tasks set title='Legacy edit',is_done=true,completed_at=clock_timestamp() where id='${task}';
    select public.update_task_positions('[{"id":"${task}","list_id":"${second}","position":0}]'::jsonb);
    do $$begin
      if not exists(select 1 from public.tasks where id='${task}' and title='Legacy edit' and is_done and completed_at is not null and list_id='${second}') then raise exception 'Legacy update or position RPC failed';end if;
    end$$;
    update public.tasks set is_done=false,completed_at=null,deleted_at=clock_timestamp() where id='${task}';
    update public.tasks set deleted_at=null where id='${task}';
    do $$begin
      if not exists(select 1 from public.tasks where id='${task}' and not is_done and completed_at is null and deleted_at is null) then raise exception 'Legacy reopen or restore failed';end if;
    end$$;
    select 'LEGACY_TASK_CONTRACT_PASS';
    rollback;`);
  assert.ok(result.includes('LEGACY_TASK_CONTRACT_PASS'));
  assert.equal(sql(`select count(*) from public.boards where id='${board}'`),'0','Offline legacy fixtures must be rolled back.');
  return {status:'PASS',role:'authenticated',checks:['board/list creation','legacy normalized task INSERT','task SELECT','direct complete/edit','unchanged update_task_positions RPC','reopen/soft-delete/restore','transaction rollback'],hostedWrites:false,installedBinaryRun:false};
}
