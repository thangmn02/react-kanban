import type { AppUser, WorkspaceRole } from '../../types/auth.type';
import { requireSupabaseClient } from '../../lib/supabase';
import { fetchConnectedNotes, saveConnectedNote, saveNoteLayout } from '../../services/notes.service';
import { newNote, type StickyNote } from './notes-store';
import { noteContent, notePresentation, type ConnectedNote } from './notes-types';
import { subscribeNoteInvalidations } from '../../services/note-invalidation.service';
import { isTauri } from '@tauri-apps/api/core';
import { writeNativeDraft, retireNativeDraft, readStoredNoteDrafts } from './native-note-bridge';

export interface NoteDraft {
  note: StickyNote; baseRevision: number; token: string; content: boolean; layout: boolean; updatedAt: string;
}
interface Pending extends NoteDraft { version: number; firstEdit: number; blocked: boolean; localFailed?: boolean; source?:string }
interface Snapshot {
  notes: ConnectedNote[]; drafts: { key: string; draft: NoteDraft }[];
  loading: boolean; saving: boolean; error: string; status: string; conflicts: string[];
}
/** One account/destination owner. In-flight writes never advance another scope. */
export class ConnectedNotesSession {
  private snapshot: Snapshot = { notes: [], drafts: [], loading: true, saving: false, error: '', status: '', conflicts: [] };
  private listeners = new Set<() => void>();
  private pending = new Map<string, Pending>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<string>();
  private durability = new Map<string, Promise<void>>();
  private durableJobs = new Map<string, Pending>();
  private discarding = new Set<string>();
  private draftCache = new Map<string,string>();
  private ownCommittedTokens=new Map<string,{token:string;source?:string}>();
  private stopped = false;
  private refreshInFlight: Promise<void> | null = null;
  private refreshRequested = false;
  private writer = crypto.randomUUID();
  private recoveredSources = new Map<string, Map<string, string>>();
  private prefix: string;
  private user: AppUser;
  private workspaceId: string | null;
  private role?: WorkspaceRole;
  constructor(user: AppUser, workspaceId: string | null, role?: WorkspaceRole) {
    this.user = user; this.workspaceId = workspaceId; this.role = role;
    this.prefix = `kora:notes-draft:${user.id}:${workspaceId ?? 'personal'}:`;
    this.snapshot = { ...this.snapshot, drafts: this.scanDrafts() };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private emit(patch: Partial<Snapshot>) {
    if (this.stopped) return;
    this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener());
  }
  private pendingStatus() {
    const jobs=[...this.pending.values()];
    if(jobs.some(job=>job.localFailed))return 'Local save failed.';
    if(jobs.some(job=>this.durableJobs.get(job.note.id)!==job))return 'Saving locally…';
    return jobs.length?'Saved locally, awaiting synchronization.':'All changes saved.';
  }
  private key(id: string) { return `${this.prefix}${id}:${this.writer}`; }
  private rawDraft(key:string){return this.draftCache.get(key)??localStorage.getItem(key);}
  private scanDrafts() {
    const drafts: Snapshot['drafts'] = [];
    const keys=new Set(this.draftCache.keys());
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(this.prefix)) keys.add(key);
    }
    for(const key of keys){
      try {
        const draft: NoteDraft = JSON.parse(this.rawDraft(key)!);
        if (draft.note?.id && typeof draft.note.html === 'string' && Array.isArray(draft.note.checklist) && Number.isInteger(draft.baseRevision) && typeof draft.token === 'string' && typeof draft.updatedAt === 'string') drafts.push({ key, draft });
      } catch { /* Preserve unreadable storage for manual recovery. */ }
    }
    return drafts.sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt));
  }
  private async hydrateDrafts(){
    try{const persisted=await readStoredNoteDrafts(this.prefix);if(this.stopped)return;for(const record of persisted){const previous=this.rawDraft(record.key);if(previous&&previous!==record.value){try{const legacy=JSON.parse(previous) as NoteDraft;if(legacy.note?.id){const retained=`${this.prefix}${legacy.note.id}:${crypto.randomUUID()}`;this.draftCache.set(retained,previous);if(!isTauri())await writeNativeDraft(retained,previous);try{localStorage.setItem(retained,previous);}catch{/* Primary transactional storage retains it. */}}}catch{/* Preserve unreadable legacy bytes in place. */}}this.draftCache.set(record.key,record.value);try{localStorage.setItem(record.key,record.value);}catch{/* The transactional outbox remains authoritative. */}}this.emit({drafts:this.scanDrafts()});}
    catch(error){this.emit({error:`${message(error)} Existing device drafts are retained.`});}
  }
  refresh(): Promise<void> {
    this.refreshRequested = true;
    if (this.refreshInFlight) return this.refreshInFlight;
    const work = async () => { while (!this.stopped && this.refreshRequested) { this.refreshRequested = false; await this.readSnapshot(); } };
    this.refreshInFlight = work().finally(() => { this.refreshInFlight = null; });
    return this.refreshInFlight;
  }
  private async readSnapshot() {
    try {
      const rows = await fetchConnectedNotes(this.user, this.workspaceId, this.role);
      if (this.stopped) return;
      for (const [id, job] of this.pending) {
        const remote = rows.find(row => row.note.id === id);
        if (job.baseRevision > 0 && (!remote || remote.row.deleted_at || job.content && !['edit', 'manage'].includes(remote.permission))) job.blocked = true;
      }
      const merged = rows.map(row => {
        const job = this.pending.get(row.note.id);
        const presented = { ...row, note: { ...row.note, peek: this.snapshot.notes.find(item => item.note.id === row.note.id)?.note.peek ?? false } };
        return job && !job.blocked ? { ...presented, note: { ...job.note, revision: row.row.revision } } : presented;
      });
      for (const [id, job] of this.pending) if (!job.blocked && job.baseRevision === 0 && !merged.some(row => row.note.id === id)) merged.push(this.newEntry(job.note));
      this.emit({ notes: merged, loading: false, error: '', drafts: this.scanDrafts(), conflicts: [...this.pending].filter(([, job]) => job.blocked).map(([id]) => id) });
    } catch (error) { this.emit({ loading: false, error: message(error), drafts: this.scanDrafts() }); }
  }
  start() {
    this.stopped = false;
    const client = requireSupabaseClient();
    let disconnected = false;
    let unsubscribe = () => {};
    let unsubscribeAuth = () => {};
    const interval:{current:ReturnType<typeof setInterval>|undefined}={current:undefined};
    const online = () => { void this.refresh().then(() => this.retry()); };
    const focused = () => { void this.refresh(); };
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true; this.stopped = true; this.timers.forEach(clearTimeout); clearInterval(interval.current);
      unsubscribeAuth(); unsubscribe();
      window.removeEventListener('online', online); window.removeEventListener('focus', focused);
    };
    const auth = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id === this.user.id || this.stopped) return;
      this.snapshot = { ...this.snapshot, notes: [], drafts: [], error: '', status: '', loading: true };
      this.listeners.forEach(listener => listener()); disconnect();
    });
    unsubscribeAuth = () => auth.data.subscription.unsubscribe();
    if (disconnected) { unsubscribeAuth(); return disconnect; }
    void this.hydrateDrafts().then(()=>this.refresh());
    unsubscribe = subscribeNoteInvalidations(this.user.id, () => { void this.refresh(); });
    window.addEventListener('online', online); window.addEventListener('focus', focused);
    interval.current = setInterval(focused, 15000);
    return disconnect;
  }
  private newEntry(note: StickyNote): ConnectedNote {
    return { note, permission: 'manage', row: { id: note.id, owner_user_id: this.user.id, workspace_id: this.workspaceId, title: note.title, content: noteContent(note), content_schema_version: 1, visibility: 'private', revision: 0, write_token: note.writeToken, import_key: null, created_at: note.updatedAt, updated_at: note.updatedAt, deleted_at: null } };
  }
  create = (patch: Partial<StickyNote> = {}) => {
    const note = { ...newNote(this.snapshot.notes.length), ...patch, id: crypto.randomUUID() };
    this.queue(this.newEntry(note), note, true, true); return note.id;
  };
  change = (id: string, patch: Partial<StickyNote>,source?:string) => {
    if (this.discarding.has(id)) { this.emit({ error: 'Wait for this draft discard to finish before editing.' }); return; }
    const entry = this.snapshot.notes.find(row => row.note.id === id);
    if (!entry || entry.row.deleted_at || this.pending.get(id)?.blocked) return;
    const next = { ...entry.note, ...patch };
    next.x = clamp(next.x, 0, 3000); next.y = clamp(next.y, 0, 2000); next.width = clamp(next.width, 260, 900); next.height = clamp(next.height, 280, 900);
    const content = JSON.stringify(noteContent(next)) !== JSON.stringify(noteContent(entry.note)) || next.title !== entry.note.title || next.taskId !== entry.note.taskId;
    const layout = JSON.stringify(notePresentation(next)) !== JSON.stringify(notePresentation(entry.note));
    if (content && !['edit', 'manage'].includes(entry.permission)) return;
    if (!content && !layout) { this.emit({ notes: this.snapshot.notes.map(row => row.note.id === id ? { ...row, note: next } : row) }); return; }
    this.queue(entry, next, content, layout,undefined,source);
  };
  private queue(entry: ConnectedNote, note: StickyNote, content: boolean, layout: boolean,resumeToken?:string,source?:string) {
    const before = this.pending.get(note.id);
    const job: Pending = { note,source, baseRevision: before?.baseRevision ?? entry.row.revision, token: resumeToken??(this.inFlight.has(note.id) ? crypto.randomUUID() : before?.token ?? crypto.randomUUID()), content: content || !!before?.content, layout: layout || !!before?.layout, version: (before?.version ?? 0) + 1, firstEdit: before?.firstEdit ?? Date.now(), blocked: false, updatedAt: new Date().toISOString() };
    const raw=JSON.stringify(job);this.draftCache.set(this.key(note.id),raw);
    try { localStorage.setItem(this.key(note.id),raw); } catch { /* Commit the transactional outbox before acknowledging this draft. */ }
    this.pending.set(note.id, job);
    const notes = this.snapshot.notes.some(row => row.note.id === note.id) ? this.snapshot.notes.map(row => row.note.id === note.id ? { ...row, note } : row) : [...this.snapshot.notes, { ...entry, note }];
    this.emit({ notes, drafts: this.scanDrafts(), status: this.pendingStatus() });
    {
      const previous = this.durability.get(note.id) ?? Promise.resolve();
      const persisted = previous.catch(() => {}).then(() => writeNativeDraft(this.key(note.id), raw)).then(() => { if (this.pending.get(note.id) === job) {this.durableJobs.set(note.id,job);this.emit({ status: this.pendingStatus() });} }).catch(error => { job.localFailed = true; this.emit({ error: `${message(error)} The draft is retained for export.`, status: 'Local save failed.' }); throw error; });
      this.durability.set(note.id, persisted); void persisted.catch(() => {});
    }
    clearTimeout(this.timers.get(note.id));
    this.timers.set(note.id, setTimeout(() => { void this.flush(note.id); }, Math.max(0, Math.min(600, job.firstEdit + 3000 - Date.now()))));
  }
  async flush(id: string) {
    try { let durable = this.durability.get(id); while (durable) { await durable; const latest = this.durability.get(id); if (latest === durable) break; durable = latest; } } catch { return; }
    const job = this.pending.get(id);
    if (this.stopped || !job || job.blocked || job.localFailed || this.inFlight.has(id) || this.discarding.has(id)) return;
    this.inFlight.add(id); this.emit({ saving: true });
    const captured = { ...job, note: { ...job.note } },capturedRaw=this.rawDraft(this.key(id))!;
    try {
      const session = await requireSupabaseClient().auth.getSession();
      if (this.stopped || this.discarding.has(id) || session.data.session?.user.id !== this.user.id) return;
      const row = captured.content ? await saveConnectedNote(captured.note, this.workspaceId, captured.baseRevision, captured.token, this.user.id) : this.snapshot.notes.find(item => item.note.id === id)!.row;
      if (this.stopped) return;
      if(captured.content){
        this.ownCommittedTokens.set(id,{token:row.write_token,source:captured.source});
        const current=this.pending.get(id)!;current.baseRevision=row.revision;current.token=crypto.randomUUID();current.firstEdit=Date.now();
        if(current.version===captured.version)current.content=false;
        this.emit({notes:this.snapshot.notes.map(item=>item.note.id===id?{...item,row,note:{...current.note,revision:row.revision,writeToken:row.write_token,updatedAt:row.updated_at}}:item)});
        if(current.version!==captured.version){
          this.durableJobs.delete(id);const raw=JSON.stringify(current);this.draftCache.set(this.key(id),raw);try{localStorage.setItem(this.key(id),raw);}catch{/* The durable outbox is authoritative. */}
          const previous=this.durability.get(id)??Promise.resolve();const rebased=previous.catch(()=>{}).then(()=>writeNativeDraft(this.key(id),raw)).then(()=>{if(this.pending.get(id)===current){this.durableJobs.set(id,current);this.emit({status:this.pendingStatus()});}}).catch(error=>{current.localFailed=true;this.emit({error:message(error),status:'Local save failed.'});throw error;});this.durability.set(id,rebased);void rebased.catch(()=>{});
        }
      }
      if (captured.layout) await saveNoteLayout(captured.note, this.user.id);
      if (this.stopped) return;
      if(this.pending.get(id)?.version===captured.version){
        try{await retireNativeDraft(this.key(id),capturedRaw);}catch(error){if(this.pending.get(id)?.version===captured.version)throw error;}
      }
      const latest = this.pending.get(id)!;
      if (latest.version === captured.version) {
        this.pending.delete(id); this.durableJobs.delete(id); this.draftCache.delete(this.key(id)); this.removeMirror(this.key(id),capturedRaw);
      }
      this.emit({ notes: this.snapshot.notes.map(item => item.note.id === id ? { ...item, row, note: { ...(latest.version === captured.version ? captured.note : latest.note), revision: row.revision, writeToken: row.write_token, updatedAt: row.updated_at } } : item), error: this.pending.size ? this.snapshot.error : '', drafts: this.scanDrafts(), status: this.pendingStatus() });
      if (latest.version === captured.version) void this.retireRecoveredSources(id);
    } catch (error) {
      if (this.stopped) return;
      const code = (error as { code?: string }).code;
      if (code === 'PT409' || code === '42501') {
        this.pending.get(id)!.blocked = true;
        this.emit({ conflicts: [...new Set([...this.snapshot.conflicts, id])], error: `${message(error)} Your device draft is retained. Review the server version or save a separate copy.` });
        void this.refresh();
      } else {const status=this.pendingStatus();this.emit({ error: `${message(error)} Your draft is retained. Retry when connected.`, status: status==='Saved locally, awaiting synchronization.'?'Waiting to sync.':status });}
    } finally {
      this.inFlight.delete(id); this.emit({ saving: this.inFlight.size > 0 });
      const latest = this.pending.get(id);
      if (!this.stopped && latest && !latest.blocked && latest.version !== captured.version) void this.flush(id);
    }
  }
  retry = () => { for (const [id,job] of this.pending) { if(job.localFailed){job.localFailed=false;this.durableJobs.delete(id);const raw=JSON.stringify(job);this.draftCache.set(this.key(id),raw);try{localStorage.setItem(this.key(id),raw);}catch{/* Durable outbox remains authoritative. */}const persisted=writeNativeDraft(this.key(id),raw).then(()=>{if(this.pending.get(id)===job){job.localFailed=false;this.durableJobs.set(id,job);this.emit({error:'',status:this.pendingStatus()});}}).catch(error=>{job.localFailed=true;this.emit({error:message(error),status:'Local save failed.'});throw error;});this.durability.set(id,persisted);void persisted.then(()=>this.flush(id)).catch(()=>{});}else void this.flush(id); } };
  private removeMirror(key:string,expected:string){try{if(localStorage.getItem(key)===expected)localStorage.removeItem(key);}catch{/* Retain a non-authoritative mirror when it cannot be retired. */}}
  hasPending = (id: string) => this.pending.has(id);
  canRetryFrame=(id:string,expectedRevision:unknown,source?:string)=>{const entry=this.snapshot.notes.find(row=>row.note.id===id);const pending=this.pending.get(id),committed=this.ownCommittedTokens.get(id);return !!entry&&(!pending||pending.source===source)&&(entry.row.revision===expectedRevision||!!source&&committed?.source===source&&entry.row.write_token===committed.token);};
  isDiscarding = (id: string) => this.discarding.has(id);
  whenDurable = async(id:string)=>{let captured:Promise<void>|undefined;do{captured=this.durability.get(id);await captured;}while(this.durability.get(id)!==captured);return this.snapshot.notes.find(entry=>entry.note.id===id)?.note;};
  flushAll = async () => { await Promise.allSettled([...this.pending.keys()].map(id => this.flush(id))); };
  prepareToClose=async()=>{let captured:Promise<void>[];do{captured=[...this.durability.values()];await Promise.all(captured);}while([...this.durability.values()].some(promise=>!captured.includes(promise)));};
  recover = (key: string, asCopy: boolean) => { if(asCopy){void this.recoverCopy(key);return;}
    const stored = this.scanDrafts().find(row => row.key === key); if (!stored) return;
    const original = this.rawDraft(key);
    const destinationId = stored.draft.note.id;
    if(this.pending.has(destinationId)){this.emit({error:'Retry or export the current edit before resuming another retained draft.'});return;}
    {
      const entry = this.snapshot.notes.find(row => row.note.id === stored.draft.note.id);
      const committed=entry&&entry.row.write_token===stored.draft.token&&entry.note.title===stored.draft.note.title&&JSON.stringify(noteContent(entry.note))===JSON.stringify(noteContent(stored.draft.note));
      if(committed&&(!stored.draft.layout||JSON.stringify(notePresentation(entry.note))===JSON.stringify(notePresentation(stored.draft.note)))){void this.retireConfirmedDraft(key,original!);return;}
      const content=stored.draft.content&&!committed;
      if (!entry||entry.row.deleted_at||!committed&&entry.row.revision !== stored.draft.baseRevision || content&&!['edit', 'manage'].includes(entry.permission)) { this.emit({ error: 'The server version changed or access is unavailable. Save a separate copy to preserve this draft.' }); return; }
      this.queue(entry, stored.draft.note, content, stored.draft.layout,stored.draft.token);
    }
    if (original && this.pending.has(destinationId)) {
      const sources = this.recoveredSources.get(destinationId) ?? new Map<string, string>();
      sources.set(key, original); this.recoveredSources.set(destinationId, sources);
    }
  };
  private async retireConfirmedDraft(key:string,original:string){try{await retireNativeDraft(key,original);if(this.stopped)return;if(this.rawDraft(key)===original){this.draftCache.delete(key);this.removeMirror(key,original);}this.emit({drafts:this.scanDrafts(),status:'The original change was already saved. Its confirmed recovery draft was retired.'});}catch(error){this.emit({error:message(error),drafts:this.scanDrafts()});}}
  private async recoverCopy(key:string){
    const stored=this.scanDrafts().find(item=>item.key===key),original=this.rawDraft(key);if(!stored||!original)return;
    try{
      const [{copyNote,transferIdentity},{connectedNoteMedia}]=await Promise.all([import('./note-transfer'),import('./connected-note-media')]);
      const importKey=`recovery:${await transferIdentity(key+original)}`,id=await transferIdentity(importKey),createdToken=await transferIdentity(importKey+':create');
      await copyNote({...stored.draft.note,title:`${stored.draft.note.title||'Untitled'} (recovered copy)`.slice(0,160)},connectedNoteMedia(this.user.id,stored.draft.note.id,async()=>{}),{
        key:`${this.user.id}:${this.workspaceId??'personal'}`,
        create:async(note,importKey)=>{const row=await saveConnectedNote({...note,id},this.workspaceId,0,createdToken,this.user.id,importKey),content=row.content as {html?:string;checklist?:StickyNote['checklist']};return{...note,id:row.id,revision:row.revision,writeToken:row.write_token,title:row.title,html:content.html??'',checklist:content.checklist??[]};},
        save:async(note,revision)=>{await saveConnectedNote(note,this.workspaceId,revision,await transferIdentity(importKey+':content'),this.user.id);},
        media:noteId=>connectedNoteMedia(this.user.id,noteId,async()=>{}),
      },importKey,{clearTaskLinks:true,omitUnavailableImages:false});
      if(this.stopped)return;if(this.rawDraft(key)===original){await retireNativeDraft(key,original);if(this.rawDraft(key)===original){this.draftCache.delete(key);this.removeMirror(key,original);}}
      await this.refresh();this.emit({drafts:this.scanDrafts(),status:'Recovered copy saved. The original note was retained.'});
    }catch(error){this.emit({error:`${message(error)} The original recovery draft is retained. Export it before changing any unavailable images.`,drafts:this.scanDrafts()});}
  }
  private async retireRecoveredSources(id:string) {
    const sources=this.recoveredSources.get(id);if(!sources)return;
    try { for(const[source,original]of sources){if(this.rawDraft(source)!==original)continue;await retireNativeDraft(source,original);if(this.rawDraft(source)===original){this.draftCache.delete(source);this.removeMirror(source,original);};if(sources.get(source)===original)sources.delete(source);}if(!sources.size)this.recoveredSources.delete(id);this.emit({drafts:this.scanDrafts()}); }
    catch{this.emit({error:'The note synced, but a recovery journal could not be retired. Its device draft is retained for retry.',drafts:this.scanDrafts()});}
  }
  discardDraft = async (key: string) => {
    if (!key.startsWith(this.prefix)) return false;
    const draft = this.scanDrafts().find(item => item.key === key)?.draft;
    const original=this.rawDraft(key);if(!draft||!original)return false;
    if (draft && key === this.key(draft.note.id)) {
      if (this.inFlight.has(draft.note.id)) { this.emit({ error: 'Wait for the current request to finish before discarding this draft.' }); return false; }
      clearTimeout(this.timers.get(draft.note.id)); this.discarding.add(draft.note.id); this.emit({saving:true});
    }
    try {
      await this.durability.get(draft.note.id); await retireNativeDraft(key,original);
      if(this.rawDraft(key)!==original){this.emit({error:'This device draft changed. Review its current version before discarding it.'});return false;}
      if(key===this.key(draft.note.id)){this.pending.delete(draft.note.id);this.durableJobs.delete(draft.note.id);}
      this.draftCache.delete(key);this.removeMirror(key,original);this.emit({drafts:this.scanDrafts(),conflicts:this.snapshot.conflicts.filter(id=>id!==draft.note.id)});void this.refresh();return true;
    }catch(error){this.emit({error:`${message(error)} The device draft was not discarded.`,drafts:this.scanDrafts()});return false;}
    finally{this.discarding.delete(draft.note.id);this.emit({saving:this.inFlight.size>0});}
  };
}
const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
const message = (error: unknown) => error instanceof Error ? error.message : 'Notes could not connect.';
