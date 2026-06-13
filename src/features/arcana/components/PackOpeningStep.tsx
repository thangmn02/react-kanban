import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { getArcanaPackSprite } from '../arcanaAtlas';
import { arcanaPackAtlasIndex } from '../arcanaSystems';
import type { ArcanaPackType } from '../types';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaStepHeader from './ArcanaStepHeader';

interface PackOpeningStepProps {
  packType: ArcanaPackType;
  onComplete: () => void;
}

function PackOpeningStep({ packType, onComplete }: PackOpeningStepProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isOpening, setIsOpening] = useState(false);
  const timerRef = useRef<number | null>(null);

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
        eyebrow="IV - Mở gói"
        title="Chạm để mở phong ấn"
        description="Không có lời giải ở bước này. Chỉ có tiếng gói bài mở ra và ba lá chuẩn bị hiện mặt."
      />

      <button
        type="button"
        onClick={open}
        disabled={isOpening}
        className={`arcana-open-pack ${isOpening ? 'is-opening' : ''}`}
        aria-label="Mở gói bài Arcana"
      >
        <span className="arcana-open-pack-light" aria-hidden="true" />
        <span
          className="arcana-art arcana-open-pack-art"
          style={getArcanaPackSprite(arcanaPackAtlasIndex[packType])}
          aria-hidden="true"
        />
        <span className="arcana-open-pack-prompt">{isOpening ? 'Đang mở...' : 'Chạm để mở'}</span>
      </button>

      <ArcanaActions>
        <ArcanaButton onClick={open} disabled={isOpening}>
          {isOpening ? 'Đang mở gói' : 'Mở gói'}
        </ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default PackOpeningStep;
