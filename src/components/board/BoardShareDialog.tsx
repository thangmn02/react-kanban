import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n';
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink } from '../../services/share-link.service';

interface BoardShareDialogProps { boardId: string; workspaceId: string; boardTitle: string; onClose: () => void }

/** Create, copy and revoke read-only links for one board. A link's address is shown once, when it is created. */
export default function BoardShareDialog({ boardId, workspaceId, boardTitle, onClose }: BoardShareDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [fresh, setFresh] = useState<{ id: string; url: string; sheetsFormula: string; calendarUrl: string } | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    listShareLinks(boardId).then(rows => { if (live) setLinks(rows); })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : t('share.error.load')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [boardId, t]);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : t('share.error.create')); } finally { setBusy(false); }
  };
  const create = () => run(async () => {
    const { link, ...addresses } = await createShareLink(boardId, workspaceId);
    setLinks(current => [link, ...current]); setFresh({ id: link.id, ...addresses }); setMessage(t('share.created'));
  });
  const revoke = (id: string) => run(async () => {
    await revokeShareLink(id);
    setLinks(current => current.filter(link => link.id !== id));
    if (fresh?.id === id) setFresh(null);
    setMessage(t('share.revoked'));
  });
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(t('share.copied')); } catch { setError(t('share.error.copy')); }
  };
  const button = 'min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50';

  // Rendered at page level: the board header it is opened from clips fixed children to its own box.
  return createPortal(
    <div className="fixed inset-0 z-[65] overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/45" onClick={onClose} aria-hidden="true" />
      <div className="flex min-h-screen items-center justify-center px-4 py-6">
        <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <h2 id={titleId} className="text-xl font-semibold tracking-tight text-slate-950">{t('share.title')}</h2>
          <p className="mt-1 break-words text-sm font-medium text-slate-700">{boardTitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t('share.description')}</p>

          <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-700">{message}</p>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

          {fresh && <div className="mt-2 rounded-2xl bg-slate-50 p-3">
            <label htmlFor={`${titleId}-url`} className="text-xs font-semibold text-slate-600">{t('share.newLink')}</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input id={`${titleId}-url`} readOnly value={fresh.url} onFocus={event => event.target.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
              <button type="button" className={button} onClick={() => void copy(fresh.url)}>{t('invite.copyLink')}</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('share.shownOnce')}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">{t('share.google.title')}</summary>
              {([['sheets', fresh.sheetsFormula], ['calendar', fresh.calendarUrl]] as const).map(([kind, value]) => (
                <div key={kind} className="mt-3">
                  <label htmlFor={`${titleId}-${kind}`} className="text-xs font-semibold text-slate-600">{t(`share.google.${kind}Label`)}</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input id={`${titleId}-${kind}`} readOnly value={value} onFocus={event => event.target.select()} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900" />
                    <button type="button" className={button} aria-label={t(`share.google.${kind}Copy`)} onClick={() => void copy(value)}>{t('share.google.copy')}</button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t(`share.google.${kind}Help`)}</p>
                </div>
              ))}
            </details>
          </div>}

          <h3 className="mt-5 text-sm font-semibold text-slate-900">{t('share.active', { count: links.length })}</h3>
          {loading ? <p className="mt-2 text-sm text-slate-500">{t('share.page.loading')}</p>
            : links.length === 0 ? <p className="mt-2 text-sm text-slate-500">{t('share.none')}</p>
            : <ul className="mt-2 space-y-2">{links.map(link => (
              <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <span>{t('share.createdOn', { date: link.createdAt.slice(0, 10) })}</span>
                <button type="button" disabled={busy} className={button} aria-label={t('share.revokeFrom', { date: link.createdAt.slice(0, 10) })} onClick={() => void revoke(link.id)}>{t('share.revoke')}</button>
              </li>))}</ul>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button ref={closeButton} type="button" className={button} onClick={onClose}>{t('common.close')}</button>
            <button type="button" disabled={busy} onClick={() => void create()}
              className="min-h-11 cursor-pointer rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50">{t('share.create')}</button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
