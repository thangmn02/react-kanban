import { Extension, InputRule } from '@tiptap/react';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { notePreviewText } from './notes-manager-model';

/**
 * Typing `[ ] ` or `[x] ` at the start of a bullet line turns that line into a
 * checklist item instead of nesting a checklist inside the bullet, so `- [ ] `
 * starts a checklist the way it does in Markdown editors. On a checklist line,
 * `[x] ` ticks it rather than nesting another checklist.
 */
const BulletToChecklist = Extension.create({
  name: 'koraBulletToChecklist',
  priority: 1000,
  addInputRules() {
    return [new InputRule({
      find: /^\s*\[( |x|X)?\]\s$/,
      handler: ({ state, range, match, chain }) => {
        const { $from } = state.selection;
        const item = $from.depth >= 2 ? $from.node(-1).type.name : '';
        if ((item !== 'listItem' && item !== 'taskItem') || $from.index(-1) !== 0) return null;
        const checked = /x/i.test(match[1] || '');
        // Already a checklist line: `[x] ` ticks it and `[ ] ` leaves it open.
        if (item === 'taskItem') chain().deleteRange(range).updateAttributes('taskItem', { checked }).run();
        else chain().deleteRange(range).liftListItem('listItem').toggleTaskList().updateAttributes('taskItem', { checked }).run();
      },
    })];
  },
});

/**
 * Checklist lines inside the note body: Enter continues, Enter on an empty item ends, Tab and Shift+Tab indent.
 * Each checkbox is named by its own line (not its nested lines), or `emptyLabel` when the line is blank.
 */
export function noteListExtensions(emptyLabel = '') {
  return [
    TaskList,
    TaskItem.configure({ nested: true, a11y: { checkboxLabel: node => node.firstChild?.textContent || emptyLabel } }),
    BulletToChecklist,
  ];
}

/** Tailwind utilities for checklist lines in the editor (its node view marks items with data-checked only; bullets off, checkbox beside the text, ticked lines struck). */
export const noteChecklistClasses = '[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_ul[data-type=taskList]]:pl-5 [&_li[data-checked]]:flex [&_li[data-checked]]:items-start [&_li[data-checked]]:gap-2 [&_li[data-checked]>label]:mt-1 [&_li[data-checked]>div]:min-w-0 [&_li[data-checked]>div]:flex-1 [&_li[data-checked]_p]:mb-0 [&_li[data-checked=true]>div>p]:line-through [&_li[data-checked=true]>div>p]:opacity-60';

/** A card line: plain text, a bullet or numbered line (`marker`, `depth`), or a checklist line that can be ticked by index. */
export type NotePreviewLine = { text: string; marker?: string; depth?: number; task?: { index: number; checked: boolean; depth: number } };

const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'PRE', 'BLOCKQUOTE', 'TR']);
const isTaskItem = (element: Element) => element.tagName === 'LI' && element.getAttribute('data-type') === 'taskItem';

/** The note body as card lines in document order: plain text lines, and checklist lines that can be ticked by index. */
export function notePreviewLines(html: string): NotePreviewLine[] {
  if (!html || typeof DOMParser === 'undefined') return notePreviewText(html).split('\n').filter(Boolean).map(text => ({ text }));
  const body = new DOMParser().parseFromString(html, 'text/html').body, lines: NotePreviewLine[] = [];
  let index = 0;
  const walk = (node: Element, depth: number) => {
    for (const child of [...node.children]) {
      if (isTaskItem(child)) {
        const own = [...child.children].flatMap(part => part.tagName === 'DIV' ? [...part.children] : [part]).filter(part => !/^(UL|OL|LABEL)$/.test(part.tagName));
        const text = own.map(part => notePreviewText(part.outerHTML).replace(/\n/g, ' ')).join(' ').trim();
        lines.push({ text, task: { index: index++, checked: child.getAttribute('data-checked') === 'true', depth } });
        for (const list of child.querySelectorAll(':scope > div > ul, :scope > div > ol, :scope > ul, :scope > ol')) walk(list, depth + 1);
      } else if (child.tagName === 'LI') {
        const list = child.parentElement!, ordered = list.tagName === 'OL';
        const position = [...list.children].filter(item => item.tagName === 'LI').indexOf(child);
        const marker = ordered ? `${(Number(list.getAttribute('start')) || 1) + position}.` : '•';
        const own = [...child.children].filter(part => !/^(UL|OL)$/.test(part.tagName));
        const text = (own.length ? own.map(part => notePreviewText(part.outerHTML).replace(/\n/g, ' ')).join(' ') : notePreviewText(child.innerHTML)).trim();
        lines.push({ text, marker, depth });
        for (const nested of child.querySelectorAll(':scope > ul, :scope > ol')) walk(nested, depth + 1);
      } else if (BLOCKS.has(child.tagName) && !child.querySelector('li[data-type="taskItem"]')) {
        for (const text of notePreviewText(child.outerHTML).split('\n')) if (text) lines.push({ text });
      } else walk(child, depth);
    }
  };
  walk(body, 0);
  return lines;
}

/** Ticks or unticks one checklist line of the note body (by its document-order index) and returns the new HTML. */
export function setNoteTaskItem(html: string, index: number, checked: boolean): string {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const item = body.querySelectorAll('li[data-type="taskItem"]')[index];
  if (!item) return html;
  item.setAttribute('data-checked', String(checked));
  const box = item.querySelector(':scope > label > input[type="checkbox"]');
  if (box) { if (checked) box.setAttribute('checked', 'checked'); else box.removeAttribute('checked'); }
  return body.innerHTML;
}
