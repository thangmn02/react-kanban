import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import type { DropdownMenuOption } from '@astryxdesign/core/DropdownMenu';
import { useI18n } from '../../i18n';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import type { StickyNote } from './notes-store';
import { noteColors, notePresentationPreferences } from './note-presentation';
import { labelCounts, normalizeLabel, normalizeLabels } from './note-labels';
import { notePreviewLines, setNoteTaskItem } from './note-editor-lists';
import { managerSections, selectRange, visibleEntries, type ManagerEntry, type ManagerFilter } from './notes-manager-model';
import { NoteMediaProvider } from './note-media-provider';
import type { NoteMedia } from './note-media';
import MiniEditor from './mini-editor';
import { bodyPatch } from './note-title';
import { isEmptyNote, noteSaveState, noteSaveStateKey } from './note-save-state';

type View = 'grid' | 'list';
const VIEW_KEY = 'kora:notes-manager-view:v1';
function readView(): View { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } }
function writeView(view: View) { try { localStorage.setItem(VIEW_KEY, view); } catch { /* A remembered layout is a convenience only. */ } }
const editable = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]');
const control = 'min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600';
const chip = (active: boolean) => `inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;

export interface NotesManagerProps {
  heading: ReactNode;
  /** Import and refresh controls owned by the storage route. */
  toolbar?: ReactNode;
  entries: ManagerEntry[];
  loading?: boolean;
  status?: string;
  filter: ManagerFilter;
  label: string | null;
  onNavigate: (next: { filter: ManagerFilter; label: string | null }) => void;
  canCreate: boolean;
  onCreate: (patch: Partial<StickyNote>) => Promise<string | null | undefined> | string | null | undefined;
  onChange: (id: string, patch: Partial<StickyNote>) => void;
  onArchive: (ids: string[], archived: boolean) => Promise<void>;
  onTrash: (ids: string[]) => Promise<void>;
  onRestore: (ids: string[]) => Promise<void>;
  onExport?: (ids: string[]) => Promise<void>;
  createMedia: (id: string) => NoteMedia | null;
  /** Extra "…" actions for the open note (sharing, history, float, move, convert). */
  editorActions?: (entry: ManagerEntry, close: () => void) => DropdownMenuOption[];
  tasks: { id: string; title: string }[];
  boardId: string | null;
  onOpenTask: (note: StickyNote) => void;
  /** Storage errors (save conflicts, retained drafts); also shown inside the open sheet, which hides the page. */
  saveError?: string;
  /** Device notes are complete once saved locally; connected notes still need to sync. */
  local?: boolean;
  /** A note to open in the sheet (e.g. `?note=` from Quick Notes or Saved Context), reported back once handled. */
  requestedOpenId?: string | null;
  onRequestedOpenHandled?: () => void;
  /** Replaces the grid, e.g. the device preview's Shared view. */
  unavailable?: string;
}

/** Keep-style manager: search, label chips, Pinned/Others masonry grid and an editor sheet over it. */
export default function NotesManager(props: NotesManagerProps) {
  const { t } = useI18n();
  const { entries, filter, label, onNavigate, canCreate } = props;
  const [search, setSearch] = useState(''), [view, setView] = useState<View>(readView);
  const [selected, setSelected] = useState<string[]>([]), [anchor, setAnchor] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [labelling, setLabelling] = useState(false), [bulkLabel, setBulkLabel] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const rows = useMemo(() => visibleEntries(entries, { filter, label, search }), [entries, filter, label, search]);
  const sections = managerSections(rows, filter), order = sections.flatMap(section => section.entries.map(entry => entry.note.id));
  const labels = useMemo(() => labelCounts(entries.filter(entry => !entry.note.deletedAt && !entry.note.archivedAt).map(entry => entry.note)), [entries]);
  const open = openId ? entries.find(entry => entry.note.id === openId && !entry.note.deletedAt) : undefined;
  const chosen = entries.filter(entry => selected.includes(entry.note.id));
  const trash = filter === 'trash';
  useEffect(() => {
    const id = props.requestedOpenId;
    if (!id) return;
    const found = entries.some(entry => entry.note.id === id && !entry.note.deletedAt);
    if (found) setOpenId(id);
    if (found || !props.loading) props.onRequestedOpenHandled?.();
  }, [props.requestedOpenId, props.loading, entries]); // eslint-disable-line react-hooks/exhaustive-deps
  // Closing an empty note discards it, as Quick Notes do.
  const closeSheet = () => { const current = open; setOpenId(null); if (current && current.canTrash && !current.readOnly && isEmptyNote(current.note)) void run(() => props.onTrash([current.note.id])); };
  const saveLabel = t(noteSaveStateKey(noteSaveState({ status: props.status, error: props.saveError, local: props.local, online: typeof navigator === 'undefined' || navigator.onLine })));
  // Selection only spans what is on screen.
  useEffect(() => { setSelected(current => current.filter(id => order.includes(id))); }, [order.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  const create = () => void run(async () => {
    if (!canCreate || trash) return;
    if (filter === 'archive') onNavigate({ filter: 'all', label });
    const id = await props.onCreate({ pinned: filter === 'pinned', labels: label ? [label] : [] });
    if (id) setOpenId(id);
  });
  const createRef = useRef(create); createRef.current = create;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || editable(event.target) || document.querySelector('[aria-modal="true"]')) return;
      if (event.key === '/') { event.preventDefault(); searchRef.current?.focus(); }
      else if (event.key.toLowerCase() === 'c' && !event.repeat) { event.preventDefault(); createRef.current(); }
      else if (event.key === 'Escape') setSelected([]);
    };
    // Capture phase: on Notes, / searches notes rather than the app header (the global handler skips handled events).
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  }, []);

  const toggle = (id: string, range: boolean) => { setSelected(current => selectRange(order, current, anchor, id, range)); setAnchor(id); };
  const allPinned = chosen.length > 0 && chosen.every(entry => entry.note.pinned);
  const applyLabel = () => {
    const value = normalizeLabel(bulkLabel);
    if (!value) return;
    for (const entry of chosen) if (!entry.readOnly) props.onChange(entry.note.id, { labels: normalizeLabels([...(entry.note.labels ?? []), value]) });
    setBulkLabel(''); setLabelling(false);
  };
  const viewLink = (next: ManagerFilter) => onNavigate({ filter: filter === next ? 'all' : next, label: null });

  return <section aria-busy={props.loading} className="relative pb-24">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">{props.heading}{props.toolbar && <div className="flex flex-wrap gap-2">{props.toolbar}</div>}</div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <input ref={searchRef} type="search" aria-label={t('notes.search')} placeholder={t('notes.search')} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && search) { event.stopPropagation(); setSearch(''); } }} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm" />
      <SegmentedControl label={t('notes.k.view')} value={view} size="sm" onChange={value => { const next = value === 'list' ? 'list' : 'grid'; setView(next); writeView(next); }}>
        <SegmentedControlItem value="grid" label={t('notes.k.grid')} />
        <SegmentedControlItem value="list" label={t('notes.k.list')} />
      </SegmentedControl>
    </div>
    <nav aria-label={t('notes.k.labels')} className="mb-4 flex items-center gap-2">
      <div className="quiet-scroll-fade flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
        <button type="button" aria-pressed={!label && filter !== 'archive' && filter !== 'trash'} className={chip(!label && filter !== 'archive' && filter !== 'trash')} onClick={() => onNavigate({ filter: filter === 'archive' || filter === 'trash' ? 'all' : filter, label: null })}>{t('notes.k.allNotes')}</button>
        {labels.map(row => <button key={row.label} type="button" aria-pressed={label?.toLocaleLowerCase() === row.label.toLocaleLowerCase()} aria-label={t('notes.k.filterLabel', { label: row.label })} className={chip(label?.toLocaleLowerCase() === row.label.toLocaleLowerCase())} onClick={() => onNavigate({ filter: filter === 'archive' || filter === 'trash' ? 'all' : filter, label: label === row.label ? null : row.label })}>{row.label.replaceAll('/', ' / ')}<span className="opacity-70">{row.count}</span></button>)}
      </div>
      <button type="button" aria-pressed={filter === 'archive'} className={chip(filter === 'archive')} onClick={() => viewLink('archive')}>{t('notes.k.archive')}</button>
      <button type="button" aria-pressed={trash} className={chip(trash)} onClick={() => viewLink('trash')}>{t('shell.trash')}</button>
    </nav>
    {props.status !== undefined && !props.loading && <p role="status" className="mb-2 text-xs text-slate-500">{saveLabel}</p>}
    {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {selected.length > 0 && <div role="toolbar" aria-label={t('notes.k.selected', { count: selected.length })} className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
      <span className="px-2 text-sm font-semibold text-slate-800">{t('notes.k.selected', { count: selected.length })}</span>
      {trash ? <button type="button" disabled={busy} className={control} onClick={() => void run(async () => { await props.onRestore(selected); setSelected([]); })}>{t('notes.restore')}</button> : <>
        <button type="button" disabled={busy} className={control} onClick={() => { for (const entry of chosen) props.onChange(entry.note.id, { pinned: !allPinned }); }}>{t(allPinned ? 'notes.k.unpin' : 'notes.k.pin')}</button>
        {labelling ? <form className="flex gap-1" onSubmit={event => { event.preventDefault(); applyLabel(); }}><input autoFocus aria-label={t('notes.k.labelName')} list="notes-manager-labels" maxLength={50} value={bulkLabel} onChange={event => setBulkLabel(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setLabelling(false); } }} className="min-h-9 w-40 rounded-lg border border-slate-200 px-2 text-sm" /><button type="submit" className={control}>{t('notes.k.applyLabel')}</button></form>
          : <button type="button" disabled={busy || chosen.every(entry => entry.readOnly)} className={control} onClick={() => setLabelling(true)}>{t('notes.k.addLabel')}</button>}
        <button type="button" disabled={busy || !chosen.some(entry => entry.canArchive)} className={control} onClick={() => void run(async () => { await props.onArchive(chosen.filter(entry => entry.canArchive).map(entry => entry.note.id), filter !== 'archive'); setSelected([]); })}>{t(filter === 'archive' ? 'notes.k.unarchive' : 'notes.k.archive')}</button>
        <button type="button" disabled={busy || !chosen.some(entry => entry.canTrash)} className={control} onClick={() => void run(async () => { await props.onTrash(chosen.filter(entry => entry.canTrash).map(entry => entry.note.id)); setSelected([]); })}>{t('notes.moveToTrash')}</button>
        {props.onExport && <button type="button" disabled={busy} className={control} onClick={() => void run(async () => { await props.onExport!(selected); })}>{t('notes.k.exportSelected')}</button>}
      </>}
      <button type="button" className={`${control} ml-auto`} onClick={() => { setSelected([]); setLabelling(false); }}>{t('notes.k.clearSelection')}</button>
    </div>}
    <datalist id="notes-manager-labels">{labels.map(row => <option key={row.label} value={row.label} />)}</datalist>
    {props.unavailable ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{props.unavailable}</p>
      : !props.loading && !rows.length ? <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600">{t(trash ? 'notes.trashIsEmpty' : filter === 'archive' ? 'notes.k.archiveEmpty' : search || label ? 'notes.noNotesMatchThisView' : filter === 'pinned' ? 'notes.emptyPinned' : 'notes.empty')}</p>
      : sections.map(section => <section key={section.key} aria-label={section.key === 'all' ? undefined : t(section.key === 'pinned' ? 'notes.k.pinnedSection' : 'notes.k.othersSection')} className="mb-6">
        {section.key !== 'all' && <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{t(section.key === 'pinned' ? 'notes.k.pinnedSection' : 'notes.k.othersSection')}</h2>}
        <ul className={view === 'grid' ? 'columns-[15rem] gap-3' : 'mx-auto max-w-2xl'}>
          {section.entries.map(entry => <NoteGridCard key={entry.note.id} entry={entry} trash={trash} selected={selected.includes(entry.note.id)} selecting={selected.length > 0}
            onSelect={range => toggle(entry.note.id, range)} onOpen={() => setOpenId(entry.note.id)} onChange={patch => props.onChange(entry.note.id, patch)}
            onRestore={() => void run(() => props.onRestore([entry.note.id]))} />)}
        </ul>
      </section>)}
    {canCreate && !trash && <button type="button" onClick={create} disabled={busy || props.loading} aria-keyshortcuts="C" className="fixed bottom-6 right-6 z-30 min-h-12 [body:has(.focus-island)_&]:bottom-24 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><span aria-hidden="true">+ </span>{t('notes.new')}</button>}
    <p className="mt-2 hidden text-xs text-slate-500 sm:block">{t('notes.k.shortcuts')}</p>
    {open && <NoteSheet key={open.note.id} entry={open} {...props} labels={labels.map(row => row.label)} status={saveLabel} onClose={closeSheet}
      onArchive={archived => run(async () => { await props.onArchive([open.note.id], archived); setOpenId(null); })}
      onTrash={() => run(async () => { await props.onTrash([open.note.id]); setOpenId(null); })} />}
  </section>;
}

const indent = ['', 'pl-5', 'pl-10', 'pl-14'];

function NoteGridCard({ entry, trash, selected, selecting, onSelect, onOpen, onChange, onRestore }: { entry: ManagerEntry; trash: boolean; selected: boolean; selecting: boolean; onSelect: (range: boolean) => void; onOpen: () => void; onChange: (patch: Partial<StickyNote>) => void; onRestore: () => void }) {
  const { t } = useI18n();
  const { note, readOnly } = entry, heading = useId();
  const color = noteColors[notePresentationPreferences(note).color];
  const title = note.title || t('notes.quick.untitled');
  const allLines = notePreviewLines(note.html);
  // A note named by its first line does not repeat that line under the name.
  const lines = allLines[0] && !allLines[0].task && allLines[0].text === note.title ? allLines.slice(1) : allLines, long = lines.length > 9 || lines.reduce((sum, line) => sum + line.text.length, 0) > 420;
  const items = note.checklist.slice(0, 6), more = note.checklist.length - items.length;
  const labels = normalizeLabels(note.labels);
  return <li className="mb-3 inline-block w-full break-inside-avoid align-top">
    <article aria-labelledby={heading} data-note-card={note.id} data-selected={selected || undefined}
      onClick={event => { if ((event.target as HTMLElement).closest('input, button, a, label')) return; if (selecting) onSelect(event.shiftKey); else if (!trash) onOpen(); }}
      className={`group relative cursor-pointer rounded-xl border [&_:is(p,h3,li,span,label)]:text-inherit shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md motion-reduce:transition-none ${selected ? 'ring-2 ring-blue-600' : ''}`}
      style={{ background: color.surface, color: color.text, borderColor: color.border, colorScheme: color.scheme }}>
      <input type="checkbox" readOnly checked={selected} aria-label={t('notes.k.selectNote', { title })} onClick={event => onSelect(event.shiftKey)}
        className={`absolute -left-2 -top-2 z-10 h-5 w-5 cursor-pointer accent-blue-600 focus-visible:opacity-100 ${selecting || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`} />
      {!trash && <button type="button" aria-pressed={note.pinned} className={`absolute right-1 top-1 z-10 min-h-8 rounded-md px-2 text-xs opacity-80 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-blue-600 ${note.pinned ? '' : 'sm:opacity-0 sm:group-hover:opacity-80 sm:group-focus-within:opacity-80'}`} onClick={() => onChange({ pinned: !note.pinned })}>{t(note.pinned ? 'notes.k.unpin' : 'notes.k.pin')}</button>}
      <button type="button" disabled={trash} onClick={() => { if (selecting) onSelect(false); else onOpen(); }} aria-label={t('notes.k.openNote', { title })} className="block w-full rounded-xl px-4 pb-2 pr-14 pt-3 text-left focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-default">
        <h3 id={heading} className={`break-words text-sm font-semibold ${note.title ? '' : 'opacity-60'}`}>{title}</h3>
      </button>
      {lines.length > 0 && <div className={`-mt-1 break-words px-4 pb-2 text-sm leading-6 opacity-90 ${long ? 'max-h-56 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]' : ''}`}>
        {lines.slice(0, 14).map((line, row) => line.task
          ? <label key={row} className={`flex items-start gap-2 ${indent[Math.min(line.task.depth, 3)]}`}><input type="checkbox" className="mt-1.5" disabled={readOnly || trash} checked={line.task.checked} onChange={event => onChange({ html: setNoteTaskItem(note.html, line.task!.index, event.target.checked) })} /><span className={line.task.checked ? 'line-through opacity-60' : ''}>{line.text}</span></label>
          : line.marker
            ? <p key={row} className={`flex gap-2 ${indent[Math.min(line.depth ?? 0, 3)]}`}><span aria-hidden="true" className="min-w-3 opacity-70">{line.marker}</span><span>{line.text}</span></p>
            : <p key={row}>{line.text}</p>)}
      </div>}
      {items.length > 0 && <ul className="space-y-1 px-4 pb-2">{items.map(item => <li key={item.id}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={readOnly || trash} checked={item.isDone} onChange={event => onChange({ checklist: note.checklist.map(row => row.id === item.id ? { ...row, isDone: event.target.checked } : row) })} /><span className={item.isDone ? 'line-through opacity-60' : ''}>{item.text}</span></label></li>)}
        {more > 0 && <li className="text-xs opacity-70">{t('notes.k.moreItems', { count: more })}</li>}</ul>}
      {(labels.length > 0 || readOnly) && <p className="flex flex-wrap gap-1 px-4 pb-3">{labels.map(value => <span key={value} className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{value.replaceAll('/', ' / ')}</span>)}{readOnly && !trash && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs opacity-80">{t('notes.k.readOnly')}</span>}</p>}
      {trash && <p className="px-4 pb-3"><button type="button" className={control} onClick={onRestore}>{t('notes.restore')}</button></p>}
    </article>
  </li>;
}

function NoteSheet({ entry, labels, onClose, onArchive, onTrash, onChange, createMedia, editorActions, tasks, boardId, onOpenTask, status, saveError }: Omit<NotesManagerProps, 'onArchive' | 'onTrash'> & { entry: ManagerEntry; labels: string[]; onClose: () => void; onArchive: (archived: boolean) => void; onTrash: () => void }) {
  const { t } = useI18n();
  const { note, readOnly } = entry, id = note.id;
  const dialog = useRef<HTMLElement | null>(null);
  useDialogFocus(true, dialog, onClose);
  const [media] = useState(() => createMedia(id));
  const [item, setItem] = useState(''), [labelDraft, setLabelDraft] = useState(''), [linking, setLinking] = useState(false);
  const presentation = notePresentationPreferences(note), color = noteColors[presentation.color];
  const change = (patch: Partial<StickyNote>) => onChange(id, patch);
  const noteLabels = normalizeLabels(note.labels);
  const addLabel = () => { const value = normalizeLabel(labelDraft); if (value) change({ labels: normalizeLabels([...noteLabels, value]) }); setLabelDraft(''); };
  const linkedTask = note.taskId ? tasks.find(task => task.id === note.taskId) : undefined;
  const more: DropdownMenuOption[] = [
    ...(!readOnly && !note.taskId ? [{ label: t('notes.k.linkTask'), isDisabled: !boardId || !tasks.length, onClick: () => setLinking(true) }] : []),
    ...(editorActions?.(entry, onClose) ?? []),
  ];
  const body = <MiniEditor html={note.html} compact={false} readOnly={readOnly} onChange={html => change(bodyPatch(note, html))} />;
  return <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/30 p-3 sm:p-10" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label={t('notes.k.editNote')} className="flex w-full max-w-2xl flex-col rounded-2xl border shadow-2xl [&_:is(p,h1,h2,h3,li,span,label,blockquote)]:text-inherit" style={{ background: color.surface, color: color.text, borderColor: color.border, colorScheme: color.scheme, '--note-font-size': `${presentation.fontSize}px` } as React.CSSProperties}>
      <div className="space-y-3 p-4 sm:p-5">
        {saveError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{saveError}</p>}
        <input aria-label={t('notes.quick.titleLabel')} readOnly={readOnly} maxLength={160} value={note.title} placeholder={t('notes.quick.untitled')} onChange={event => change({ title: event.target.value })} className="w-full bg-transparent text-lg font-semibold text-inherit outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
        {media ? <NoteMediaProvider media={media}>{body}</NoteMediaProvider> : body}
        {(note.checklist.length > 0 || !readOnly) && <div>
          <ul className="space-y-1">{note.checklist.map(check => <li key={check.id} className="group/item flex items-start gap-2"><label className="flex flex-1 items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={readOnly} checked={check.isDone} onChange={event => change({ checklist: note.checklist.map(row => row.id === check.id ? { ...row, isDone: event.target.checked } : row) })} /><span className={check.isDone ? 'line-through opacity-60' : ''}>{check.text}</span></label>
            {!readOnly && <button type="button" aria-label={t('notes.k.removeItem', { item: check.text })} className="min-h-7 rounded px-2 text-xs opacity-60 hover:bg-black/5 hover:opacity-100" onClick={() => change({ checklist: note.checklist.filter(row => row.id !== check.id) })}>×</button>}</li>)}</ul>
          {!readOnly && <form className="mt-1 flex gap-1" onSubmit={event => { event.preventDefault(); if (item.trim() && note.checklist.length < 100) { change({ checklist: [...note.checklist, { id: crypto.randomUUID(), text: item.trim(), isDone: false }] }); setItem(''); } }}><input aria-label={t('task.checklistItem')} maxLength={500} placeholder={t('notes.addChecklistItem')} value={item} onChange={event => setItem(event.target.value)} className="min-w-0 flex-1 rounded border border-black/10 bg-black/5 px-2 py-1 text-sm" /><button type="submit" className="min-h-8 rounded-md px-2 text-xs hover:bg-black/5">{t('notes.add')}</button></form>}
        </div>}
        <div className="flex flex-wrap items-center gap-1">
          {noteLabels.map(value => <span key={value} className="inline-flex items-center gap-1 rounded-full bg-black/5 py-0.5 pl-2 text-xs">{value.replaceAll('/', ' / ')}{!readOnly && <button type="button" aria-label={t('notes.k.removeLabel', { label: value })} className="min-h-6 rounded-full px-1.5 hover:bg-black/10" onClick={() => change({ labels: noteLabels.filter(row => row !== value) })}>×</button>}</span>)}
          {!readOnly && <form className="inline-flex" onSubmit={event => { event.preventDefault(); addLabel(); }}><input aria-label={t('notes.k.addLabel')} title={t('notes.k.labelHint')} list="notes-sheet-labels" maxLength={50} value={labelDraft} placeholder={t('notes.k.addLabel')} onChange={event => setLabelDraft(event.target.value)} onBlur={addLabel} className="min-h-7 w-32 rounded-full border border-dashed border-black/20 bg-transparent px-2 text-xs" /><datalist id="notes-sheet-labels">{labels.filter(value => !noteLabels.includes(value)).map(value => <option key={value} value={value} />)}</datalist></form>}
        </div>
        {note.taskId && <p className="flex flex-wrap items-center gap-1 text-xs"><span className="inline-flex items-center gap-1 rounded-full bg-black/5 py-0.5 pl-2"><button type="button" className="underline-offset-2 hover:underline" onClick={() => onOpenTask(note)}>{t('notes.k.linkedTask', { title: linkedTask?.title ?? t('notes.openLinkedTask') })}</button>{!readOnly && <button type="button" aria-label={t('notes.k.unlinkTask')} className="min-h-6 rounded-full px-1.5 hover:bg-black/10" onClick={() => change({ taskId: null, taskBoardId: null })}>×</button>}</span></p>}
        {linking && !note.taskId && <label className="block text-xs">{t('notes.linkToTask')}<select autoFocus aria-label={t('notes.linkToTask')} className="mt-1 w-full rounded border border-black/10 bg-black/5 p-2 text-xs" value="" onChange={event => { if (event.target.value) change({ taskId: event.target.value, taskBoardId: boardId }); setLinking(false); }}><option value="">{t('briefing.pin.noTask')}</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>}
      </div>
      <footer className="flex flex-wrap items-center gap-1 border-t border-black/10 px-3 py-2">
        <span role="radiogroup" aria-label={t('notes.noteColor')} className="mr-1 flex gap-1">{(Object.keys(noteColors) as (keyof typeof noteColors)[]).map(key => <button key={key} type="button" role="radio" aria-checked={presentation.color === key} aria-label={t('notes.k.colorName', { name: noteColors[key].label })} title={noteColors[key].label} onClick={() => change({ color: key })} className={`h-6 w-6 rounded-full border focus-visible:outline-2 focus-visible:outline-blue-600 ${presentation.color === key ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`} style={{ background: noteColors[key].surface, borderColor: noteColors[key].border }} />)}</span>
        <button type="button" aria-pressed={note.pinned} className="min-h-8 rounded-md px-2 text-xs hover:bg-black/5" onClick={() => change({ pinned: !note.pinned })}>{t(note.pinned ? 'notes.k.unpin' : 'notes.k.pin')}</button>
        {entry.canArchive && <button type="button" className="min-h-8 rounded-md px-2 text-xs hover:bg-black/5" onClick={() => onArchive(!note.archivedAt)}>{t(note.archivedAt ? 'notes.k.unarchive' : 'notes.k.archive')}</button>}
        {entry.canTrash && <button type="button" className="min-h-8 rounded-md px-2 text-xs hover:bg-black/5" onClick={onTrash}>{t('notes.moveToTrash')}</button>}
        {more.length > 0 && <span className="inline-flex [&_.astryx-button]:!text-inherit"><MoreMenu label={t('notes.k.more')} size="sm" items={more} /></span>}
        <span role="status" className="ml-auto truncate px-1 text-xs opacity-70">{status}</span>
        <button type="button" className="min-h-8 rounded-md px-3 text-sm font-medium hover:bg-black/5" onClick={onClose}>{t('notes.k.close')}</button>
      </footer>
    </section>
  </div>;
}
