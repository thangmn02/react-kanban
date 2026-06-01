import QuietHomePreview from './previews/QuietHomePreview';
import QuietTodayPreview from './previews/QuietTodayPreview';
import QuietBoardPreview from './previews/QuietBoardPreview';
import QuietFocusPreview from './previews/QuietFocusPreview';
import DesignLabLayout from './DesignLabLayout';

/**
 * Standalone, preview-only router for the Quiet Velocity design lab. It reads
 * `window.location.pathname` directly (no dependency on the production
 * `useViewRouting` hook) so it stays fully isolated and removable. Mounted in
 * `main.tsx` BEFORE <App/> so it never affects production routing or App's
 * hook order.
 */
export default function DesignLab() {
  const pathname = typeof window === 'undefined' ? '' : window.location.pathname;

  switch (pathname) {
    case '/design-lab/quiet-home':
      return <QuietHomePreview />;
    case '/design-lab/quiet-today':
      return <QuietTodayPreview />;
    case '/design-lab/quiet-board':
      return <QuietBoardPreview />;
    case '/design-lab/quiet-focus':
      return <QuietFocusPreview />;
    default:
      return (
        <DesignLabLayout current="/design-lab/quiet-home">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Quiet Velocity Design Lab
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Pick a preview above. These routes render the redesign direction with static mock data —
              no backend, auth, or mutations.
            </p>
          </div>
        </DesignLabLayout>
      );
  }
}
