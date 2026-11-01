import { useState } from 'react';
import { dismissNotice, noticeDismissed } from './update-notices';

export interface UpdateNoticeItem { key: string; message: string; action: string; onAction: () => void }

/** One quiet note at a time: Update acts, Later hides that version's note (the badge stays). */
export default function UpdateNotice({ items, laterLabel }: { items: UpdateNoticeItem[]; laterLabel: string }) {
  const [, setDismissed] = useState(0);
  const item = items.find(candidate => !noticeDismissed(candidate.key));
  if (!item) return null;
  return <div role="status" className="flex items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-700">
    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-blue-500"/>
    <span className="min-w-0 flex-1 truncate">{item.message}</span>
    <button type="button" className="min-h-7 rounded-md bg-blue-600 px-2.5 font-semibold text-white hover:bg-blue-700" onClick={item.onAction}>{item.action}</button>
    <button type="button" className="min-h-7 rounded-md px-2 text-slate-500 hover:bg-slate-100" onClick={() => { dismissNotice(item.key); setDismissed(value => value + 1); }}>{laterLabel}</button>
  </div>;
}
