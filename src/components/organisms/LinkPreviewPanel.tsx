import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../../i18n';

interface LinkPreviewPanelProps { name: string; url: string; embedUrl: string; onClose: () => void }

/** A linked document shown beside the task, so reading it does not mean leaving Kora. Read and edit rights stay the service's own. */
export default function LinkPreviewPanel({ name, url, embedUrl, onClose }: LinkPreviewPanelProps) {
  const { t } = useI18n();
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    // Capture, and stop there: Escape closes this panel, not the task behind it.
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); opener?.focus(); };
  }, [onClose]);

  const action = 'inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

  return (
    <aside role="dialog" aria-modal="false" aria-labelledby={titleId}
      className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <h2 id={titleId} className="mr-auto min-w-0 truncate text-sm font-semibold text-slate-900">{name}</h2>
        <a href={url} target="_blank" rel="noopener noreferrer" className={action}>{t('link.openNewTab')}</a>
        <button ref={closeButton} type="button" className={action} onClick={onClose}>{t('common.close')}</button>
      </header>
      <iframe title={name} src={embedUrl} loading="lazy" referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        className="min-h-0 w-full flex-1 bg-slate-50" />
      <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">{t('link.previewNote')}</p>
    </aside>
  );
}
