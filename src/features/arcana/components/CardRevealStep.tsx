import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { arcanaFinishLabels, arcanaOrientationLabels, arcanaRarityLabels, arcanaSpreadLabels } from '../arcanaSystems';
import type { ArcanaLocale, ArcanaReading } from '../types';
import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';
import { ArcanaActions, ArcanaButton } from './ArcanaActions';
import ArcanaCard from './ArcanaCard';
import ArcanaStepHeader from './ArcanaStepHeader';

interface CardRevealStepProps {
  locale: ArcanaLocale;
  reading: ArcanaReading;
  onRead: () => void;
}

function CardRevealStep({ locale, reading, onRead }: CardRevealStepProps) {
  const shouldReduceMotion = useReducedMotion();
  const [revealedCount, setRevealedCount] = useState(shouldReduceMotion ? reading.cards.length : 0);
  const allRevealed = shouldReduceMotion || revealedCount >= reading.cards.length;

  useEffect(() => {
    if (shouldReduceMotion) return undefined;

    const timers = reading.cards.map((_, index) => window.setTimeout(() => {
      setRevealedCount((current) => Math.max(current, index + 1));
    }, 360 + index * 620));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reading.id, reading.cards, shouldReduceMotion]);

  return (
    <section>
      <ArcanaStepHeader
        eyebrow="V - Ba lá hiện mặt"
        title="Đọc hình trước, đọc lời sau"
        description="Ba vị trí mở lần lượt. Khi cả ba lá đã hiện ra, lời giải mới được mở."
      />

      <div className="arcana-spread-stage">
        {reading.cards.map((card, index) => {
          const isRevealed = shouldReduceMotion || index < revealedCount;
          return (
            <div key={card.position} className="arcana-reveal-column">
              <span className="arcana-position-label">{arcanaSpreadLabels[locale][card.position]}</span>
              <ArcanaCard card={card} isRevealed={isRevealed} focus={index === 1} />
              <dl className="arcana-card-meta">
                <div>
                  <dt>Trạng thái</dt>
                  <dd>{isRevealed ? arcanaOrientationLabels[locale][card.orientation] : '...'}</dd>
                </div>
                <div>
                  <dt>Độ hiếm</dt>
                  <dd>{isRevealed ? arcanaRarityLabels[locale][card.rarity] : '...'}</dd>
                </div>
                <div>
                  <dt>Ánh</dt>
                  <dd>{isRevealed ? normalizeVietnameseText(arcanaFinishLabels[locale][card.finish]) : '...'}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <ArcanaActions>
        <ArcanaButton onClick={onRead} disabled={!allRevealed}>
          {allRevealed ? 'Đọc lời giải' : 'Đợi ba lá hiện đủ'}
        </ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default CardRevealStep;
