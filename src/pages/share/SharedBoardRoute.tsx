import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { fetchSharedBoard, type SharedBoard } from '../../services/share-link.service';
import { getDueDateStatus, getPriorityBadgeClass } from '../../utils/taskMetadata';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; board: SharedBoard };

/** The public, read-only view of one board. It has no app chrome, no sign-in and no way to change anything. */
export default function SharedBoardRoute() {
  const { token = '' } = useParams();
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    fetchSharedBoard(token)
      .then(board => { if (live) setState(board ? { status: 'ready', board } : { status: 'missing' }); })
      .catch(() => { if (live) setState({ status: 'error' }); });
    return () => { live = false; };
  }, [token]);

  // The address is a secret: keep it out of search engines and out of Referer headers.
  useEffect(() => {
    const tags = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const tag = document.createElement('meta'); tag.name = name; tag.content = content; document.head.appendChild(tag); return tag;
    });
    return () => tags.forEach(tag => tag.remove());
  }, []);

  const board = state.status === 'ready' ? state.board : null;
  const done = board ? board.tasks.filter(task => task.isDone).length : 0;

  return (
    <main id="main" className="min-h-screen bg-canvas px-4 py-6 sm:px-6" aria-busy={state.status === 'loading'}>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('share.page.eyebrow')}</p>
        {state.status === 'loading' && <p role="status" className="mt-4 text-sm text-slate-600">{t('share.page.loading')}</p>}
        {state.status === 'missing' && <><h1 className="mt-2 text-2xl font-semibold text-slate-950">{t('share.page.missingTitle')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('share.page.missingBody')}</p></>}
        {state.status === 'error' && <><h1 className="mt-2 text-2xl font-semibold text-slate-950">{t('share.page.errorTitle')}</h1>
          <p role="alert" className="mt-2 text-sm text-slate-600">{t('share.page.errorBody')}</p></>}
        {board && <>
          <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950">{board.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('share.page.progress', { done, total: board.tasks.length })}</p>
          {board.tasks.length === 0 ? <p className="mt-6 text-sm text-slate-600">{t('table.empty')}</p> : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <caption className="sr-only">{board.title}</caption>
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>{(['table.colTitle', 'common.status', 'common.assignee', 'common.priority', 'common.dueDate', 'table.colUpdated'] as const).map(key =>
                    <th key={key} scope="col" className="px-4 py-3">{t(key)}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {board.tasks.map((task, index) => {
                    const due = getDueDateStatus(task.dueDate || undefined, task.isDone);
                    return (
                      <tr key={index}>
                        <th scope="row" className={`px-4 py-3 text-left font-medium ${task.isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</th>
                        <td className="px-4 py-3 text-slate-600">{task.list}</td>
                        <td className="px-4 py-3 text-slate-700">{task.assignees.join(', ') || '—'}</td>
                        <td className="px-4 py-3">{task.priority ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getPriorityBadgeClass(task.priority as never) || ''}`}>{task.priority}</span> : '—'}</td>
                        <td className="px-4 py-3">{task.dueDate ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${due.className}`}>{due.label}</span> : '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{task.updatedAt ? task.updatedAt.slice(0, 10) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>}
        <p className="mt-6 text-xs text-slate-500">{t('share.page.footer')}</p>
      </div>
    </main>
  );
}
