import { useRef } from 'react';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import ConnectedNotesWorkspace, { type ConnectedNotesWorkspaceProps } from './connected-notes-workspace';

export default function TaskNotesOverlay({ onClose, ...props }: ConnectedNotesWorkspaceProps & { onClose: () => void }) {
  const dialog = useRef<HTMLElement | null>(null);
  useDialogFocus(true, dialog, onClose);
  return <section ref={dialog} role="dialog" aria-modal="true" aria-label="Task notes" className="fixed inset-0 z-[65] overflow-auto bg-white">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3"><p className="text-sm text-slate-600">Your task draft and page stay open underneath.</p><button type="button" className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold" onClick={onClose}>Return to task</button></header>
    <ConnectedNotesWorkspace {...props} />
  </section>;
}
