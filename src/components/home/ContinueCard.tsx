import { useEffect, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, vi } from 'date-fns/locale';
import { useI18n } from '../../i18n';
import type { AppUser } from '../../types/auth.type';
import type { BoardData } from '../../types/task.type';
import type { NextSteps } from '../../features/focus/next-steps';
import type { SavedContextItem } from '../../types/saved-context.type';
import { fetchSavedContext, SAVED_CONTEXT_CHANGED } from '../../services/saved-context.service';
import { openQuickNotes } from '../../features/notes/quick-notes-events';
import type { ResumeCandidate } from './resume-task';


interface Props {
  task: ResumeCandidate;
  nextSteps: NextSteps;
  currentUser: AppUser | null;
  taskRevision?: BoardData['task'];
  onContinue: () => void;
  onOpenTask: () => void;
  primaryButton: string;
  quietButton: string;
  sectionLabel: string;
}

/** Everything needed to pick up a paused task: where to start, what is linked to it, and one click back into Focus. */
export default function ContinueCard({ task, nextSteps, currentUser, taskRevision, onContinue, onOpenTask, primaryButton, quietButton, sectionLabel }: Props) {
  const { t, language } = useI18n();
  const step = nextSteps[task.id];
  const checklist = taskRevision?.[task.id]?.checklistItems ?? [];
  const done = checklist.filter(item => item.isDone).length;
  const [saved, setSaved] = useState<SavedContextItem[]>([]);
  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    const load = () => { void fetchSavedContext(currentUser).then(items => { if (active) setSaved(items); }).catch(() => {}); };
    load();
    window.addEventListener(SAVED_CONTEXT_CHANGED, load);
    return () => { active = false; window.removeEventListener(SAVED_CONTEXT_CHANGED, load); };
  }, [currentUser]);
  const linked = saved.filter(item => item.source && item.source.taskId === task.id && item.resourceId !== task.id).slice(0, 3);
  const paused = step?.pausedAt ? formatDistanceToNow(parseISO(step.pausedAt), { addSuffix: true, locale: language === 'vi' ? vi : enUS }) : '';
  return <section aria-label={t('resume.title')} className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
    <p className={sectionLabel}>{t('resume.title')}</p>
    <h2 className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-950">{task.title}</h2>
    <p className="mt-1 text-xs text-slate-500">{task.boardTitle}{paused && <><span className="mx-1.5" aria-hidden="true">·</span>{t('resume.paused', { when: paused })}</>}</p>
    {step?.text && <p className="mt-3 border-l-2 border-blue-500 pl-3 text-[15px] leading-6 text-slate-700"><span className="sr-only">{t('briefing.nextStep')}: </span>{step.text}</p>}
    {(checklist.length > 0 || linked.length > 0) && <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
      {checklist.length > 0 && <li className="rounded-full bg-slate-100 px-2.5 py-1">{t('resume.checklist', { done, total: checklist.length })}</li>}
      {linked.map(item => <li key={`${item.resourceType}:${item.resourceId}`} className="max-w-[16rem] truncate rounded-full bg-slate-100 px-2.5 py-1">{item.source!.label}</li>)}
    </ul>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={onContinue} aria-label={`${t('resume.continue')}: ${task.title}`} className={`${primaryButton} min-h-11 px-5`}>{t('resume.continue')}</button>
      <button type="button" className={`${quietButton} min-h-11`} onClick={onOpenTask}>{t('briefing.details')}</button>
      <button type="button" className={`${quietButton} min-h-11`} onClick={() => openQuickNotes({ taskId: task.id, boardId: task.boardId })}>{t('resume.notes')}</button>
    </div>
  </section>;
}
