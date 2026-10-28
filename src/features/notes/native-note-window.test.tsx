import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import NativeNoteWindow from './native-note-window';
import {newNote} from './notes-store';
import type {NativeNoteSnapshot} from './native-note-bridge';

const mocks=vi.hoisted(()=>({request:vi.fn(),events:new Map<string,(event:{payload:unknown})=>void>()}));
vi.mock('@tauri-apps/api/event',()=>({listen:async(name:string,handler:(event:{payload:unknown})=>void)=>{mocks.events.set(name,handler);return()=>mocks.events.delete(name);}}));
vi.mock('./native-note-bridge',()=>({nativeNoteRequest:mocks.request}));
vi.mock('./mini-editor',()=>({default:({html,readOnly,onChange}:{html:string;readOnly:boolean;onChange:(value:string)=>void})=><textarea aria-label="Note content" value={html} readOnly={readOnly} onChange={event=>onChange(event.target.value)}/>}));
vi.mock('./note-appearance',()=>({default:()=>null}));
let snapshot:NativeNoteSnapshot;
beforeEach(()=>{
  mocks.events.clear();mocks.request.mockReset();snapshot={note:newNote(),readOnly:false,status:'Saved locally on this device.',error:'',conflict:false};
  mocks.request.mockImplementation(async(action:string)=>{
    if(action==='context')return{writerId:'frame-writer',context:{},alwaysOnTop:true,opacity:0.96,collapsed:false,ghost:false,peek:false};
    if(action==='read'){queueMicrotask(()=>mocks.events.get('kora-note-reply')?.({payload:{nonce:'read',result:snapshot,error:null}}));return{nonce:'read'};}
    return null;
  });
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
const ready=async()=>{render(<NativeNoteWindow/>);await screen.findByLabelText('Note title');};
it('freezes the frame before close acknowledgement and unfreezes after cancellation',async()=>{
  await ready();await act(async()=>{mocks.events.get('kora-note-prepare-close')!({payload:{nonce:'close-a'}});});
  expect(screen.getByLabelText('Note title')).toHaveAttribute('readonly');expect(screen.getByLabelText('Note content')).toHaveAttribute('readonly');
  expect(mocks.request).toHaveBeenCalledWith('close_ready',{nonce:'close-a',writerId:'frame-writer'});
  fireEvent.change(screen.getByLabelText('Note title'),{target:{value:'Cannot start a new edit during close'}});
  expect(mocks.request.mock.calls.some(([action])=>action==='change'||action==='edit_state')).toBe(false);
  await act(async()=>{mocks.events.get('kora-note-close-cancel')!({payload:null});});
  expect(screen.getByLabelText('Note title')).not.toHaveAttribute('readonly');
});
it('refuses close acknowledgement when the dirty marker IPC failed and retains the visible draft',async()=>{
  await ready();mocks.request.mockRejectedValueOnce(Error('Native IPC interrupted'));
  fireEvent.change(screen.getByLabelText('Note title'),{target:{value:'Retained unacknowledged title'}});
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Native IPC interrupted'));
  await act(async()=>{mocks.events.get('kora-note-prepare-close')!({payload:{nonce:'close-b'}});});
  expect(mocks.request.mock.calls.some(([action])=>action==='close_ready')).toBe(false);
  expect(screen.getByLabelText('Note title')).toHaveValue('Retained unacknowledged title');expect(screen.getByRole('button',{name:'Export retained draft'})).toBeVisible();
});
it('waits for an opening frame to finish its first durable read before acknowledging close',async()=>{
  const normal=mocks.request.getMockImplementation()!;mocks.request.mockImplementation(async(action:string,...args)=>action==='read'?{nonce:'held-read'}:normal(action,...args));
  render(<NativeNoteWindow/>);await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith('read',{}));
  await act(async()=>{mocks.events.get('kora-note-prepare-close')!({payload:{nonce:'opening-close'}});});
  await act(async()=>{mocks.events.get('kora-note-reply')!({payload:{nonce:'held-read',result:snapshot,error:null}});});
  await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith('close_ready',{nonce:'opening-close',writerId:'frame-writer'}));
  expect(screen.getByLabelText('Note title')).toHaveAttribute('readonly');
});
it('recovers a close request that preceded registration through its initial context',async()=>{
  const normal=mocks.request.getMockImplementation()!;mocks.request.mockImplementation(async(action:string,...args)=>action==='context'?{...await normal(action,...args),closeNonce:'before-listening'}:normal(action,...args));
  await ready();await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith('close_ready',{nonce:'before-listening',writerId:'frame-writer'}));
  expect(screen.getByLabelText('Note title')).toHaveAttribute('readonly');
});
it('does not revive a canceled close from a delayed initial context response',async()=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});const normal=mocks.request.getMockImplementation()!;
  mocks.request.mockImplementation(async(action:string,...args)=>{if(action==='context'){await held;return{...await normal(action,...args),closeNonce:'canceled-before-context'};}return normal(action,...args);});
  render(<NativeNoteWindow/>);await waitFor(()=>expect(mocks.request).toHaveBeenCalledWith('context'));
  await act(async()=>{mocks.events.get('kora-note-close-cancel')!({payload:null});release();});
  expect(await screen.findByLabelText('Note title')).not.toHaveAttribute('readonly');expect(mocks.request.mock.calls.some(([action])=>action==='close_ready')).toBe(false);
});
