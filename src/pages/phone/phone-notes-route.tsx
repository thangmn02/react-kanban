import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import type { AppUser, WorkspaceSummary } from '../../types/auth.type';
import { fetchUserWorkspaces } from '../../services/workspace.service';
import { fetchConnectedNotes } from '../../services/notes.service';
import { readDurableDeviceNotes, type StickyNote } from '../../features/notes/notes-store';
import { managerSections, visibleEntries, type ManagerEntry } from '../../features/notes/notes-manager-model';
import { labelCounts, normalizeLabels } from '../../features/notes/note-labels';
import { notePreviewLines } from '../../features/notes/note-editor-lists';
import { noteColors, notePresentationPreferences } from '../../features/notes/note-presentation';
import { connectedNoteMedia } from '../../features/notes/connected-note-media';
import { NoteMediaProvider } from '../../features/notes/note-media-provider';
import MiniEditor from '../../features/notes/mini-editor';
import { authDestination } from '../../app/auth-routing';
import { usePhoneAppHead, usePhoneInstallHint } from '../../features/notes/phone-install';

const SOURCE_KEY = 'kora:phone-notes-source:v1';
type Source = { id: string | null; name: string; role?: WorkspaceSummary['role'] };

/** Signed-in notes for one place (Personal or a workspace), read only: no trash, no archive. */
async function loadNotes(user: AppUser, source: Source): Promise<StickyNote[]> {
  if (user.isMock) return (await readDurableDeviceNotes({ userId: user.id, workspaceId: source.id })).filter(note => !note.deletedAt);
  return (await fetchConnectedNotes(user, source.id, source.role)).filter(entry => !entry.row.deleted_at).map(entry => entry.note);
}

const control = 'min-h-11 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

/** Kora Notes for phones: a notes-only, read-only page that can be installed to the home screen. */
export default function PhoneNotesRoute() {
  const { t } = useI18n();
  const { user, isAuthLoading, authMode } = useAuth();
  usePhoneAppHead();
  useEffect(() => { const title = document.title; document.title = 'Kora Notes'; return () => { document.title = title; }; }, []);
  let body;
  if (isAuthLoading) body = <p role="status" className="p-6 text-sm opacity-70">{t('auth.checkingSession')}</p>;
  else if (!user || authMode === 'supabase' && user.isMock) body = <section className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 className="text-2xl font-semibold">Kora Notes</h1>
    <p className="max-w-xs text-sm opacity-80">{t('phone.signInBody')}</p>
    <Link to={authDestination('/phone')} className={`${control} inline-flex items-center bg-slate-900 text-white`}>{t('phone.signIn')}</Link>
  </section>;
  else body = <PhoneNotes user={user} />;
  return <main className="flex min-h-dvh flex-col bg-canvas pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-slate-900">
    {body}
    <InstallHint />
  </main>;
}

