import supabase from '../lib/supabase';
import { buildStorageKey } from '../shared/storage/storageAdapter';
import type { AppUser } from '../types/auth.type';

export const DEFAULT_IDENTITY_IMAGE='/logo.png';
export const PROFILE_CHANGED='kora:profile-changed';
export const PROFILE_IMAGE_BUCKET='kora-profile-images';
export interface ProfileChanges { name:string; avatar?:Blob|null; expectedUpdatedAt?:string|null }
const localKey=(id:string)=>buildStorageKey({userId:id,workspaceId:null},'profile');
export function readLocalIdentity(user:AppUser):AppUser {
  try { const stored=JSON.parse(localStorage.getItem(localKey(user.id))||'null');
    return stored ? {...user,name:typeof stored.name==='string'&&stored.name.trim()?stored.name:user.name,avatarUrl:safeImage(stored.avatarUrl),legacyName:user.legacyName||user.name,profileUpdatedAt:typeof stored.updatedAt==='string'?stored.updatedAt:null} : {...user,profileUpdatedAt:null};
  } catch { return user; }
}
const safeImage=(value:string|null|undefined)=>typeof value==='string' && (/^https?:\/\//i.test(value)||/^data:image\/(jpeg|png|webp);base64,/i.test(value)||value===DEFAULT_IDENTITY_IMAGE) ? value : DEFAULT_IDENTITY_IMAGE;
const avatarCache=new Map<string,{url:string;expires:number}>();
const pendingSaves=new Set<string>();
export const clearProfileImageCache=()=>avatarCache.clear();
export async function resolveProfileImage(value:string|null|undefined):Promise<string>{
  if(!value?.startsWith(`${PROFILE_IMAGE_BUCKET}/`)||!supabase)return safeImage(value);
  const cached=avatarCache.get(value);if(cached&&cached.expires>Date.now())return cached.url;
  const {data,error}=await supabase.storage.from(PROFILE_IMAGE_BUCKET).createSignedUrl(value.slice(PROFILE_IMAGE_BUCKET.length+1),3600);
  if(error||!data?.signedUrl)return DEFAULT_IDENTITY_IMAGE;
  avatarCache.set(value,{url:data.signedUrl,expires:Date.now()+3300000});return data.signedUrl;
}
export async function loadUserProfile(user:AppUser):Promise<AppUser>{
  if(user.isMock||!supabase)return readLocalIdentity(user);
  const {data,error}=await supabase.from('profiles').select('full_name,avatar_url,updated_at').eq('id',user.id).maybeSingle();
  if(error)throw error;
  return data ? {...user,name:data.full_name||user.name,avatarUrl:await resolveProfileImage(data.avatar_url),legacyName:user.legacyName||user.name,profileUpdatedAt:data.updated_at} : {...user,avatarUrl:safeImage(user.avatarUrl)};
}
function dataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('The image could not be read.'));reader.readAsDataURL(blob);});}
export async function saveUserProfile(user:AppUser,changes:ProfileChanges,isCurrent:()=>boolean=()=>true):Promise<AppUser>{
  if(pendingSaves.has(user.id))throw new Error('A profile save is already in progress. Wait for it to finish.');
  pendingSaves.add(user.id);
  try{return await persistUserProfile(user,changes,isCurrent);}finally{pendingSaves.delete(user.id);}
}
async function persistUserProfile(user:AppUser,changes:ProfileChanges,isCurrent:()=>boolean):Promise<AppUser>{
  const name=changes.name.trim();if(!name||name.length>80)throw new Error('Use a display name between 1 and 80 characters.');
  if(changes.avatar && (!['image/jpeg','image/png','image/webp'].includes(changes.avatar.type)||changes.avatar.size>524288))throw new Error('Use a processed PNG, JPEG or WebP image smaller than 512 KB.');
  if(user.isMock){
    const key=localKey(user.id),previous=localStorage.getItem(key),stored=previous?JSON.parse(previous):null;
    if(changes.expectedUpdatedAt!==undefined&&changes.expectedUpdatedAt!==(stored?.updatedAt??null))throw new Error('Profile changed in another session. Reopen Settings before saving.');
    const avatarUrl=changes.avatar===undefined?safeImage(stored?.avatarUrl||user.avatarUrl):changes.avatar===null?DEFAULT_IDENTITY_IMAGE:await dataUrl(changes.avatar);
    if(!isCurrent())throw new Error('The account changed. Save was cancelled.');
    if(localStorage.getItem(key)!==previous)throw new Error('Profile changed in another session. Reopen Settings before saving.');
    const updatedAt=new Date().toISOString();
    const next={...user,name,avatarUrl,legacyName:user.legacyName||user.name,profileUpdatedAt:updatedAt};
    if(previous)localStorage.setItem(`${key}:backup`,previous);
    localStorage.setItem(key,JSON.stringify({name,avatarUrl,updatedAt}));window.dispatchEvent(new CustomEvent(PROFILE_CHANGED,{detail:{userId:user.id}}));return next;
  }
  if(!supabase)throw new Error('Account storage is unavailable. Your profile was not changed.');
  const client=supabase;
  const {data:auth,error:authError}=await client.auth.getUser();if(authError||auth.user?.id!==user.id)throw new Error('Sign in again before saving this profile.');
  const {data:before,error:readError}=await client.from('profiles').select('*').eq('id',user.id).single();if(readError||!before)throw new Error('The account profile could not be loaded. Try again after reconnecting.');
  if(changes.expectedUpdatedAt!==undefined&&changes.expectedUpdatedAt!==before.updated_at)throw new Error('Profile changed in another session. Reopen Settings before saving.');
  let uploaded:string|null=null;
  let avatar=changes.avatar===null?null:before.avatar_url;
  if(changes.avatar){
    uploaded=`${user.id}/${crypto.randomUUID()}.${changes.avatar.type==='image/png'?'png':changes.avatar.type==='image/webp'?'webp':'jpg'}`;
    const {error}=await client.storage.from(PROFILE_IMAGE_BUCKET).upload(uploaded,changes.avatar,{upsert:false,contentType:changes.avatar.type,cacheControl:'3600'});if(error)throw new Error(`Image upload failed. ${error.message}`);
    avatar=`${PROFILE_IMAGE_BUCKET}/${uploaded}`;
  }
  try{
    if(!isCurrent())throw new Error('A newer profile choice replaced this save.');
    let query=client.from('profiles').update({full_name:name,avatar_url:avatar,updated_at:new Date().toISOString()}).eq('id',user.id);
    query=before.updated_at?query.eq('updated_at',before.updated_at):query.is('updated_at',null);
    const {data,error}=await query.select().maybeSingle();
    let savedVersion=data?.updated_at;
    if(error||!data){
      // A dropped response may follow a committed write. Reconcile before
      // removing an upload or claiming that saving failed.
      const {data:current}=await client.from('profiles').select('full_name,avatar_url,updated_at').eq('id',user.id).maybeSingle();
      if(current?.full_name!==name||current?.avatar_url!==avatar)throw new Error(error?.message||'Profile changed in another session. Reload before saving.');
      savedVersion=current.updated_at;
    }
    if(!isCurrent())throw new Error('The account changed while saving. Reopen Settings to refresh.');
    // Only retire managed objects owned by this account after the new pointer
    // is confirmed. Persist failed removals for the next successful save.
    const cleanupKey=`${localKey(user.id)}:image-cleanup`;
    let retired:string[]=[];
    try{const stored=JSON.parse(localStorage.getItem(cleanupKey)||'[]');if(Array.isArray(stored))retired=stored.filter((path:unknown):path is string=>typeof path==='string'&&path.startsWith(`${user.id}/`));}catch{/* Report a failed cleanup without failing the committed profile. */}
    if(before.avatar_url!==avatar&&before.avatar_url?.startsWith(`${PROFILE_IMAGE_BUCKET}/${user.id}/`))retired.push(before.avatar_url.slice(PROFILE_IMAGE_BUCKET.length+1));
    retired=[...new Set(retired)].filter(path=>`${PROFILE_IMAGE_BUCKET}/${path}`!==avatar);
    let profileCleanupPending=false;
    if(retired.length){
      try{localStorage.setItem(cleanupKey,JSON.stringify(retired));}catch{profileCleanupPending=true;}
      try{const {error:cleanupError}=await client.storage.from(PROFILE_IMAGE_BUCKET).remove(retired);if(cleanupError)profileCleanupPending=true;else localStorage.removeItem(cleanupKey);}catch{profileCleanupPending=true;}
    }
    const next={...user,name,avatarUrl:await resolveProfileImage(avatar),legacyName:user.legacyName||user.name,profileUpdatedAt:savedVersion,profileCleanupPending};
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED,{detail:{userId:user.id}}));return next;
  }catch(error){
    if(uploaded){const {data:current}=await client.from('profiles').select('avatar_url').eq('id',user.id).maybeSingle();
      if(current&&current.avatar_url!==`${PROFILE_IMAGE_BUCKET}/${uploaded}`)await client.storage.from(PROFILE_IMAGE_BUCKET).remove([uploaded]);}
    throw error;
  }
}
