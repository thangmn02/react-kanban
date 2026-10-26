import { useEffect,useRef,useState } from 'react';
import { motion,useReducedMotion } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import { useI18n,type Language } from '../../i18n';
import type { AppUser } from '../../types/auth.type';
import { uiFade } from '../../shared/motion';
import { renderAvatarCrop,type AvatarCrop } from '../../utils/profile-image';
import AvatarEditor from './avatar-editor';

export default function SettingsDialog({user,onClose,onOpenFocus}:{user:AppUser;onClose:()=>void;onOpenFocus:()=>void}){
 const auth=useAuth(),{t,language,setLanguage}=useI18n(),reduced=useReducedMotion();
 const root=useRef<HTMLElement|null>(null),pending=useRef(false);
 const version=useRef(user.profileUpdatedAt);
 const [name,setName]=useState(user.name),[avatar,setAvatar]=useState<AvatarCrop|null|undefined>(),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const close=()=>{if(!pending.current)onClose();};useDialogFocus(true,root,close,'#kora-user-trigger');
 const dirty=name!==user.name||avatar!==undefined;
 useEffect(()=>{if(!dirty)version.current=user.profileUpdatedAt;},[dirty,user.profileUpdatedAt]);
 return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/30 p-0 sm:items-center sm:p-5" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
  <motion.section ref={root} role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} initial={reduced?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={reduced?{duration:0}:uiFade}
   className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
   <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 id="settings-title" className="text-lg font-semibold text-slate-950">{t('settings.title')}</h2><button type="button" disabled={saving} onClick={close} aria-label={t('settings.close')} className="h-10 w-10 rounded-lg text-slate-600">×</button></header>
   <form className="min-h-0 overflow-y-auto px-5 py-5 pb-[max(20px,env(safe-area-inset-bottom))]" onSubmit={async event=>{
    event.preventDefault();if(pending.current||busy||!dirty)return;pending.current=true;setSaving(true);setError('');setMessage('');
    try{if(!auth.updateProfile)throw new Error('Profile editing is unavailable.');await auth.updateProfile({name,expectedUpdatedAt:version.current,avatar:avatar===undefined?undefined:avatar===null?null:await renderAvatarCrop(avatar)});setName(name.trim());setAvatar(undefined);setMessage(t('settings.saved'));}
    catch(reason){setError(reason instanceof Error?reason.message:t('settings.error'));}finally{pending.current=false;setSaving(false);}
   }}>
    <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
     <label className="block text-sm font-medium text-slate-700">{t('settings.name')}<input value={name} required maxLength={80} onChange={event=>{setName(event.target.value);setMessage('');}} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5"/></label>
     <div><p className="text-xs font-medium text-slate-500">{t('settings.email')}</p><p className="mt-1 break-words text-sm text-slate-700">{user.email||t('app.demoUser')}</p><p className="mt-1 text-xs text-slate-500">{t('settings.emailHint')}</p></div>
     <AvatarEditor src={user.avatarUrl} value={avatar} onChange={setAvatar} onBusy={setBusy}/>
     <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{t(user.isMock?'settings.localOnly':'settings.accountStorage')}</p>
     <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={close} className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">{t('settings.cancel')}</button><button type="submit" disabled={!dirty||busy||!name.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{t(saving?'settings.saving':'settings.save')}</button></div>
    </fieldset>
    <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>{user.profileCleanupPending&&<p role="status" className="mt-2 text-xs text-amber-700">{t('settings.cleanupPending')}</p>}{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    <section className="mt-6 space-y-4 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-800">{t('settings.preferences')}</h3>
     <label className="block text-sm text-slate-700">{t('app.language.label')}<select aria-label={t('app.language.label')} value={language} onChange={event=>setLanguage(event.target.value as Language)} className="mt-2 block w-full rounded-lg border border-slate-200 px-3 py-2"><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
     <p className="text-xs text-slate-500">{t('settings.instant')}</p><p className="text-sm text-slate-700">{t('settings.light')}</p>
     <button type="button" disabled={saving||dirty} onClick={()=>{onClose();onOpenFocus();}} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">{t('settings.focusPreferences')}</button>
    </section>
   </form>
  </motion.section>
 </div>;
}
