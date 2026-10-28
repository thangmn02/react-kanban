import { useEffect, useState } from 'react';
import type { AppUser } from '../../types/auth.type';
import { useI18n } from '../../i18n';
import { emptyIdentitySummary, fetchIdentitySummary, type IdentitySummary } from '../../services/identity-summary.service';

export default function IdentityProfileActivity({ user, workspaceId }: { user: AppUser; workspaceId: string | null }) {
  const { t, language } = useI18n();
  const [summary, setSummary] = useState<IdentitySummary | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchIdentitySummary(user, workspaceId).then(value => { if (active) setSummary(value); }).catch(() => { if (active) setSummary({ ...emptyIdentitySummary, unavailable: true }); });
    return () => { active = false; };
  }, [user, workspaceId, retry]);
  const joined = summary?.joinedAt ? new Date(summary.joinedAt) : null;
  const date = joined && Number.isFinite(joined.getTime()) ? joined.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : t('identity.unavailable');
  const stats = [
    { label: t('identity.focusSessions'), value: summary?.focusSessions },
    { label: t('identity.focusMinutes'), value: summary?.focusedMinutes },
    { label: t('identity.completedTasks'), value: summary?.completedTasks },
  ];
  return <>
    <div className="mt-5 border-t border-dashed border-slate-200 pt-4">
      <p className="text-xs text-slate-500">{t('identity.memberSince')}</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{date}</p>
    </div>
    <dl aria-label={t('identity.activity')} aria-busy={!summary} className="mt-5 grid grid-cols-3 gap-3 border-t border-dashed border-slate-200 pt-5">
      {stats.map(stat => <div key={stat.label} className="flex min-w-0 flex-col"><dt className="mt-1 text-xs leading-5 text-slate-500">{stat.label}</dt><dd className="order-first text-2xl font-semibold tabular-nums tracking-tight text-slate-950 sm:text-3xl">{stat.value ?? '—'}</dd></div>)}
    </dl>
    {!summary && <p role="status" className="mt-3 text-xs text-slate-500">{t('identity.loading')}</p>}
    {summary?.unavailable && <p role="status" className="mt-3 text-xs text-slate-500">{t('identity.activityUnavailable')} <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-8 px-1 font-semibold text-blue-700 underline underline-offset-2">{t('identity.retry')}</button></p>}
    {!workspaceId && <p className="mt-3 text-xs text-slate-500">{t('identity.noWorkspaceActivity')}</p>}
  </>;
}
