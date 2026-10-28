import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import MiniEditor from './mini-editor';

afterEach(cleanup);
it('does not save content when mounting or changing editing permission',async()=>{
  const change=vi.fn();const view=render(<MiniEditor html="<p>Existing original</p>" compact={false} onChange={change}/>);
  await screen.findByRole('textbox',{name:'Note content'});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  expect(change).not.toHaveBeenCalled();
  view.rerender(<MiniEditor html="<p>Existing original</p>" compact={false} readOnly onChange={change}/>);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox',{name:'Note content'})).toHaveAttribute('contenteditable','false');
});
