import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import FloatingFocus from '../../components/focus/FloatingFocus';
import dockCss from '../../components/focus/floatingFocus.css?inline';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function FeatureRoute({ tab }: { tab: 'focus' | 'music' | 'beat' }) {
  const context = useAppLayoutRouteContext();
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const shadow = node.shadowRoot || node.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = dockCss;
    const root = document.createElement('div');
    root.style.height = '100%';
    shadow.replaceChildren(style, root);
    setTarget(root);
    return () => { shadow.replaceChildren(); };
  }, []);

  return <div className="min-h-screen bg-canvas">
    {context.header}
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div ref={attach} className="h-[min(680px,85dvh)] min-h-[400px]">
        {target && createPortal(<FloatingFocus key={tab} {...context.featureDock} initialTab={tab} />, target)}
      </div>
    </div>
  </div>;
}
