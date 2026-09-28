import { useEffect, useId, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { CreateBriefingPinInput, BriefingPinSourceType } from '../../types/briefing.type';
import type { AppUser } from '../../types/auth.type';
import type { HomeTaskSummary } from '../../services/home.service';
import { useI18n } from '../../i18n';

interface BriefingPinFormProps {
  isOpen: boolean;
  workspaceId: string;
  currentUser: AppUser;
  tasks: HomeTaskSummary[];
  onClose: () => void;
  onSubmit: (input: CreateBriefingPinInput) => Promise<void>;
}

function buildTaskReason(task: HomeTaskSummary, t: ReturnType<typeof useI18n>['t']) {
  if (task.dueDate) {
    const offset = differenceInCalendarDays(parseISO(task.dueDate), new Date());
    if (offset < 0) return t('briefing.pin.reason.overdue', { title: task.title });
    if (offset === 0) return t('briefing.pin.reason.today', { title: task.title });
    if (offset === 1) return t('briefing.pin.reason.tomorrow', { title: task.title });
  }
  if (task.priority === 'High') return t('briefing.pin.reason.highPriority', { title: task.title });
  return t('briefing.pin.reason.default', { title: task.title });
}

export default function BriefingPinForm({
  isOpen,
  workspaceId,
  currentUser,
  tasks,
  onClose,
  onSubmit,
}: BriefingPinFormProps) {
  const { t } = useI18n();
  const titleId = useId();
  const [quotedText, setQuotedText] = useState('');
  const [sourceType, setSourceType] = useState<BriefingPinSourceType>('note');
  const [sourceLabel, setSourceLabel] = useState('');
  const [authorName, setAuthorName] = useState(currentUser.name);
  const [linkUrl, setLinkUrl] = useState('');
  const [taskId, setTaskId] = useState('');
  const [whyMatters, setWhyMatters] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setAuthorName(currentUser.name);
  }, [currentUser.name, isOpen]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setQuotedText('');
    setSourceType('note');
    setSourceLabel('');
    setAuthorName(currentUser.name);
    setLinkUrl('');
    setTaskId('');
    setWhyMatters('');
    setError(null);
    onClose();
  };
  const canSubmit = quotedText.trim().length > 0
    && sourceLabel.trim().length > 0
    && authorName.trim().length > 0
    && whyMatters.trim().length > 0
    && !isSaving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        workspaceId,
        createdBy: currentUser.id,
        sourceType,
        sourceLabel: sourceLabel.trim(),
        authorName: authorName.trim(),
        quotedText: quotedText.trim(),
        linkUrl: linkUrl.trim() || null,
        taskId: taskId || null,
        whyMatters: whyMatters.trim(),
      });
      resetAndClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('briefing.pin.createError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <button type="button" aria-label={t('common.close')} className="fixed inset-0 cursor-default bg-slate-950/45" onClick={resetAndClose} />
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <form onSubmit={(event) => void handleSubmit(event)} className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6" aria-labelledby={titleId}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">{t('briefing.pin.eyebrow')}</p><h2 id={titleId} className="mt-1 text-2xl font-semibold text-slate-950">{t('briefing.pin.formTitle')}</h2></div>
            <button type="button" onClick={resetAndClose} className="cursor-pointer rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label={t('common.close')}>×</button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">{t('briefing.pin.quoteLabel')}<textarea autoFocus required maxLength={500} rows={4} value={quotedText} onChange={(event) => setQuotedText(event.target.value)} placeholder={t('briefing.pin.quotePlaceholder')} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400" /></label>
            <label className="text-sm font-semibold text-slate-700">{t('briefing.pin.sourceTypeLabel')}<select value={sourceType} onChange={(event) => setSourceType(event.target.value as BriefingPinSourceType)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-blue-400"><option value="note">{t('briefing.pin.source.note')}</option><option value="email">{t('briefing.pin.source.email')}</option><option value="chat">{t('briefing.pin.source.chat')}</option><option value="meeting">{t('briefing.pin.source.meeting')}</option></select></label>
            <label className="text-sm font-semibold text-slate-700">{t('briefing.pin.sourceLabel')}<input required value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder={t('briefing.pin.sourcePlaceholder')} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400" /></label>
            <label className="text-sm font-semibold text-slate-700">{t('briefing.pin.authorLabel')}<input required value={authorName} onChange={(event) => setAuthorName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400" /></label>
            <label className="text-sm font-semibold text-slate-700">{t('briefing.pin.linkLabel')}<input type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400" /></label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">{t('briefing.pin.taskLabel')}<select value={taskId} onChange={(event) => { const nextId = event.target.value; setTaskId(nextId); const task = tasks.find((item) => item.id === nextId); if (task) setWhyMatters(buildTaskReason(task, t)); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-normal outline-none focus:border-blue-400"><option value="">{t('briefing.pin.noTask')}</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">{t('briefing.pin.whyLabel')}<textarea required maxLength={300} rows={3} value={whyMatters} onChange={(event) => setWhyMatters(event.target.value)} placeholder={t('briefing.pin.whyPlaceholder')} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-400" /></label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={resetAndClose} className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">{t('common.cancel')}</button><button type="submit" disabled={!canSubmit} className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? t('briefing.pin.saving') : t('briefing.pin.pinAction')}</button></div>
        </form>
      </div>
    </div>
  );
}
