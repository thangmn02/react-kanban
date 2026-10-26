import { useRef, useState } from 'react';
import { useI18n } from '../i18n';

export function useSummaryCompletion<T extends { id: string; title: string }>(complete?: (task: T) => Promise<boolean>) {
  const requests = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState('');
  const { t } = useI18n();
  const run = async (task: T) => {
    if (!complete || requests.current.has(task.id)) return;
    requests.current.add(task.id);
    setPending(new Set(requests.current));
    try {
      if (await complete(task)) {
        setCompleted(current => new Set([...current, task.id]));
        setMessage(t('ux.completed', { title: task.title }));
        return true;
      } else setMessage(t('ux.completionFailed'));
    } catch {
      setMessage(t('ux.completionFailed'));
    } finally {
      requests.current.delete(task.id);
      setPending(new Set(requests.current));
    }
    return false;
  };
  return { run, pending, completed, message };
}
