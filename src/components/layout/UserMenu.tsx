import { useEffect, useRef, useState } from 'react';

import type { AppUser, AuthMode, WorkspaceSummary } from '../../types/auth.type';
import { useI18n, type Language } from '../../i18n';

interface UserMenuProps {
  user: AppUser;
  authMode: AuthMode;
  activeWorkspace: WorkspaceSummary | null;
  onSignOut: () => void;
  onOpenArcanaBooth: () => void;
  arcanaAvailableDraws?: number;
}

export default function UserMenu({
  user,
  authMode,
  activeWorkspace,
  onSignOut,
  onOpenArcanaBooth,
  arcanaAvailableDraws = 0,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { language, setLanguage, t } = useI18n();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative z-[60]">
      <button
        type="button"
        onClick={() => setIsOpen((currentState) => !currentState)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-100"
        aria-label="Open user menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="h-8 w-8 rounded-full object-cover"
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-[60] mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.16)]"
          role="menu"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-950">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email || t('app.demoUser')}</p>
            <p className="mt-1 text-xs text-slate-400">
              {activeWorkspace?.name || t('app.noActiveWorkspace')}
            </p>
          </div>

          <div className="p-2">
            <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2">
              <label className="text-xs font-semibold text-slate-500" htmlFor="user-menu-language">
                {t('app.language.label')}
              </label>
              <select
                id="user-menu-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              >
                <option value="en">{t('app.language.en')}</option>
                <option value="vi">{t('app.language.vi')}</option>
              </select>
            </div>

            {authMode === 'supabase' ? (
              <>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenArcanaBooth();
                }}
                className="mb-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
                role="menuitem"
              >
                <span>{t('arcana.booth')}</span>
                {arcanaAvailableDraws > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                    {t('arcana.reward.menuBadge', { count: arcanaAvailableDraws })}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onSignOut();
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100"
                role="menuitem"
              >
                {t('app.signOut')}
              </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenArcanaBooth();
                  }}
                  className="mb-1 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  role="menuitem"
                >
                  <span>{t('arcana.booth')}</span>
                  {arcanaAvailableDraws > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">
                      {t('arcana.reward.menuBadge', { count: arcanaAvailableDraws })}
                    </span>
                  )}
                </button>
                <p className="rounded-xl px-3 py-2 text-sm text-slate-500" role="menuitem">
                  {t('app.demoData.description')}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
