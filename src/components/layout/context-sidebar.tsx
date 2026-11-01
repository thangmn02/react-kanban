import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../../i18n';
import type { BoardData } from '../../types/task.type';
import type { BoardRow } from '../../types/supabase.type';
import { NOTES_PREVIEW_ENABLED } from '../../constants/features';

interface Props {
  activeView: string; workspaceId: string | null; workspaceName?: string;
  boards: BoardRow[]; activeBoardId: string | null; boardData: BoardData;
  onBoard: (id: string) => void; onHighPriority: () => void; onDueToday: () => void; onClearFilters: () => void;
  /** Connected accounts can share notes; the device-only preview cannot, so its Shared view is not offered. */
  notesSharing?: boolean;
}

/** The one Notes navigation: scope first (Workspace / Personal), then the view inside it. */
function NotesLinks({ item, close, sharing, search }: { item: string; close: () => void; sharing: boolean; search: string }) {
  const { t } = useI18n();
  const query = new URLSearchParams(search), personal = query.get('scope') === 'personal', active = query.get('filter') || 'all';
  const scope = personal ? '&scope=personal' : '';
  const selected = 'bg-white font-semibold text-slate-900 shadow-sm';
  const filters = (['all', 'pinned', 'recent', ...(sharing && !personal ? ['shared'] as const : []), 'trash'] as const);
  return <>
    <div role="group" aria-label={t('notes.scope')} className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-black/5 p-1">
      {([false, true] as const).map(value => <Link key={String(value)} to={value ? '/notes?scope=personal' : '/notes'} onClick={close}
        aria-current={personal === value ? 'page' : undefined}
        className={`min-h-9 rounded-md px-2 py-2 text-center text-xs text-slate-600 ${personal === value ? selected : ''}`}>{t(value ? 'notes.scope.personal' : 'notes.scope.workspace')}</Link>)}
    </div>
    {filters.map(filter => <Link key={filter} to={`/notes?filter=${filter}${scope}`} onClick={close} aria-current={active === filter ? 'page' : undefined}
      className={`${item} ${active === filter ? selected : ''}`}>{t(`shell.${filter}`)}</Link>)}
  </>;
}

export default function ContextSidebar({ activeView, workspaceId, boards, activeBoardId, boardData, onBoard, onHighPriority, onDueToday, onClearFilters, notesSharing = false }: Props) {
  const { t } = useI18n();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false), [mobileOpen, setMobileOpen] = useState(false);
  const focus = ['focus', 'music', 'beat-grid'].includes(activeView);
  const board = ['board', 'calendar', 'table'].includes(activeView);
  const compact = collapsed || focus;
  const item = 'block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-blue-600';
  const close = () => setMobileOpen(false);
  return <aside aria-label={t('shell.context')} className={`relative shrink-0 bg-[#F1F2F4] lg:min-h-screen ${compact ? 'lg:w-10' : 'lg:w-60'} motion-safe:transition-[width] motion-safe:duration-200`}>
    <div className="flex items-center justify-between px-3 py-2 lg:hidden"><span className="text-xs font-medium text-slate-600">{t('shell.context')}</span><button type="button" aria-expanded={mobileOpen} aria-controls="context-links" onClick={() => setMobileOpen(value => !value)} className="min-h-10 rounded-lg px-3 text-sm text-slate-700">{t('shell.context')} {mobileOpen ? '−' : '+'}</button></div>
    <button type="button" aria-expanded={!compact} aria-controls="context-links" aria-label={t(compact ? 'shell.expand' : 'shell.collapse')} onClick={() => { if (focus) return; setCollapsed(value => !value); }} disabled={focus} className="absolute right-1 top-4 z-10 hidden h-8 w-8 rounded-lg text-slate-500 hover:bg-black/5 disabled:opacity-40 lg:block">{compact ? '›' : '‹'}</button>
    <div id="context-links" className={`${mobileOpen ? 'block' : 'hidden'} ${compact ? 'lg:hidden' : 'lg:block'} p-4 lg:sticky lg:top-0 lg:pt-6`}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t(board ? 'navigation.board' : activeView === 'notes' ? 'shell.notes' : activeView === 'members' ? 'shell.workspace' : 'app.today')}</h2>
      {board ? <>
        <div className="space-y-1">{boards.map(row => <button type="button" key={row.id} className={`${item} ${row.id === activeBoardId ? 'bg-white font-semibold shadow-sm' : ''}`} aria-current={row.id === activeBoardId ? 'page' : undefined} onClick={() => { onBoard(row.id); close(); }}>{row.title}</button>)}</div>
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-500">{t('shell.lists')}</p>
        {boardData.columns.map(id => <p key={id} className="flex justify-between px-3 py-2 text-xs text-slate-600"><span>{boardData.list[id].title}</span><span>{boardData.list[id].tasks.length}</span></p>)}
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-500">{t('shell.filters')}</p>
        <button type="button" className={item} onClick={onHighPriority}>{t('shell.priority')}</button><button type="button" className={item} onClick={onDueToday}>{t('shell.dueToday')}</button><button type="button" className={item} onClick={onClearFilters}>{t('shell.clearFilters')}</button>
      </> : activeView === 'notes' ? <NotesLinks item={item} close={close} sharing={notesSharing} search={location.search} />
      : activeView === 'members' ? <><Link className={item} to={`/workspaces/${workspaceId}/members`} onClick={close}>{t('shell.membersInvites')}</Link><Link className={item} to="/tasks" onClick={close}>{t('shell.sharedBoards')}</Link></>
      : <><Link className={item} to="/today#today-plan-heading" onClick={close}>{t('shell.priorityPlanning')}</Link><Link className={item} to="/today#today-due-tasks" onClick={close}>{t('shell.dueToday')}</Link>{NOTES_PREVIEW_ENABLED && <Link className={item} to="/notes?filter=pinned" onClick={close}>{t('shell.pinned')}</Link>}</>}
      {board && workspaceId && <Link className={`${item} mt-6 border-t border-slate-200 pt-4`} to={`/workspaces/${workspaceId}/members`} onClick={close}>{t('shell.membersInvites')}</Link>}
    </div>
  </aside>;
}
