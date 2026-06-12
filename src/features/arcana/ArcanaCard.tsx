import { useCallback, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { getArcanaCardSprite } from './arcanaAtlas';
import { getArcanaCardById } from './arcanaCards';
import { arcanaFinishLabels, arcanaOrientationLabels, arcanaRarityLabels } from './arcanaSystems';
import type { ArcanaSpreadCard } from './types';
import { useI18n } from '../../i18n';

interface ArcanaCardProps {
  card: ArcanaSpreadCard | null;
  isRevealed: boolean;
  /** Visual size of the card. */
  size?: 'sm' | 'md' | 'lg';
  /** Reveal animation delay (ms) for staggered spreads. */
  revealDelayMs?: number;
}

const rarityRing: Record<string, string> = {
  common: 'border-slate-300/40',
  uncommon: 'border-emerald-300/50',
  rare: 'border-sky-300/60',
  epic: 'border-fuchsia-300/60',
  legendary: 'border-amber-300/70',
  mythic: 'border-rose-300/70',
};

const rarityGlow: Record<string, string> = {
  common: '0 14px 40px rgba(2,6,23,0.5)',
  uncommon: '0 16px 46px rgba(16,185,129,0.28)',
  rare: '0 16px 50px rgba(56,189,248,0.32)',
  epic: '0 18px 58px rgba(217,70,239,0.38)',
  legendary: '0 20px 66px rgba(251,191,36,0.42)',
  mythic: '0 22px 76px rgba(244,63,94,0.48)',
};

const sizeClass: Record<NonNullable<ArcanaCardProps['size']>, string> = {
  sm: 'w-[6.75rem] sm:w-[7.5rem]',
  md: 'w-[10rem] sm:w-[11rem]',
  lg: 'w-[13rem] sm:w-[15rem]',
};

interface TiltState {
  rx: number;
  ry: number;
  px: number;
  py: number;
  fromx: number;
  fromy: number;
  hyp: number;
  active: boolean;
}

const restTilt: TiltState = { rx: 0, ry: 0, px: 50, py: 50, fromx: 0, fromy: 0, hyp: 0, active: false };

function ArcanaCard({ card, isRevealed, size = 'md', revealDelayMs = 0 }: ArcanaCardProps) {
  const { language, t } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>(restTilt);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (shouldReduceMotion) return;
      const node = tiltRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * 100;
      const py = ((event.clientY - rect.top) / rect.height) * 100;
      const fromx = px - 50;
      const fromy = py - 50;
      const hyp = Math.min(1, Math.hypot(fromx, fromy) / 50);
      // Rotate toward the cursor (max ~14deg) for a tactile 3D feel.
      const ry = (fromx / 50) * 14;
      const rx = (-fromy / 50) * 16;
      setTilt({ rx, ry, px, py, fromx, fromy, hyp, active: true });
    },
    [shouldReduceMotion],
  );

  const handlePointerLeave = useCallback(() => setTilt(restTilt), []);

  const data = card ? getArcanaCardById(card.cardId) : null;
  const finish = card?.finish ?? 'plain';
  const rarity = card?.rarity ?? 'common';
  const orientation = card?.orientation ?? 'upright';
  const isReversed = orientation === 'reversed';
  const accent = data?.accent ?? '#f8d477';

  const ariaLabel = card
    ? `${card.cardName} — ${arcanaRarityLabels[language][rarity]} — ${arcanaFinishLabels[language][finish]} — ${arcanaOrientationLabels[language][orientation]}`
    : t('arcana.hiddenCard');

  return (
    <div className={`mx-auto ${sizeClass[size]} [perspective:1200px]`}>
      <div
        ref={tiltRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`arcana-tilt relative aspect-[71/95] w-full rounded-[1rem] border-2 bg-slate-950 p-1.5 ${rarityRing[rarity]} ${tilt.active ? 'is-active' : ''} ${
          isRevealed && !shouldReduceMotion ? 'motion-safe:animate-[arcana-reveal_640ms_ease-out_both]' : ''
        }`}
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.active ? 1.04 : 1})`,
          boxShadow: rarityGlow[rarity],
          animationDelay: isRevealed && !shouldReduceMotion ? `${revealDelayMs}ms` : undefined,
          ['--arc-px' as string]: `${tilt.px}%`,
          ['--arc-py' as string]: `${tilt.py}%`,
          ['--arc-fromx' as string]: `${tilt.fromx}`,
          ['--arc-fromy' as string]: `${tilt.fromy}`,
          ['--arc-hyp' as string]: `${tilt.hyp}`,
          ['--arcana-accent' as string]: accent,
        }}
        role="img"
        aria-label={ariaLabel}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[0.75rem] border border-white/15 bg-slate-900">
          {data ? (
            <>
              <div
                className={`arcana-art absolute inset-0 ${isReversed ? 'rotate-180' : ''}`}
                style={getArcanaCardSprite(data.atlas, data.atlasIndex)}
                aria-hidden="true"
              />
              <div className={`arcana-finish arcana-finish--${finish}`} aria-hidden="true" />
              <div className="arcana-glare" aria-hidden="true" />
            </>
          ) : (
            <div className="grid h-full w-full place-items-center bg-[linear-gradient(180deg,#0b1020,#21113c)] text-4xl font-black text-amber-200/70">
              ?
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArcanaCard;
