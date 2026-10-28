import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { AppUser, AuthMode, WorkspaceSummary } from '../../types/auth.type';
import { useI18n, type Language } from '../../i18n';
import { ARCANA_ENABLED } from '../../constants/features';
import { DEFAULT_IDENTITY_IMAGE } from '../../services/profile.service';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import { uiEase } from '../../shared/motion';
import IdentityProfileActivity from './identity-profile-activity';
import SettingsDialog from '../settings/settings-dialog';

interface Props {
  user: AppUser; authMode: AuthMode; activeWorkspace: WorkspaceSummary | null;
  onSignOut: () => void; onOpenArcanaBooth: () => void; arcanaAvailableDraws?: number;
}
const roleLabels = { owner: 'identity.role.owner', admin: 'identity.role.admin', member: 'identity.role.member', viewer: 'identity.role.viewer' } as const;

export default function IdentityCard({ user, authMode, activeWorkspace, onSignOut, onOpenArcanaBooth, arcanaAvailableDraws = 0 }: Props) {
  const [open, setOpen] = useState(false), [present, setPresent] = useState(false), [settings, setSettings] = useState(false);
  const card = useRef<HTMLElement | null>(null);
  const afterExit = useRef<(() => void) | null>(null);
  const { language, setLanguage, t } = useI18n(), location = useLocation(), navigate = useNavigate(), reduced = !!useReducedMotion();
  const dismiss = () => { afterExit.current = null; setOpen(false); };
  const closeThen = (action: () => void) => { afterExit.current = action; setOpen(false); };
  useDialogFocus(present, card, dismiss, '#kora-user-trigger');
  useEffect(() => {
    if (!present) return;
    const app = document.getElementById('root'), wasInert = app?.inert;
    const overflow = document.body.style.overflow;
    if (app) app.inert = true;
    document.body.style.overflow = 'hidden';
    return () => {
      if (app) app.inert = wasInert ?? false;
      document.body.style.overflow = overflow;
    };
  }, [present]);
  const routeKey = location.pathname + location.search + location.hash + user.id + activeWorkspace?.id;
  useEffect(() => { afterExit.current = null; }, [routeKey]);
  const [lastRoute, setLastRoute] = useState(routeKey);
  if (lastRoute !== routeKey) { setLastRoute(routeKey); setOpen(false); setSettings(false); }
  const finishExit = () => {
    if (open) return;
    setPresent(false);
    // Let the focus hook restore the trigger before another dialog takes focus.
    const action = afterExit.current; afterExit.current = null;
    if (action) requestAnimationFrame(action);
  };
  const duration = reduced ? 0.08 : 0.22;
  const avatar = user.avatarUrl || DEFAULT_IDENTITY_IMAGE;
  return <>
    <button id="kora-user-trigger" type="button" onClick={() => {
      if (open) { dismiss(); return; }
      afterExit.current = null; setPresent(true); setOpen(true);
    }} aria-label="Open user menu" aria-haspopup="dialog" aria-expanded={open} aria-controls={present ? 'kora-identity-profile' : undefined}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white p-1 shadow-sm transition-transform duration-150 hover:-translate-y-px active:scale-95 motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" onError={event => { if (!event.currentTarget.src.endsWith('/logo.png')) event.currentTarget.src = DEFAULT_IDENTITY_IMAGE; }} />
    </button>
    {createPortal(<AnimatePresence onExitComplete={finishExit}>{open && <motion.div key="identity" data-testid="identity-profile-backdrop"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration, ease: uiEase }}
      onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
      <motion.section id="kora-identity-profile" ref={card} role="dialog" aria-modal="true" aria-label={t('settings.identity')} tabIndex={-1} data-testid="identity-profile"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }} transition={{ duration, ease: uiEase }}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[880px] flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_28px_100px_rgba(15,23,42,0.25)] sm:max-h-[calc(100dvh-64px)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3"><span aria-hidden="true" className="grid grid-cols-3 gap-0.5">{Array.from({ length: 9 }, (_, i) => <span key={i} className={'h-1.5 w-1.5 ' + ([1, 3, 4, 7].includes(i) ? 'bg-blue-600' : 'bg-slate-200')} />)}</span><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Kora · Identity</span></div>
          <button autoFocus type="button" onClick={dismiss} aria-label={t('identity.close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600">×</button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <div className="grid items-start gap-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8">
            <div className="mx-auto w-28 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm sm:mx-0 sm:w-full">
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/60" data-testid="identity-portrait">
                <img src={avatar} alt={user.name} className="h-full w-full object-cover" onError={event => { event.currentTarget.src = DEFAULT_IDENTITY_IMAGE; event.currentTarget.onerror = null; }} />
              </div>
              <p title={user.id} className="truncate px-1 pb-1 pt-3 text-center font-mono text-[10px] text-slate-500">{t('identity.account')} · {user.id}</p>
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-3xl">{user.name}</h2>
              <p title={user.email || undefined} className="mt-2 line-clamp-2 break-all text-sm leading-6 text-slate-600">{user.email || t('app.demoUser')}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {activeWorkspace && <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{t(roleLabels[activeWorkspace.role])}</span>}
                <span className="inline-flex items-center gap-2 text-xs text-slate-500"><span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + (authMode === 'mock' ? 'bg-amber-500' : 'bg-emerald-500')} />{t(authMode === 'mock' ? 'identity.local' : 'identity.signedIn')}</span>
              </div>
              <div className="mt-5"><p className="text-xs text-slate-500">{t('settings.workspace')}</p><p className="mt-1 break-words text-base font-medium text-slate-800">{activeWorkspace?.name || t('app.noActiveWorkspace')}</p></div>
              <IdentityProfileActivity key={user.id + ':' + activeWorkspace?.id} user={user} workspaceId={activeWorkspace?.id ?? null} />
            </div>
          </div>
        </div>
        <footer className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <label className="mr-auto flex items-center gap-3 text-xs font-medium text-slate-500"><span className="sr-only sm:not-sr-only">{t('app.language.label')}</span><select aria-label={t('app.language.label')} value={language} onChange={event => setLanguage(event.target.value as Language)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="en">{t('app.language.en')}</option><option value="vi">{t('app.language.vi')}</option></select></label>
            <button type="button" onClick={() => closeThen(() => setSettings(true))} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t('settings.title')}</button>
            {ARCANA_ENABLED && <button type="button" onClick={() => closeThen(onOpenArcanaBooth)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-700">{t('arcana.booth')}{arcanaAvailableDraws > 0 && ' · ' + arcanaAvailableDraws}</button>}
            {authMode === 'supabase' && <button type="button" onClick={() => closeThen(onSignOut)} className="min-h-11 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600">{t('app.signOut')}</button>}
          </div>
          {authMode === 'mock' && <p className="mt-3 text-xs leading-5 text-slate-500"><span className="sm:hidden">{t('identity.localHint')}</span><span className="hidden sm:inline">{t('settings.localOnly')}</span></p>}
        </footer>
      </motion.section>
    </motion.div>}</AnimatePresence>, document.body)}
    {settings && createPortal(<SettingsDialog key={user.id} user={user} onClose={() => setSettings(false)} onOpenFocus={() => navigate('/focus')} />, document.body)}
  </>;
}
