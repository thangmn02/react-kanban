import Button from '../atoms/Button';
import { useI18n } from '../../i18n';

interface NotFoundPageProps {
  onGoDashboard: () => void;
  onGoToday: () => void;
}

/**
 * Polished 404 surface for unknown routes. Matches the calm slate card
 * direction used across the app (see BoardEmptyState). Uses a real <h1> for
 * clear heading structure and the shared Button atom so both actions carry the
 * cursor-pointer / hover / focus-visible contract.
 */
export default function NotFoundPage({ onGoDashboard, onGoToday }: NotFoundPageProps) {
  const { t } = useI18n();
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6 py-12">
      <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">{t('app.error404')}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{t('app.pageNotFound')}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {t('app.thePageYouAreLookingFor')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button text="Go to Dashboard" variant="primary" size="md" onClick={onGoDashboard} />
          <Button text="Go to Today" variant="secondary" size="md" onClick={onGoToday} />
        </div>
      </div>
    </main>
  );
}