function PhoneNotes({ user }: { user: AppUser }) {
  const { t } = useI18n();
  const [places, setPlaces] = useState<Source[] | null>(null);
  const sources = places ?? [{ id: null, name: t('phone.personal') }];
  const [sourceId, setSourceId] = useState<string | null>(() => { try { return localStorage.getItem(SOURCE_KEY) || null; } catch { return null; } });
  const [notes, setNotes] = useState<StickyNote[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(''), [label, setLabel] = useState<string | null>(null);
  // The open note is in the address (`?note=`), so the phone's Back button returns to the list.
  const [params] = useSearchParams(), navigate = useNavigate();
  const openId = params.get('note');
  const openNote = (id: string) => navigate(`/phone?${new URLSearchParams({ note: id })}`);
  const closeNote = () => { if (window.history.state?.idx > 0) navigate(-1); else navigate('/phone', { replace: true }); };
  // Like Notes on the computer, start in the first workspace unless the user picked another place.
  const source = sourceId === 'personal' ? sources[0] : sources.find(item => item.id !== null && item.id === sourceId) ?? sources[1] ?? sources[0];

  useEffect(() => {
    let live = true;
    void fetchUserWorkspaces(user).then(rows => { if (live) setPlaces([{ id: null, name: t('phone.personal') }, ...rows.map(row => ({ id: row.id, name: row.name, role: row.role }))]); }).catch(reason => { if (live) { setPlaces([{ id: null, name: t('phone.personal') }]); setError(String(reason instanceof Error ? reason.message : reason)); } });
    return () => { live = false; };
  }, [user, t]);

  const ready = places !== null;
  const refresh = useCallback(async () => {
    if (!ready) return;
    setLoading(true); setError('');
    try { setNotes(await loadNotes(user, source)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, [user, source, ready]);
  useEffect(() => { void refresh(); }, [refresh]);
  // Coming back to the app shows what changed on the computer meanwhile.
  useEffect(() => { const visible = () => { if (document.visibilityState === 'visible') void refresh(); }; document.addEventListener('visibilitychange', visible); return () => document.removeEventListener('visibilitychange', visible); }, [refresh]);

  const entries = useMemo<ManagerEntry[]>(() => (notes ?? []).filter(note => !note.archivedAt).map(note => ({ note, readOnly: true, canArchive: false, canTrash: false })), [notes]);
  const labels = useMemo(() => labelCounts(entries.map(entry => entry.note)), [entries]);
  const rows = visibleEntries(entries, { filter: 'all', label, search });
  const sections = managerSections(rows, 'all');
  const open = entries.find(entry => entry.note.id === openId)?.note;
  if (open) return <NoteReader note={open} user={user} onBack={closeNote} />;

  return <>
    <header className="sticky top-0 z-10 space-y-3 border-b border-black/5 bg-canvas/95 px-4 pb-3 pt-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Kora Notes</h1>
        <button type="button" onClick={() => void refresh()} disabled={loading} className={`${control} border border-black/10 disabled:opacity-60`}>{loading ? t('phone.refreshing') : t('phone.refresh')}</button>
      </div>
      {sources.length > 1 && <label className="flex items-center gap-2 text-sm"><span className="opacity-70">{t('phone.notesIn')}</span>
        <select value={source.id ?? 'personal'} onChange={event => { const next = event.target.value; setSourceId(next); setLabel(null); try { localStorage.setItem(SOURCE_KEY, next); } catch { /* remembered for this visit only */ } }}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-2">
          {sources.map(item => <option key={item.id ?? 'personal'} value={item.id ?? 'personal'}>{item.name}</option>)}
        </select></label>}
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('notes.search')} aria-label={t('notes.search')}
        className="min-h-11 w-full rounded-full border border-black/10 bg-black/5 px-4 text-base" />
      {labels.length > 0 && <nav aria-label={t('notes.k.labels')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[null, ...labels.map(item => item.label)].map(value => <button key={value ?? 'all'} type="button" aria-pressed={label === value} onClick={() => setLabel(value)}
          className={`${control} shrink-0 border ${label === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-black/10'}`}>{value === null ? t('notes.k.allNotes') : value.replaceAll('/', ' / ')}</button>)}
      </nav>}
    </header>
    {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notes === null && !error ? <p role="status" className="p-6 text-sm opacity-70">{t('phone.loading')}</p>
      : !rows.length && !error ? <p className="p-6 text-center text-sm opacity-70">{search || label ? t('phone.noMatches') : t('phone.empty')}</p>
      : sections.map(section => <section key={section.key} aria-label={section.key === 'others' ? t('notes.k.othersSection') : section.key === 'pinned' ? t('notes.k.pinnedSection') : undefined} className="px-4 pt-4">
        {section.key !== 'all' && <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">{t(section.key === 'pinned' ? 'notes.k.pinnedSection' : 'notes.k.othersSection')}</h2>}
        <ul className="space-y-3">{section.entries.map(entry => <PhoneNoteCard key={entry.note.id} note={entry.note} onOpen={() => openNote(entry.note.id)} />)}</ul>
      </section>)}
    <p className="px-4 py-6 text-center text-xs opacity-60">{t('phone.readOnlyHint')}</p>
  </>;
}

function PhoneNoteCard({ note, onOpen }: { note: StickyNote; onOpen: () => void }) {
  const { t } = useI18n();
  const color = noteColors[notePresentationPreferences(note).color];
  const title = note.title || t('notes.quick.untitled');
  const lines = notePreviewLines(note.html).slice(0, 6), items = note.checklist.slice(0, 4), labels = normalizeLabels(note.labels);
  return <li>
    <button type="button" onClick={onOpen} aria-label={t('notes.k.openNote', { title })}
      className="block w-full rounded-xl border px-4 py-3 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&_:is(p,h3,li,span)]:text-inherit"
      style={{ background: color.surface, color: color.text, borderColor: color.border, colorScheme: color.scheme }}>
      <h3 className={`break-words font-semibold ${note.title ? '' : 'opacity-60'}`}>{title}</h3>
      {lines.map((line, row) => <p key={row} className="mt-0.5 line-clamp-2 break-words text-sm opacity-90">{line.task ? (line.task.checked ? '☑ ' : '☐ ') : line.marker ? `${line.marker} ` : ''}<span className={line.task?.checked ? 'line-through opacity-60' : ''}>{line.text}</span></p>)}
      {items.map(item => <p key={item.id} className="mt-0.5 break-words text-sm opacity-90">{item.isDone ? '☑ ' : '☐ '}<span className={item.isDone ? 'line-through opacity-60' : ''}>{item.text}</span></p>)}
      {labels.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{labels.map(value => <span key={value} className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{value.replaceAll('/', ' / ')}</span>)}</span>}
    </button>
  </li>;
}

function NoteReader({ note, user, onBack }: { note: StickyNote; user: AppUser; onBack: () => void }) {
  const { t, language } = useI18n();
  const heading = useId();
  const color = noteColors[notePresentationPreferences(note).color];
  const media = useMemo(() => user.isMock ? null : connectedNoteMedia(user.id, note.id, async () => {}), [user, note.id]);
  useEffect(() => { const back = (event: KeyboardEvent) => { if (event.key === 'Escape') onBack(); }; window.addEventListener('keydown', back); return () => window.removeEventListener('keydown', back); }, [onBack]);
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const labels = normalizeLabels(note.labels);
  return <article aria-labelledby={heading} className="flex min-h-dvh flex-col [&_:is(p,h1,h2,h3,li,span,label)]:text-inherit" style={{ background: color.surface, color: color.text, colorScheme: color.scheme }}>
    <header className="sticky top-0 flex items-center gap-2 border-b px-2 py-2" style={{ background: color.surface, borderColor: color.border }}>
      <button type="button" autoFocus onClick={onBack} className={`${control} hover:bg-black/5`}><span aria-hidden="true">← </span>{t('phone.back')}</button>
    </header>
    <div className="flex-1 space-y-3 px-4 py-4">
      <h1 id={heading} className={`break-words text-2xl font-semibold ${note.title ? '' : 'opacity-60'}`}>{note.title || t('notes.quick.untitled')}</h1>
      <NoteMediaProvider media={media}><MiniEditor html={note.html} compact={false} readOnly minimal onChange={() => {}} /></NoteMediaProvider>
      {note.checklist.length > 0 && <ul className="space-y-2">{note.checklist.map(item => <li key={item.id} className="flex items-start gap-2"><input type="checkbox" className="mt-1" disabled checked={item.isDone} aria-label={item.text} /><span className={item.isDone ? 'line-through opacity-60' : ''}>{item.text}</span></li>)}</ul>}
      {labels.length > 0 && <p className="flex flex-wrap gap-1">{labels.map(value => <span key={value} className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{value.replaceAll('/', ' / ')}</span>)}</p>}
      <p className="text-xs opacity-60">{t('phone.updated', { date: new Date(note.updatedAt).toLocaleString(language) })}</p>
    </div>
  </article>;
}

function InstallHint() {
  const { t } = useI18n();
  const { kind, install, dismiss } = usePhoneInstallHint();
  if (!kind) return null;
  return <aside aria-label={t('phone.installTitle')} className="sticky bottom-0 mt-auto flex items-center gap-3 border-t border-black/10 bg-canvas px-4 py-3 text-sm shadow-lg">
    <img src="/icons/kora-notes-192.png" alt="" className="h-10 w-10 rounded-xl" />
    <p className="flex-1">{kind === 'prompt' ? t('phone.installBody') : t('phone.installApple')}</p>
    {kind === 'prompt' && <button type="button" onClick={() => void install()} className={`${control} bg-slate-900 text-white`}>{t('phone.install')}</button>}
    <button type="button" onClick={dismiss} aria-label={t('phone.dismissInstall')} className={`${control} px-3`}>×</button>
  </aside>;
}
