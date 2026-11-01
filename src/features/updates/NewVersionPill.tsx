import { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { useI18n } from '../../i18n';
import { checkWebDeploy, usePeriodicCheck, WEB_CHECK_EVERY_MS } from './update-notices';

/** Web only: after a deploy, an open tab offers a reload instead of running old code until it is closed. */
export default function NewVersionPill() {
  const { t } = useI18n();
  const deployed = usePeriodicCheck(import.meta.env.PROD && !isTauri(), checkWebDeploy, WEB_CHECK_EVERY_MS, WEB_CHECK_EVERY_MS);
  const [hidden, setHidden] = useState('');
  if (!deployed || hidden === deployed) return null;
  return <div role="status" className="fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-4 pr-1.5 text-sm text-slate-700 shadow-card backdrop-blur">
    <span>{t('update.webReady')}</span>
    <button type="button" className="min-h-8 rounded-full bg-blue-600 px-3 font-semibold text-white hover:bg-blue-700" onClick={() => window.location.reload()}>{t('update.reload')}</button>
    <button type="button" aria-label={t('update.later')} className="grid min-h-8 min-w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100" onClick={() => setHidden(deployed)}>×</button>
  </div>;
}
