import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { noteListExtensions, notePreviewLines, setNoteTaskItem } from './note-editor-lists';

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

function create(content: string) {
  editor = new Editor({ element: document.createElement('div'), extensions: [StarterKit, ...noteListExtensions()], content });
  editor.commands.focus('end');
  return editor;
}
/** Types text the way a keyboard does, so input rules run. */
function type(target: Editor, text: string) {
  for (const char of text) {
    const { from, to } = target.state.selection;
    const handled = target.view.someProp('handleTextInput', handler => handler(target.view, from, to, char, () => target.state.tr.insertText(char, from, to)));
    if (!handled) target.view.dispatch(target.state.tr.insertText(char, from, to));
  }
}
const press = (target: Editor, key: string) => target.commands.keyboardShortcut(key);
const items = (target: Editor) => notePreviewLines(target.getHTML()).filter(line => line.task).map(line => `${line.task!.checked ? 'x' : ' '} ${line.text}`);

describe('note editor lists', () => {
  it('starts a checklist from "- [ ] " and "[x] ", and continues it on Enter', () => {
    const target = create('<p></p>');
    type(target, '- [ ] milk');
    expect(target.getHTML()).toContain('data-type="taskList"');
    expect(target.getHTML()).not.toContain('<ul><li><p>');
    press(target, 'Enter');
    type(target, '[x] eggs');
    expect(items(target)).toEqual(['  milk', 'x eggs']);
    press(target, 'Enter');
    type(target, 'bread');
    expect(items(target)).toEqual(['  milk', 'x eggs', '  bread']);
  });

  it('ends a list when Enter is pressed on an empty item', () => {
    for (const start of ['- ', '1. ', '[ ] ']) {
      const target = create('<p></p>');
      type(target, `${start}one`);
      press(target, 'Enter');
      press(target, 'Enter');
      type(target, 'after');
      const html = target.getHTML();
      expect(html, start).toMatch(/<\/(ul|ol)><p>after<\/p>(<p><\/p>)?$/);
      editor?.destroy(); editor = null;
    }
  });

  it('indents and outdents with Tab and Shift+Tab', () => {
    for (const start of ['- ', '1. ', '[ ] ']) {
      const target = create('<p></p>');
      type(target, `${start}one`);
      press(target, 'Enter');
      type(target, 'two');
      press(target, 'Tab');
      expect(target.view.dom.querySelectorAll('li li').length, start).toBe(1);
      press(target, 'Shift-Tab');
      expect(target.view.dom.querySelectorAll('li li').length, start).toBe(0);
      editor?.destroy(); editor = null;
    }
  });

  it('turns selected lines into a checklist with one action', () => {
    const target = create('<p>milk</p><p>eggs</p><p>bread</p>');
    target.commands.selectAll();
    target.commands.toggleTaskList();
    expect(items(target)).toEqual(['  milk', '  eggs', '  bread']);
  });

  it('keeps bullet and number markers on card lines', () => {
    expect(notePreviewLines('<ul><li><p>one</p><ul><li><p>inner</p></li></ul></li><li><p>two</p></li></ul><ol start="3"><li><p>third</p></li><li><p>fourth</p></li></ol>')).toEqual([
      { text: 'one', marker: '•', depth: 0 }, { text: 'inner', marker: '•', depth: 1 }, { text: 'two', marker: '•', depth: 0 },
      { text: 'third', marker: '3.', depth: 0 }, { text: 'fourth', marker: '4.', depth: 0 },
    ]);
  });

  it('lists card lines in order and ticks a checklist line by index', () => {
    const html = '<p>Shopping</p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>milk</p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>oat</p></div></li></ul></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>eggs</p></div></li></ul><p>Thanks</p>';
    expect(notePreviewLines(html)).toEqual([
      { text: 'Shopping' },
      { text: 'milk', task: { index: 0, checked: false, depth: 0 } },
      { text: 'oat', task: { index: 1, checked: true, depth: 1 } },
      { text: 'eggs', task: { index: 2, checked: false, depth: 0 } },
      { text: 'Thanks' },
    ]);
    const ticked = setNoteTaskItem(html, 2, true);
    expect(notePreviewLines(ticked)[3].task?.checked).toBe(true);
    expect(setNoteTaskItem(ticked, 1, false)).toContain('data-checked="false"><label><input type="checkbox"><span></span></label><div><p>oat');
    expect(setNoteTaskItem(html, 9, true)).toBe(html);
    // The editor reads the ticked state back from the stored HTML.
    const target = create(ticked);
    expect(items(target)).toEqual(['  milk', 'x oat', 'x eggs']);
  });
});
