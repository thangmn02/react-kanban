import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { getArcanaPackSprite } from './arcanaAtlas';
import { arcanaPackAtlasIndex, arcanaPackLabels } from './arcanaSystems';
import type { ArcanaPackType } from './types';
import { useI18n } from '../../i18n';

interface ArcanaPackOpeningProps {
  packType: ArcanaPackType;
  onPlaySound?: () => void;
  onComplete: () => void;
}

type Phase = 'sealed' | 'tearing' | 'flash';

function ArcanaPackOpening({ packType, onPlaySound, onComplete }: ArcanaPackOpeningProps) {
  const { language, t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('sealed');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    onPlaySound?.();
    if (shouldReduceMotion) {
      onComplete();
      return;
    }
    timers.current.push(window.setTimeout(() => setPhase('tearing'), 620));
    timers.current.push(window.setTimeout(() => setPhase('flash'), 1180));
    timers.current.push(window.setTimeout(() => onComplete(), 1760));
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="arcana-dais relative grid min-h-[24rem] place-items-center pt-6">
      <div
        className={`arcana-art h-64 w-[11.5rem] rounded-2xl border-2 border-[#d6b87a]/45 shadow-[0_36px_100px_rgba(0,0,0,0.7)] ${
          phase === 'sealed' ? 'arcana-pack-shake' : ''
        } ${phase === 'tearing' || phase === 'flash' ? 'arcana-pack-tear' : ''}`}
        style={getArcanaPackSprite(arcanaPackAtlasIndex[packType])}
        aria-hidden="true"
      />

      {phase === 'flash' && (
        <div
          className="arcana-flash pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(255,244,214,0.95),transparent_60%)]"
          aria-hidden="true"
        />
      )}

      <p className="arcana-display absolute bottom-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d6b87a]/90" aria-live="polite">
        {t('arcana.opening', { pack: arcanaPackLabels[language][packType] })}
      </p>
    </div>
  );
}

export default ArcanaPackOpening;
