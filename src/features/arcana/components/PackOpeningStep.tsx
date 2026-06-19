import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { getArcanaPackSprite } from '../arcanaAtlas';
import { arcanaPackAtlasIndex } from '../arcanaSystems';
import type { ArcanaLocale, ArcanaPackType } from '../types';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaStepHeader from './ArcanaStepHeader';

interface PackOpeningStepProps {
  locale: ArcanaLocale;
  packType: ArcanaPackType;
  onComplete: () => void;
}

const openingText: Record<ArcanaLocale, {
  eyebrow: string;
  title: string;
  description: string;
  aria: string;
  idlePrompt: string;
  openingPrompt: string;
  idleButton: string;
  openingButton: string;
}> = {
  en: {
    eyebrow: 'IV - Open the pack',
    title: 'Tap to break the seal',
    description: 'There is no interpretation in this step yet, only the sound of the pack opening and three cards preparing to appear.',
    aria: 'Open Arcana pack',
    idlePrompt: 'Tap to open',
    openingPrompt: 'Opening...',
    idleButton: 'Open pack',
    openingButton: 'Opening pack',
  },
  vi: {
    eyebrow: 'IV - Mở gói',
    title: 'Chạm để mở phong ấn',
    description: 'Chưa có lời giải ở bước này. Chỉ có tiếng gói bài mở ra và ba lá chuẩn bị hiện mặt.',
    aria: 'Mở gói bài Arcana',
    idlePrompt: 'Chạm để mở',
    openingPrompt: 'Đang mở...',
    idleButton: 'Mở gói',
    openingButton: 'Đang mở gói',
  },
};

function PackOpeningStep({ locale, packType, onComplete }: PackOpeningStepProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isOpening, setIsOpening] = useState(false);
  const timerRef = useRef<number | null>(null);
  const copy = openingText[locale];

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const open = () => {
    if (isOpening) return;
    setIsOpening(true);
    timerRef.current = window.setTimeout(() => {
      onComplete();
    }, shouldReduceMotion ? 220 : 1550);
  };

  return (
    <section className="arcana-opening-step">
      <ArcanaStepHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <button
        type="button"
        onClick={open}
        disabled={isOpening}
        className={`arcana-open-pack ${isOpening ? 'is-opening' : ''}`}
        aria-label={copy.aria}
      >
        <span className="arcana-open-pack-light" aria-hidden="true" />
        <span
          className="arcana-art arcana-open-pack-art"
          style={getArcanaPackSprite(arcanaPackAtlasIndex[packType])}
          aria-hidden="true"
        />
        <span className="arcana-open-pack-prompt">{isOpening ? copy.openingPrompt : copy.idlePrompt}</span>
      </button>

      <ArcanaActions>
        <ArcanaButton onClick={open} disabled={isOpening}>
          {isOpening ? copy.openingButton : copy.idleButton}
        </ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default PackOpeningStep;
