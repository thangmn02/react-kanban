import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyLegacySchema} from './legacy-client-compatibility.mjs';
const before=()=>({columns:{'public.tasks.title':{type:'pg_catalog.text',nullable:'NO',default:null}},functions:{'public.old_rpc()':{definition:'unchanged',owner:'postgres',acl:[]}},policies:{read:'original predicate'},constraints:{primary:'original primary key'},buckets:{'sensitive-bucket-name':{public:false}},grants:{write:'NO'},publications:{tasks:true}});
test('accepts additive nullable fields without replacing any existing contract',()=>{
 const source=before(),next=structuredClone(source);next.columns['public.tasks.repeat_interval']={type:'pg_catalog.text',nullable:'YES',default:null};next.functions['public.new_rpc()']={definition:'new'};
 assert.equal(verifyLegacySchema(source,next).columns,1);
});
test('rejects an old RPC, authorization, bucket or publication regression without printing private values',()=>{
 for(const group of ['columns','functions','policies','constraints','buckets','grants','publications']){
  const source=before(),next=structuredClone(source),key=Object.keys(source[group])[0];delete next[group][key];
  assert.throws(()=>verifyLegacySchema(source,next),error=>/contract changed/.test(error.message)&&!error.message.includes(key));
 }
});
test('rejects a new required field that old INSERT requests cannot supply',()=>{
 const source=before(),next=structuredClone(source);next.columns['public.tasks.required_value']={type:'pg_catalog.text',nullable:'NO',default:null};
 assert.throws(()=>verifyLegacySchema(source,next),/mandatory column/);
});
