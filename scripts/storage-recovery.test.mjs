import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {downloadSignedObjects,validateSignedAccess,verifyStorageBundle,sealPortable,openPortable,hash,verifySnapshotObject,capabilityExpiry,isStorageAccessDenial} from './storage-recovery.mjs';
const inventory=[{bucket:'private-images',name:'owner/image.png',metadata:{size:5,eTag:createHash('md5').update('image').digest('hex')},public:false}];
const access=origin=>({projectRef:'lthlvntvjgnornrdxnms',objects:inventory.map(row=>({...row,url:origin+'/storage/v1/object/sign/'+row.bucket+'/'+row.name+'?token=h.'+Buffer.from(JSON.stringify({url:row.bucket+'/'+row.name,exp:Math.floor(Date.now()/1000)+300})).toString('base64url')+'.s'}))});
test('real HTTP object download verifies both reads and strips capabilities from its archive',async()=>{
 const server=createServer((_,response)=>response.end(Buffer.from('image')));await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{const origin='http://127.0.0.1:'+server.address().port,bundle=await downloadSignedObjects(inventory,access(origin),{origin});assert.equal(bundle.assets[0].sha256,hash(Buffer.from('image')));assert.deepEqual(verifyStorageBundle(bundle),inventory);assert.ok(!JSON.stringify(bundle).includes('token='));}finally{await new Promise(done=>server.close(done));}
});
test('rejects cross-project, redirects, extra objects, transformed URLs, stale capabilities and oversized objects',async()=>{
 const origin='https://lthlvntvjgnornrdxnms.supabase.co';
 for(const change of [a=>a.projectRef='wrong',a=>a.objects.push(a.objects[0]),a=>a.objects[0].url=a.objects[0].url.replace(origin,'https://example.org'),a=>a.objects[0].url+='&width=100',a=>a.objects[0].name='../escape']){const a=access(origin);change(a);assert.throws(()=>validateSignedAccess(inventory,a));}
 const server=createServer((_,response)=>response.end(Buffer.alloc(10)));await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{const local='http://127.0.0.1:'+server.address().port;await assert.rejects(()=>downloadSignedObjects(inventory,access(local),{origin:local,maxObjectBytes:4}),/withheld/);}finally{await new Promise(done=>server.close(done));}
});
test('detects object overwrite between reads and emits no partial bundle',async()=>{
 let reads=0;const server=createServer((_,response)=>response.end(++reads===1?'image':'other'));await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{const origin='http://127.0.0.1:'+server.address().port;await assert.rejects(()=>downloadSignedObjects(inventory,access(origin),{origin}),/withheld/);}finally{await new Promise(done=>server.close(done));}
});
test('portable archive survives independent decrypt and rejects wrong passphrase, metadata and ciphertext tampering',async()=>{
 const secret='test-only recovery passphrase with sufficient length',bytes=Buffer.from('recovery payload'),archive=await sealPortable(bytes,secret);
 assert.deepEqual(await openPortable(archive,secret),bytes);await assert.rejects(()=>openPortable(archive,'a different recovery passphrase'),/authentication failed/);
 const value=JSON.parse(archive);value.ciphertext=Buffer.from('tampered').toString('base64');await assert.rejects(()=>openPortable(Buffer.from(JSON.stringify(value)),secret),/authentication failed/);
 value.version=2;await assert.rejects(()=>openPortable(Buffer.from(JSON.stringify(value)),secret),/authentication failed/);
});

test('rejects same-size replacement before both reads and missing version evidence',()=>{
 assert.throws(()=>verifySnapshotObject(Buffer.from('other'),inventory[0]),/backed-up version/);
 assert.throws(()=>verifySnapshotObject(Buffer.from('image'),{...inventory[0],metadata:{size:5}}),/checksum/);
 assert.throws(()=>verifySnapshotObject(Buffer.from('image'),inventory[0],'wrong-etag'),/ETag/);
});

test('permits token-free reads only for an exact already-public inventory entry',()=>{
 const origin='https://lthlvntvjgnornrdxnms.supabase.co',row={...inventory[0],public:true};
 const publicAccess={projectRef:'lthlvntvjgnornrdxnms',objects:[{bucket:row.bucket,name:row.name,url:origin+'/storage/v1/object/public/'+row.bucket+'/'+row.name}]};
 assert.equal(validateSignedAccess([row],publicAccess).length,1);assert.throws(()=>validateSignedAccess(inventory,publicAccess));
 publicAccess.objects[0].url+='?token=unnecessary';assert.throws(()=>validateSignedAccess([row],publicAccess));
});

test('accepts a weak HTTP wrapper for the same backed-up content checksum',()=>{
 verifySnapshotObject(Buffer.from('image'),inventory[0],'W/"'+inventory[0].metadata.eTag+'"');
});

test('binds the earliest capability expiry and rejects insufficient transfer time or misleading metadata',()=>{
 const origin='https://lthlvntvjgnornrdxnms.supabase.co',now=Date.now(),row=inventory[0];
 const make=seconds=>({bucket:row.bucket,name:row.name,url:origin+'/storage/v1/object/sign/'+row.bucket+'/'+row.name+'?token=h.'+Buffer.from(JSON.stringify({url:row.bucket+'/'+row.name,exp:Math.floor(now/1000)+seconds})).toString('base64url')+'.s'});
 const a={projectRef:'lthlvntvjgnornrdxnms',objects:[make(1200)]};a.expiresAt=capabilityExpiry(inventory,a,{now});assert.ok(Date.parse(a.expiresAt)>now+1100000);
 assert.equal(capabilityExpiry(inventory,a,{now}),a.expiresAt);assert.throws(()=>capabilityExpiry(inventory,{...a,expiresAt:new Date(now+1800000).toISOString()},{now}),/earliest capability/);
 assert.throws(()=>capabilityExpiry(inventory,{...a,objects:[make(60)]},{now}),/insufficient time/);
});

test('recognizes explicit Storage access denials while rejecting server and unrelated client failures',()=>{
 for(const status of [401,403,404])assert.equal(isStorageAccessDenial(status,null),true);
 assert.equal(isStorageAccessDenial(400,{statusCode:'404',error:'Bucket not found'}),true);
 for(const status of [200,400,408,429,500,502,503])assert.equal(isStorageAccessDenial(status,{statusCode:'500',error:'Internal error'}),false);
 assert.equal(isStorageAccessDenial(500,{statusCode:'404',error:'not_found'}),false);
});
