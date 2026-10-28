import { describe,expect,it,vi } from 'vitest';
import { copyNote,parseNotesBundle,transferIdentity,type NoteDestination } from './note-transfer';
import {newNote} from './notes-store';
import type {NoteMedia} from './note-media';

describe('portable Notes validation',()=>{
  const note=()=>({id:crypto.randomUUID(),title:'Private note',html:'<p>Saved <strong>formatting</strong></p>',checklist:[],taskId:null,taskBoardId:null,images:[]});
  const bundle=(notes:unknown[])=>JSON.stringify({format:'kora-notes',version:1,id:crypto.randomUUID(),exportedAt:new Date().toISOString(),notes});
  it('preserves formatting and rejects executable pasted content',()=>{expect(parseNotesBundle(bundle([{...note(),html:'<p>Text</p><script>bad()</script><img src="https://foreign.test/tracker">'}])).notes[0].html).toBe('<p>Text</p>');});
  it('rejects duplicate identities and malformed checklists before importing anything',()=>{const original=note();expect(()=>parseNotesBundle(bundle([original,original]))).toThrow('invalid');expect(()=>parseNotesBundle(bundle([{...original,checklist:[{id:'a',text:'x',isDone:'yes'}]}]))).toThrow('checklist');});
  it('uses stable operation identities without conflating destinations',async()=>{expect(await transferIdentity('destination-a:source:image')).toBe(await transferIdentity('destination-a:source:image'));expect(await transferIdentity('destination-b:source:image')).not.toBe(await transferIdentity('destination-a:source:image'));});
  it('preserves device presentation and retries unfinished layout without rewriting imported content',async()=>{
    const source={...newNote(),title:'Device original',html:'<p>Original formatting</p>',pinned:true,x:77,width:530};
    let stored:ReturnType<typeof newNote>|undefined;const complete=vi.fn().mockRejectedValueOnce(Error('Layout interrupted')).mockResolvedValue(undefined),save=vi.fn(async note=>{stored={...note,revision:2};});
    const media={download:vi.fn(),upload:vi.fn(),subscribe:()=>()=>{}} as NoteMedia;
    const destination:NoteDestination={key:'account:workspace',create:async candidate=>({...candidate,...stored,id:'imported-id',revision:stored?.revision??1}),save,complete,media:()=>media};
    await expect(copyNote(source,media,destination,'stable-import',{clearTaskLinks:false,omitUnavailableImages:false})).rejects.toThrow('Layout interrupted');
    expect(stored).toMatchObject({pinned:true,x:77,width:530,html:'<p>Original formatting</p>'});
    stored={...stored!,title:'Later remote edit'};
    const retried=await copyNote(source,media,destination,'stable-import',{clearTaskLinks:false,omitUnavailableImages:false});
    expect(retried.existing).toBe(true);expect(retried.note.title).toBe('Later remote edit');expect(save).toHaveBeenCalledTimes(1);expect(complete).toHaveBeenCalledTimes(2);
  });
});
