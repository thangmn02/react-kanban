import { clearUserData } from '../shared/storage/storageAdapter';
import { beforeEach,expect,it,vi } from 'vitest';
import type { AppUser } from '../types/auth.type';
const fake=vi.hoisted(()=>({profile:{full_name:'Before',avatar_url:'kora-profile-images/user/old.jpg',updated_at:'v1'} as Record<string,unknown>,removed:[] as string[][],uploadError:false,removeError:false,conflict:false,lostResponse:false,hold:null as Promise<void>|null}));
vi.mock('../lib/supabase',()=>({default:{auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},storage:{from:()=>({upload:async()=>{if(fake.hold)await fake.hold;return {error:fake.uploadError?{message:'offline'}:null};},remove:async(paths:string[])=>{fake.removed.push(paths);return {error:fake.removeError?{message:'offline'}:null};},createSignedUrl:async(path:string)=>({data:{signedUrl:`https://storage.example/${path}`},error:null})})},from:()=>{let update:Record<string,unknown>|null=null;const q={select:()=>q,eq:()=>q,is:()=>q,update:(value:Record<string,unknown>)=>{update=value;return q;},single:async()=>({data:{...fake.profile},error:null}),maybeSingle:async()=>{if(update){if(fake.conflict)return {data:null,error:null};fake.profile={...fake.profile,...update};if(fake.lostResponse)return {data:null,error:{message:'dropped'}};}return {data:{...fake.profile},error:null};}};return q;}}}));
import { saveUserProfile,clearProfileImageCache } from './profile.service';
const user:AppUser={id:'user',name:'Before',email:'user@example.test',avatarUrl:'/logo.png',isMock:false};
beforeEach(()=>{localStorage.clear();clearProfileImageCache();fake.profile={full_name:'Before',avatar_url:'kora-profile-images/user/old.jpg',updated_at:'v1'};fake.removed=[];fake.uploadError=false;fake.removeError=false;fake.conflict=false;fake.lostResponse=false;fake.hold=null;});
it('rejects an overlapping save before it can displace the accepted write',async()=>{
 let release!:()=>void;fake.hold=new Promise(resolve=>{release=resolve;});const first=saveUserProfile(user,{name:'First',avatar:new Blob(['image'],{type:'image/png'})});await Promise.resolve();await expect(saveUserProfile(user,{name:'Second'})).rejects.toThrow('already in progress');release();await first;expect(fake.profile.full_name).toBe('First');
});
it('retires only the previous owned object after a confirmed replacement',async()=>{
 const next=await saveUserProfile(user,{name:'Updated',avatar:new Blob(['image'],{type:'image/jpeg'})});expect(fake.removed).toEqual([['user/old.jpg']]);expect(next.avatarUrl).toContain('https://storage.example/user/');expect(next.name).toBe('Updated');
});
it('reconciles a committed update after a dropped response without deleting the new image',async()=>{
 fake.lostResponse=true;const next=await saveUserProfile(user,{name:'Updated',avatar:new Blob(['image'],{type:'image/png'})});expect(next.name).toBe('Updated');expect(fake.removed).toEqual([['user/old.jpg']]);
});
it('preserves the profile on upload failure and rejects stale versions before uploading',async()=>{
 await expect(saveUserProfile(user,{name:'Updated',expectedUpdatedAt:'old'})).rejects.toThrow('another session');fake.uploadError=true;await expect(saveUserProfile(user,{name:'Updated',avatar:new Blob(['image'],{type:'image/png'})})).rejects.toThrow('upload failed');expect(fake.profile.full_name).toBe('Before');expect(fake.removed).toEqual([]);
});
it('cleans only a failed upload after a confirmed CAS conflict',async()=>{
 fake.conflict=true;await expect(saveUserProfile(user,{name:'Updated',avatar:new Blob(['image'],{type:'image/png'})})).rejects.toThrow('another session');expect(fake.removed).toHaveLength(1);expect(fake.removed[0][0]).toMatch(/^user\/.+\.png$/);expect(fake.profile.avatar_url).toBe('kora-profile-images/user/old.jpg');
});
it('queues failed retirement without misreporting a committed profile as failed',async()=>{
 fake.removeError=true;const next=await saveUserProfile(user,{name:'Default',avatar:null});expect(next.profileCleanupPending).toBe(true);expect(fake.profile.avatar_url).toBeNull();expect(localStorage.getItem('kanban:user:global:profile:v1:image-cleanup')).toContain('user/old.jpg');
 fake.removeError=false;await saveUserProfile(next,{name:'Retry'});expect(localStorage.getItem('kanban:user:global:profile:v1:image-cleanup')).toBeNull();
});
it('never deletes external or other-account image paths on reset',async()=>{
 fake.profile.avatar_url='kora-profile-images/other/person.jpg';await saveUserProfile(user,{name:'Reset',avatar:null});expect(fake.removed).toEqual([]);
});
it('local storage failure leaves the prior identity recoverable',async()=>{
 const local={...user,isMock:true};await saveUserProfile(local,{name:'Local'});const key='kanban:user:global:profile:v1';const original=localStorage.setItem.bind(localStorage);const fail=vi.spyOn(localStorage,'setItem').mockImplementation((key,value)=>{if(key.endsWith(':profile:v1'))throw new Error('Quota');original(key,value);});await expect(saveUserProfile(local,{name:'Other'})).rejects.toThrow('Quota');fail.mockRestore();expect(JSON.parse(localStorage.getItem(key)!).name).toBe('Local');expect(localStorage.getItem(`${key}:backup`)).toBeTruthy();
});

it('rejects a stale local editor rather than overwriting a newer tab profile',async()=>{
 const local={...user,isMock:true};const first=await saveUserProfile(local,{name:'First',expectedUpdatedAt:null});
 await expect(saveUserProfile(local,{name:'Stale',expectedUpdatedAt:null})).rejects.toThrow('another session');
 expect(first.profileUpdatedAt).toBeTruthy();expect(JSON.parse(localStorage.getItem('kanban:user:global:profile:v1')!).name).toBe('First');
});

it('retains only opaque retirement work across logout and retries it after sign-in',async()=>{
 fake.removeError=true;await saveUserProfile(user,{name:'Replace',avatar:null});
 localStorage.setItem('kanban:user:global:private-cache:v1','private');clearUserData('user');
 expect(localStorage.getItem('kanban:user:global:private-cache:v1')).toBeNull();
 expect(localStorage.getItem('kanban:user:global:profile:v1:image-cleanup')).toContain('user/old.jpg');
 fake.removeError=false;await saveUserProfile(user,{name:'Retry after login'});
 expect(localStorage.getItem('kanban:user:global:profile:v1:image-cleanup')).toBeNull();
});
