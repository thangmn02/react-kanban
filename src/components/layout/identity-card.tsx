import { useRef,useState,type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation,useNavigate } from 'react-router-dom';
import { AnimatePresence,motion,useReducedMotion } from 'framer-motion';
import type { AppUser,AuthMode,WorkspaceSummary } from '../../types/auth.type';
import { useI18n,type Language } from '../../i18n';
import { ARCANA_ENABLED } from '../../constants/features';
import { DEFAULT_IDENTITY_IMAGE } from '../../services/profile.service';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import { uiEase } from '../../shared/motion';
import SettingsDialog from '../settings/settings-dialog';

interface Props {user:AppUser;authMode:AuthMode;activeWorkspace:WorkspaceSummary|null;onSignOut:()=>void;onOpenArcanaBooth:()=>void;arcanaAvailableDraws?:number}
export default function IdentityCard({user,authMode,activeWorkspace,onSignOut,onOpenArcanaBooth,arcanaAvailableDraws=0}:Props){
 const [open,setOpen]=useState(false),[settings,setSettings]=useState(false),[anchor,setAnchor]=useState({top:64,right:16});
 const card=useRef<HTMLElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const {language,setLanguage,t}=useI18n(),location=useLocation(),navigate=useNavigate(),reduced=useReducedMotion();
 useDialogFocus(open,card,()=>setOpen(false));
 const routeKey=location.pathname+location.search;
 const [lastRoute,setLastRoute]=useState(routeKey);
 if(lastRoute!==routeKey){setLastRoute(routeKey);setOpen(false);}
 const image=<img src={user.avatarUrl||DEFAULT_IDENTITY_IMAGE} alt="" className="h-full w-full rounded-full object-cover" onError={event=>{if(!event.currentTarget.src.endsWith('/logo.png'))event.currentTarget.src=DEFAULT_IDENTITY_IMAGE;}}/>;
 return <>
  <button id="kora-user-trigger" ref={trigger} type="button" onClick={()=>{const bounds=trigger.current?.getBoundingClientRect();if(bounds)setAnchor({top:bounds.bottom+8,right:Math.max(12,window.innerWidth-bounds.right)});setOpen(value=>!value);}}
   aria-label="Open user menu" aria-haspopup="dialog" aria-expanded={open} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white p-1 shadow-sm transition-transform duration-150 hover:-translate-y-px active:scale-95 motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{image}</button>
  {createPortal(<AnimatePresence>{open&&<motion.div className="fixed inset-0 z-[70] bg-slate-950/20 sm:bg-transparent" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:0.18}}
   onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <motion.section ref={card} role="dialog" aria-modal="true" aria-label={t('settings.identity')} tabIndex={-1}
    initial={reduced?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={reduced?{opacity:0}:{opacity:0,y:8}} transition={{duration:reduced?0:0.18,ease:uiEase}}
    style={{'--card-top':`${anchor.top}px`,'--card-right':`${anchor.right}px`} as CSSProperties}
    className="fixed inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_18px_60px_rgba(15,23,42,0.18)] sm:inset-x-auto sm:bottom-auto sm:right-[var(--card-right)] sm:top-[var(--card-top)] sm:max-h-[calc(100dvh-var(--card-top)-12px)] sm:w-80 sm:rounded-2xl">
    <div className="flex items-start gap-4"><div className="relative h-16 w-16 shrink-0 rounded-full bg-slate-50 p-1 ring-1 ring-slate-200">{image}<span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-white bg-blue-600"/></div>
     <div className="min-w-0 flex-1"><p className="break-words text-lg font-semibold tracking-tight text-slate-950">{user.name}</p><p className="mt-1 break-words text-xs text-slate-500">{user.email||t('app.demoUser')}</p></div>
     <button type="button" onClick={()=>setOpen(false)} aria-label={t('settings.close')} className="h-8 w-8 shrink-0 rounded-lg text-slate-500">×</button>
    </div>
    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"><p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{t('settings.workspace')}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{activeWorkspace?.name||t('app.noActiveWorkspace')}</p></div>
    <button type="button" onClick={()=>{setOpen(false);setSettings(true);}} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t('settings.title')}<span aria-hidden="true">→</span></button>
    <label className="mt-4 block text-xs font-medium text-slate-500">{t('app.language.label')}<select aria-label={t('app.language.label')} value={language} onChange={event=>setLanguage(event.target.value as Language)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="en">{t('app.language.en')}</option><option value="vi">{t('app.language.vi')}</option></select></label>
    {ARCANA_ENABLED&&<button type="button" onClick={()=>{setOpen(false);onOpenArcanaBooth();}} className="mt-3 min-h-11 w-full rounded-lg px-3 text-left text-sm text-slate-700">{t('arcana.booth')}{arcanaAvailableDraws>0&&` · ${arcanaAvailableDraws}`}</button>}
    {authMode==='supabase'?<button type="button" onClick={()=>{setOpen(false);onSignOut();}} className="mt-3 min-h-11 w-full rounded-lg px-3 text-left text-sm font-semibold text-rose-700">{t('app.signOut')}</button>:<p className="mt-3 text-xs leading-5 text-slate-500">{t('settings.localOnly')}</p>}
   </motion.section>
  </motion.div>}</AnimatePresence>,document.body)}
  {settings&&createPortal(<SettingsDialog key={user.id} user={user} onClose={()=>setSettings(false)} onOpenFocus={()=>navigate('/focus')}/>,document.body)}
 </>;
}
