/** Narrow object reads and a portable authenticated archive. No image-backend credentials. */
import assert from 'node:assert/strict';
import {createHash,randomBytes,scrypt as derive,createCipheriv,createDecipheriv} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive),project='lthlvntvjgnornrdxnms';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function objectIdentity(row){
 assert.ok(typeof row.bucket==='string'&&row.bucket.length>0&&!row.bucket.includes('/'),'Invalid bucket identity.');
 assert.ok(typeof row.name==='string'&&row.name.split('/').every(segment=>segment&&segment!=='.'&&segment!=='..'&&!segment.includes('\\')),'Invalid object identity.');
 return row.bucket+'/'+row.name;
}
export function validateSignedAccess(inventory,access,origin=`https://${project}.supabase.co`){
 assert.equal(access.projectRef,project,'Signed access must identify the authorized production project.');
 assert.equal(access.objects.length,inventory.length,'Signed access must cover exactly the restored object inventory.');
 const expected=new Map(inventory.map(row=>[objectIdentity(row),row]));assert.equal(expected.size,inventory.length,'Duplicate inventory identity.');
 const used=new Set();
 return access.objects.map(row=>{
  const identity=objectIdentity(row);assert.ok(expected.has(identity)&&!used.has(identity),'Unexpected or duplicated signed object.');used.add(identity);
  let url;try{url=new URL(row.url);}catch{throw Error('Invalid signed access URL; value withheld.');}
  const encodedIdentity=identity.split('/').map(encodeURIComponent).join('/');
  if(expected.get(identity).public===true&&url.pathname==='/storage/v1/object/public/'+encodedIdentity){
   assert.ok(url.origin===origin&&!url.username&&!url.password&&!url.search&&!url.hash,'Public reads must target exactly one already-public inventoried object.');return {row:expected.get(identity),url};
  }
  const path='/storage/v1/object/sign/'+encodedIdentity;
  assert.ok(url.origin===origin&&!url.username&&!url.password&&url.pathname===path&&!url.hash,'Signed access must target exactly one inventoried object on the pinned origin.');
  assert.ok(url.searchParams.get('token')&&[...url.searchParams.keys()].every(key=>key==='token'),'Only a signed download token is allowed.');
  // The provider verifies the token; local decoding only bounds expiration and requested object scope.
  let claims;try{claims=JSON.parse(Buffer.from(url.searchParams.get('token').split('.')[1],'base64url'));}catch{throw Error('Invalid signed download token; value withheld.');}
  assert.ok(claims.url===identity&&Number.isFinite(claims.exp)&&claims.exp>Date.now()/1000&&claims.exp<=Date.now()/1000+3660,'Signed token must cover this object and expire within about one hour.');
  return {row:expected.get(identity),url};
 });
}
export function capabilityExpiry(inventory,access,{minimumRemainingSeconds=600,now=Date.now()}={}){
 const rows=validateSignedAccess(inventory,access),expirations=rows.filter(item=>item.url.pathname.includes('/object/sign/')).map(item=>JSON.parse(Buffer.from(item.url.searchParams.get('token').split('.')[1],'base64url')).exp*1000);
 assert.ok(expirations.length>0,'At least one private capability is required.');const minimum=Math.min(...expirations);
 assert.ok(minimum-now>=minimumRemainingSeconds*1000,'Signed access has insufficient time remaining; regenerate the capability set.');
 if(access.expiresAt!==undefined)assert.equal(Date.parse(access.expiresAt),minimum,'Signed access expiration differs from the earliest capability.');
 return new Date(minimum).toISOString();
}
export function verifySnapshotObject(bytes,row,responseEtag){
 const etag=String(row.metadata?.eTag||'').replace(/^"|"$/g,'').toLowerCase();
 assert.ok(/^[a-f0-9]{32}$/.test(etag),'Snapshot has no supported content checksum; exact recovery must remain blocked.');
 assert.ok(createHash('md5').update(bytes).digest('hex')===etag,'Object content no longer matches the backed-up version; private details withheld.');
 if(responseEtag)assert.ok(String(responseEtag).replace(/^W\//,'').replace(/^"|"$/g,'').toLowerCase()===etag,'Downloaded object ETag differs from the backup snapshot.');
 const declared=row.metadata?.size;if(declared!==undefined)assert.ok(bytes.length===Number(declared),'Object bytes do not match the backed-up metadata size.');
}
async function fetchBytes(url,maxBytes,row){
 try{
  const response=await fetch(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(45000)});
  if(!response.ok){await response.body?.cancel();const error=new Error('Object HTTP response rejected.');error.safeCode='HTTP_'+response.status;throw error;}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('Object exceeds the bounded backup size.');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const bytes=Buffer.concat(parts,size);verifySnapshotObject(bytes,row,response.headers.get('etag'));return bytes;
 }catch(error){
  const reason=error.safeCode||(/backed-up version/.test(error.message)?'SNAPSHOT_CHECKSUM_MISMATCH':/ETag differs/.test(error.message)?'SNAPSHOT_ETAG_MISMATCH':/bounded backup size/.test(error.message)?'SIZE_LIMIT':/metadata size/.test(error.message)?'METADATA_SIZE_MISMATCH':/checksum/.test(error.message)?'SNAPSHOT_CHECKSUM_UNAVAILABLE':/^[A-Z0-9_]+$/.test(error.cause?.code||'')?error.cause.code:'FETCH_FAILED');
  throw Error('Object download failed ('+reason+'); signed URL and response details withheld.');
 }
}
export async function downloadSignedObjects(inventory,access,{origin,maxObjectBytes=32*1024**2,maxTotalBytes=256*1024**2}={}){
 const admitted=validateSignedAccess(inventory,access,origin),assets=[];let total=0;
 for(const {row,url}of admitted){
  const bytes=await fetchBytes(url,Math.min(maxObjectBytes,maxTotalBytes-total),row);total+=bytes.length;
  const declared=row.metadata?.size;if(declared!==undefined)assert.equal(bytes.length,Number(declared),'Object bytes do not match the backed-up metadata size.');
  assets.push({...row,sha256:hash(bytes),data:bytes.toString('base64')});
 }
 // A second read detects overwrite/deletion during capture. Signed tokens never enter the archive.
 for(let i=0;i<admitted.length;i++){const bytes=await fetchBytes(admitted[i].url,maxObjectBytes,admitted[i].row);assert.equal(hash(bytes),assets[i].sha256,'An object changed during backup; no complete archive may be promoted.');}
 return {version:1,projectRef:project,inventorySha256:hash(JSON.stringify(inventory)),assets};
}
export function verifyStorageBundle(bundle){
 assert.equal(bundle.version,1);assert.equal(bundle.projectRef,project);const seen=new Set();
 for(const asset of bundle.assets){const identity=objectIdentity(asset);assert.ok(!seen.has(identity),'Duplicate archived object.');seen.add(identity);assert.equal(hash(Buffer.from(asset.data,'base64')),asset.sha256,'Archived object hash mismatch.');}
 const inventory=bundle.assets.map(({sha256,data,...row})=>row);assert.equal(hash(JSON.stringify(inventory)),bundle.inventorySha256,'Archived inventory metadata changed.');return inventory;
}
export async function sealPortable(bytes,passphrase){
 assert.ok(typeof passphrase==='string'&&passphrase.length>=24,'Use a separate recovery passphrase of at least 24 characters.');
 const salt=randomBytes(16),iv=randomBytes(12),key=await scrypt(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024**2});
 try{const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('Kora storage recovery v1'));const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);return Buffer.from(JSON.stringify({version:1,kdf:'scrypt-32768-8-1',algorithm:'aes-256-gcm',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')}));}finally{key.fill(0);}
}
export async function openPortable(bytes,passphrase){
 let key;try{
  const value=JSON.parse(bytes);assert.ok(value.version===1&&value.kdf==='scrypt-32768-8-1'&&value.algorithm==='aes-256-gcm');
  const salt=Buffer.from(value.salt,'base64'),iv=Buffer.from(value.iv,'base64'),tag=Buffer.from(value.tag,'base64');assert.ok(salt.length===16&&iv.length===12&&tag.length===16);
  key=await scrypt(passphrase,salt,32,{N:32768,r:8,p:1,maxmem:64*1024**2});const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from('Kora storage recovery v1'));decipher.setAuthTag(tag);return Buffer.concat([decipher.update(Buffer.from(value.ciphertext,'base64')),decipher.final()]);
 }catch{throw Error('Recovery archive authentication failed; details withheld.');}finally{key?.fill(0);}
}

/** Storage may wrap its explicit not-found result in HTTP 400; server failures never count. */
export function isStorageAccessDenial(status,body){
 if([401,403,404].includes(status))return true;
 return status===400&&String(body?.statusCode)==='404'&&['not_found','Object not found','Bucket not found'].includes(body?.error);
}
