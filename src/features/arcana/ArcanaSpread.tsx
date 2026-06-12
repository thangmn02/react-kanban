import { motion, useReducedMotion } from 'framer-motion';

import ArcanaCard from './ArcanaCard';
import { arcanaSpreadLabels } from './arcanaSystems';
import type { ArcanaSpreadCard } from './types';
import { useI18n } from '../../i18n';

interface ArcanaSpreadProps {
  cards: ArcanaSpreadCard[];
  isRevealed: boolean;
}

// Slight fan: side cards rotate outward, center sits higher.
const fan = [
  { rotate: -7, y: 18 },
  { rotate: 0, y: 0 },
  { rotate: 7, y: 18 },
];

function ArcanaSpread({ cards, isRevealed }: ArcanaSpreadProps) {
  const { language } = useI18n();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex items-end justify-center gap-1.5 sm:gap-3">
      {cards.map((card, index) => {
        const f = fan[index] ?? fan[1];
        return (
          <motion.div
            key={card.position}
            className="flex flex-col items-center gap-2.5"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 60, rotateY: 90 }}
            animate={{ opacity: 1, y: 0, rotateY: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.15 + index * 0.22, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ transform: `translateY(${f.y}px) rotate(${f.rotate}deg)` }}
          >
            <span className="arcana-display rounded-full border border-[#d6b87a]/30 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d6b87a]/85">
              {arcanaSpreadLabels[language][card.position]}
            </span>
            <ArcanaCard card={card} isRevealed={isRevealed} size="md" revealDelayMs={0} />
            <span className="arcana-serif max-w-[10rem] text-center text-sm font-semibold leading-tight text-[#f3e7cc]">
              {card.cardName}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

export default ArcanaSpread;
