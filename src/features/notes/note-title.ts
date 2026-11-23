import type { StickyNote } from './notes-store';
import { notePreviewText } from './notes-manager-model';

const TITLE_LIMIT = 160;
/** The first line of the body, which names a note that was never given a title of its own. */
export const firstNoteLine = (html: string) => (notePreviewText(html).split('\n')[0] ?? '').slice(0, TITLE_LIMIT).trim();
/** True while the title is only the first line (or nothing), so no title field is needed. */
export const hasAutomaticTitle = (note: Pick<StickyNote, 'title' | 'html'>) => !note.title.trim() || note.title === firstNoteLine(note.html);
/** A body edit. The title follows the first line until someone writes a title of their own. */
export const bodyPatch = (note: Pick<StickyNote, 'title' | 'html'>, html: string): Partial<StickyNote> =>
  hasAutomaticTitle(note) && firstNoteLine(html) !== note.title ? { html, title: firstNoteLine(html) } : { html };
