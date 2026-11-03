import { useRef, useState } from 'react';
import { useDialogFocus } from '../../../hooks/use-dialog-focus';
import { useI18n } from '../../../i18n';

interface QuickTaskEntryProps {
  isOpen: boolean;
  onClose: () => void;
  /** Enter: save a task due today with just this title. Resolves false when it could not be saved. */
  onSave: (title: string) => Promise<boolean>;
  /** Shift+Enter: open the full task form with this title. */
  onMore: (title: string) => void;
}

/** One line is enough to capture a task; details can be added later from the task itself. */
export default function QuickTaskEntry({ isOpen, onClose, onSave, onMore }: QuickTaskEntryProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLElement | null>(null);
  const close = () => { if (!saving) { setTitle(''); onClose(); } };
  useDialogFocus(isOpen, dialog, close);
  if (!isOpen) return null;
  const save = async () => {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    try { if (await onSave(value)) { setTitle(''); onClose(); } } finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[78] flex items-start justify-center bg-slate-950/20 px-3 pt-[18vh]" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="quick-task-title" tabIndex={-1}
      className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <h2 id="quick-task-title" className="sr-only">{t('quickTask.title')}</h2>
      <input type="text" autoFocus value={title} maxLength={500} disabled={saving} aria-label={t('quickTask.title')} placeholder={t('quickTask.placeholder')}
        onChange={event => setTitle(event.target.value)}
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (event.shiftKey) { const value = title.trim(); setTitle(''); onMore(value); return; }
          void save();
        }}
        className="min-h-11 w-full rounded-xl border-0 px-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none" />
      <p className="px-3 pb-1 pt-2 text-xs text-slate-500">{t('quickTask.hint')}</p>
    </section>
  </div>;
}
