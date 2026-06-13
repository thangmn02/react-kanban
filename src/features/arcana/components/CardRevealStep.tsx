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

const revealText: Record<ArcanaLocale, {
  eyebrow: string;
  title: string;
  description: string;
  orientation: string;
  rarity: string;
  finish: string;
  read: string;
  wait: string;
}> = {
  en: {
    eyebrow: 'V - Three cards revealed',
    title: 'Read the image first, the words after',
    description: 'The three positions open one by one. Once all cards are visible, the interpretation unlocks.',
    orientation: 'Orientation',
    rarity: 'Rarity',
    finish: 'Finish',
    read: 'Read the interpretation',
    wait: 'Wait for all three cards',
  },
  vi: {
    eyebrow: 'V - Ba lá hiện mặt',
    title: 'Đọc hình trước, đọc lời sau',
    description: 'Ba vị trí mở lần lượt. Khi cả ba lá đã hiện ra, lời giải mới được mở.',
    orientation: 'Trạng thái',
    rarity: 'Độ hiếm',
    finish: 'Ánh',
    read: 'Đọc lời giải',
    wait: 'Đợi ba lá hiện đủ',
  },
};

function CardRevealStep({ locale, reading, onRead }: CardRevealStepProps) {
  const shouldReduceMotion = useReducedMotion();
  const [revealedCount, setRevealedCount] = useState(shouldReduceMotion ? reading.cards.length : 0);
  const allRevealed = shouldReduceMotion || revealedCount >= reading.cards.length;
  const copy = revealText[locale];

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
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
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
                  <dt>{copy.orientation}</dt>
                  <dd>{isRevealed ? arcanaOrientationLabels[locale][card.orientation] : '...'}</dd>
                </div>
                <div>
                  <dt>{copy.rarity}</dt>
                  <dd>{isRevealed ? arcanaRarityLabels[locale][card.rarity] : '...'}</dd>
                </div>
                <div>
                  <dt>{copy.finish}</dt>
                  <dd>{isRevealed ? normalizeVietnameseText(arcanaFinishLabels[locale][card.finish]) : '...'}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <ArcanaActions>
        <ArcanaButton onClick={onRead} disabled={!allRevealed}>
          {allRevealed ? copy.read : copy.wait}
        </ArcanaButton>
      </ArcanaActions>
    </section>
  );
}

export default CardRevealStep;
