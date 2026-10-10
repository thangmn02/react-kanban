import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useLocation } from 'react-router-dom';
import FloatingFocus from '../../components/focus/FloatingFocus';
import dockCss from '../../components/focus/floatingFocus.css?inline';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import { useI18n } from '../../i18n';

type DockTab = 'focus' | 'music' | 'beat';
const actionClass = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600';

export default function FeatureRoute({ tab }: { tab: DockTab }) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const privateDebug = import.meta.env.DEV && query.has('musicDebug');
  if (tab !== 'focus' && !privateDebug) {
    query.set('tab', tab);
    return <Navigate replace to={`/focus?${query}${location.hash}`} />;
  }
  const requested = query.get('tab');
  const selected = requested === 'music' || requested === 'beat' || requested === 'focus' ? requested : tab;
  return <FocusPage tab={selected} />;
}

function FocusPage({ tab }: { tab: DockTab }) {
  const context = useAppLayoutRouteContext();
  const { t } = useI18n();
  const { attach, selectTab, native, isFloating, returnToPage, minimized, setMinimized, openShutdown } = context.focusDockPage;
  useEffect(() => { selectTab(tab); setMinimized(false); }, [selectTab, setMinimized, tab]);
  return <div className="min-h-screen bg-canvas">
    {context.header}
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-3 flex justify-end gap-3">
        {isFloating ? <button className={actionClass} type="button" onClick={returnToPage}>{t('dock.return')}</button> : <>
          <button className={actionClass} type="button" onClick={() => setMinimized(!minimized)}>{t(minimized ? 'focus.dock.expand' : 'focus.dock.minimizeLabel')}</button>
          <button className={actionClass} type="button" onClick={openShutdown}>{t('focus.dock.shutdown')}</button>
        </>}
      </div>
      {native ? <div hidden={minimized}><NativeFocusPage /></div>
        : <div ref={attach} hidden={minimized} data-testid="focus-dock-page" />}
    </div>
  </div>;
}

// NativeSurface replaces the workspace with the dock in the same Tauri window.
// The page and compact surface mount this existing view one at a time.
function NativeFocusPage() {
  const { featureDock } = useAppLayoutRouteContext();
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const shadow = node.shadowRoot || node.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = dockCss;
    const root = document.createElement('div');
    shadow.replaceChildren(style, root);
    setTarget(root);
    return () => { shadow.replaceChildren(); };
  }, []);
  return <div ref={attach} className="h-[min(680px,85dvh)] min-h-[400px]">
    {target && createPortal(<FloatingFocus {...featureDock} />, target)}
  </div>;
}
