import { useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { openNativeMusicSetup, type CompanionSetupResult } from './nativeMusic';

export function useCompanionSetup() {
  const { t } = useI18n();
  const pending = useRef(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<CompanionSetupResult>();
  const [error, setError] = useState('');
  const run = async () => {
    if (pending.current) return;
    pending.current = true; setUpdating(true); setResult(undefined); setError('');
    try {
      const next = await openNativeMusicSetup();
      if (!next || !['ready', 'reload-required', 'install-required'].includes(next.status) || typeof next.version !== 'string') {
        throw new Error(t('music.companionUpdateUnavailable'));
      }
      setResult(next);
    } catch (cause) {
      setError(typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : t('music.companionUpdateUnavailable'));
    } finally { pending.current = false; setUpdating(false); }
  };
  const message = updating ? t('music.companionUpdating') : error ? `${t('music.companionUpdateFailed')} ${error}`
    : result ? `${t(`music.companion.${result.status}`, { version: result.version })}${result.status !== 'ready' ? ` ${result.folder}` : ''}` : '';
  return { run, updating, message };
}
