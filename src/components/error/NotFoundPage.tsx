import Button from '../atoms/Button';

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
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6 py-12">
      <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">Error 404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button text="Go to Dashboard" variant="primary" size="md" onClick={onGoDashboard} />
          <Button text="Go to Today" variant="secondary" size="md" onClick={onGoToday} />
        </div>
      </div>
    </main>
  );
}
