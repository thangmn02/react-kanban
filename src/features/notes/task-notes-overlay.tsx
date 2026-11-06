import { useRef } from 'react';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import ConnectedNotesWorkspace, { type ConnectedNotesWorkspaceProps } from './connected-notes-workspace';
import { useI18n } from '../../i18n';

export default function TaskNotesOverlay({ onClose, ...props }: ConnectedNotesWorkspaceProps & { onClose: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLElement | null>(null);
  useDialogFocus(true, dialog, onClose);
  return <section ref={dialog} role="dialog" aria-modal="true" aria-label={t('task.taskNotes')} className="fixed inset-0 z-[65] overflow-auto bg-white">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3"><p className="text-sm text-slate-600">{t('notes.yourTaskDraftAndPageStay')}</p><button type="button" className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold" onClick={onClose}>{t('notes.returnToTask')}</button></header>
    <ConnectedNotesWorkspace {...props} />
  </section>;
}
