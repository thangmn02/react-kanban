import { act, cleanup, render as renderBare, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from '../../i18n';
import {afterEach,expect,it,vi} from 'vitest';
import MiniEditor from './mini-editor';
const render = (ui: ReactElement) => renderBare(ui, { wrapper: I18nProvider });

afterEach(cleanup);
it('does not save content when mounting or changing editing permission',async()=>{
  const change=vi.fn();const view=render(<MiniEditor html="<p>Existing original</p>" compact={false} onChange={change}/>);
  await screen.findByRole('textbox',{name:'Note content'});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect(change).not.toHaveBeenCalled();
  view.rerender(<MiniEditor html="<p>Existing original</p>" compact={false} readOnly onChange={change}/>);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox',{name:'Note content'})).toHaveAttribute('contenteditable','false');
});

it('keeps the caret when the same note is reloaded from outside while typing',async()=>{
  const change=vi.fn();const view=render(<MiniEditor html="<p>first line</p><p>second line</p>" compact={false} onChange={change}/>);
  const box=await screen.findByRole('textbox',{name:'Note content'});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  const editor=(box as HTMLElement & {editor?:import('@tiptap/react').Editor}).editor!;
  act(()=>{editor.commands.setTextSelection(24);});const caret=editor.state.selection.from;
  view.rerender(<MiniEditor html="<p>first line</p><p>second line!</p>" compact={false} onChange={change}/>);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect(editor.getText()).toContain('second line!');expect(editor.state.selection.from).toBe(caret);
});

it('never lets an older copy that arrives after typing erase the typed text',async()=>{
  const change=vi.fn();const view=render(<MiniEditor html="" compact={false} onChange={change}/>);
  const box=await screen.findByRole('textbox',{name:'Note content'});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  const editor=(box as HTMLElement & {editor?:import('@tiptap/react').Editor}).editor!;
  act(()=>{editor.commands.insertContent('Call the printer');});
  const typed=change.mock.calls.at(-1)![0] as string;expect(typed).toContain('Call the printer');
  // The new note's first save comes back late with the empty body.
  view.rerender(<MiniEditor html="<p></p>" compact={false} onChange={change}/>);await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect(editor.getText()).toBe('Call the printer');
  // Once the typed text is saved and echoed, later outside changes load again.
  view.rerender(<MiniEditor html={typed} compact={false} onChange={change}/>);await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  view.rerender(<MiniEditor html="<p>Changed in another window</p>" compact={false} onChange={change}/>);await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect(editor.getText()).toBe('Changed in another window');
});
