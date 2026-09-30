import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n';
import type { TaskChecklistItem } from '../../../types/task.type';
import { MAX_STEP_LENGTH } from '../utils/taskBreakdown';

interface Props {
  onGenerate: (signal: AbortSignal) => Promise<string[]>;
  onApply: (items: TaskChecklistItem[]) => Promise<void> | void;
  onStart?: (firstStep: string) => void;
  disabled?: boolean;
}

const errorCodes = ['not_configured', 'unauthorized', 'rate_limited', 'task_unavailable', 'invalid_response', 'timeout', 'unavailable', 'save_failed'] as const;
type ErrorCode = typeof errorCodes[number];

export default function TaskBreakdownEditor({ onGenerate, onApply, onStart, disabled }: Props) {
  const { t } = useI18n();
  const [steps, setSteps] = useState<TaskChecklistItem[]>([]);
  const [phase, setPhase] = useState<'idle' | 'generating' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<ErrorCode | ''>('');
  const request = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  const busy = phase === 'generating' || phase === 'saving';
  const valid = steps.length > 0 && steps.every((step) => step.text.trim()) && new Set(steps.map((step) => step.text.trim().toLocaleLowerCase())).size === steps.length;
  const report = (cause: unknown, fallback: ErrorCode) => {
    const code = cause instanceof Error ? cause.message : '';
    setError(errorCodes.includes(code as ErrorCode) ? code as ErrorCode : fallback);
  };
  const generate = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    request.current = controller;
    setError(''); setPhase('generating');
    try {
      const result = await onGenerate(controller.signal);
      if (!controller.signal.aborted && mounted.current) setSteps(result.map((text) => ({ id: crypto.randomUUID(), text, isDone: false })));
    } catch (cause) { if (!controller.signal.aborted && mounted.current) report(cause, 'unavailable'); }
    finally { if (mounted.current && !controller.signal.aborted) setPhase('idle'); busyRef.current = false; }
  };
  const apply = async (start: boolean) => {
    if (busyRef.current || !valid) return;
    busyRef.current = true; setPhase('saving'); setError('');
    try {
      await onApply(steps.map((step) => ({ ...step, text: step.text.trim() })));
      if (mounted.current) { setPhase('saved'); if (start) onStart?.(steps[0].text.trim()); }
    } catch (cause) { if (mounted.current) { report(cause, 'save_failed'); setPhase('idle'); } }
    finally { busyRef.current = false; }
  };
  const move = (index: number, direction: number) => setSteps((current) => {
    const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
  });
  const button = 'cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-default disabled:opacity-40';
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5" aria-label={t('aiPlan.title')} aria-busy={busy}>
      <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-[0.18em] text-stone-600">{t('aiPlan.title')}</h3><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-800">GEMINI</span></div>
      <p className="mt-2 text-sm leading-6 text-stone-500">{t('aiPlan.description')}</p>
      {!steps.length && !busy && <button type="button" disabled={disabled} className={`${button} mt-4 bg-stone-950 text-white hover:bg-stone-800`} onClick={() => void generate()}>{t('aiPlan.generate')} <span aria-hidden="true">↗</span></button>}
      {phase === 'generating' && <div role="status" className="flex items-center gap-3 py-6 text-sm text-stone-500"><span className="flex gap-1.5" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-amber-700 motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}</span>{t('aiPlan.thinking')}</div>}
      {steps.length > 0 && <ol className="mt-5 border-t border-stone-900">
        {steps.map((step, index) => <li key={step.id} className="flex items-start gap-3 border-b border-stone-200 py-4">
          <span className="pt-2 text-sm font-bold tabular-nums text-amber-800">{String(index + 1).padStart(2, '0')}</span>
          <textarea aria-label={t('aiPlan.step', { count: index + 1 })} rows={2} maxLength={MAX_STEP_LENGTH} value={step.text} disabled={busy || phase === 'saved'} onChange={(event) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, text: event.target.value } : item))} className="min-w-0 flex-1 resize-y rounded-lg border border-transparent bg-transparent p-2 text-sm font-medium leading-6 text-stone-900 focus:border-stone-300 focus:outline-none disabled:opacity-80" />
          {phase !== 'saved' && <div className="flex flex-col text-stone-400"><button type="button" disabled={busy || index === 0} aria-label={t('aiPlan.moveUp', { count: index + 1 })} onClick={() => move(index, -1)} className="px-2 hover:text-stone-950 disabled:opacity-20">↑</button><button type="button" disabled={busy || index === steps.length - 1} aria-label={t('aiPlan.moveDown', { count: index + 1 })} onClick={() => move(index, 1)} className="px-2 hover:text-stone-950 disabled:opacity-20">↓</button><button type="button" disabled={busy} aria-label={t('aiPlan.remove', { count: index + 1 })} onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))} className="px-2 hover:text-stone-950">×</button></div>}
        </li>)}
      </ol>}
      {error && <p role="alert" className="mt-4 text-sm text-amber-900">{t(`aiPlan.error.${error}`)}</p>}
      {phase === 'saved' ? <div className="mt-4 flex flex-wrap items-center gap-3"><p role="status" className="text-sm font-medium text-emerald-700">{t('aiPlan.saved')}</p>{onStart && <button type="button" className={`${button} bg-stone-950 text-white`} onClick={() => onStart(steps[0].text.trim())}>{t('aiPlan.start')}</button>}</div> : steps.length > 0 && <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !valid || disabled} className={`${button} bg-stone-950 text-white hover:bg-stone-800`} onClick={() => void apply(Boolean(onStart))}>{t(phase === 'saving' ? 'aiPlan.saving' : onStart ? 'aiPlan.saveAndStart' : 'aiPlan.apply')}</button>
        {onStart && <button type="button" disabled={busy || !valid || disabled} className={`${button} text-stone-600 hover:bg-stone-100`} onClick={() => void apply(false)}>{t('aiPlan.saveOnly')}</button>}
        <button type="button" disabled={busy || disabled} className={`${button} text-stone-400 hover:text-stone-800`} onClick={() => void generate()}>{t('aiPlan.retry')}</button>
      </div>}
      <p className="mt-4 text-xs leading-5 text-stone-400">{t('aiPlan.disclosure')}</p>
    </section>
  );
}
