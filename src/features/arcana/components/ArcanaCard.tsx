import { useCallback, useRef } from 'react';

import { getArcanaCardSprite } from '../arcanaAtlas';
import { getArcanaCardById } from '../arcanaCards';
import { arcanaFinishLabels, arcanaOrientationLabels, arcanaRarityLabels } from '../arcanaSystems';
import type { ArcanaSpreadCard } from '../types';
import { normalizeVietnameseText } from '../utils/normalizeVietnameseText';
import { useI18n } from '../../../i18n';

interface ArcanaCardProps {
  card: ArcanaSpreadCard;
  isRevealed: boolean;
  focus?: boolean;
}

/** Pixel-accurate CSS variable tilt tracking. Respects prefers-reduced-motion. */
function useTilt() {
  const frameRef = useRef<number | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

      frameRef.current = requestAnimationFrame(() => {
        const el = elementRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        const fromx = px - 50;
        const fromy = py - 50;
        const hyp = Math.sqrt(fromx * fromx + fromy * fromy) / 70.71; // normalised 0..1

        // Tilt the outer wrapper
        const tilt = el.closest('.arcana-tilt') as HTMLElement | null;
        if (tilt) {
          tilt.style.transform = `rotateY(${fromx * 0.14}deg) rotateX(${fromy * -0.14}deg)`;
        }

        el.style.setProperty('--arc-px', `${px.toFixed(1)}%`);
        el.style.setProperty('--arc-py', `${py.toFixed(1)}%`);
        el.style.setProperty('--arc-fromx', String(fromx.toFixed(1)));
        el.style.setProperty('--arc-fromy', String(fromy.toFixed(1)));
        el.style.setProperty('--arc-hyp', String(Math.min(1, hyp).toFixed(3)));
        frameRef.current = null;
      });
    },
    [prefersReducedMotion],
  );

  const onPointerLeave = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const el = elementRef.current;
    if (!el) return;

    const tilt = el.closest('.arcana-tilt') as HTMLElement | null;
    if (tilt) {
      tilt.style.transform = '';
    }

    el.style.removeProperty('--arc-px');
    el.style.removeProperty('--arc-py');
    el.style.removeProperty('--arc-fromx');
    el.style.removeProperty('--arc-fromy');
    el.style.removeProperty('--arc-hyp');
  }, []);

  return { elementRef, onPointerMove, onPointerLeave };
}

function ArcanaCard({ card, isRevealed, focus = false }: ArcanaCardProps) {
  const { language } = useI18n();
  const data = getArcanaCardById(card.cardId);
  const isReversed = card.orientation === 'reversed';
  const name = normalizeVietnameseText(card.cardName);
  const rarity = arcanaRarityLabels[language][card.rarity];
  const finish = arcanaFinishLabels[language][card.finish];
  const orientation = arcanaOrientationLabels[language][card.orientation];

  const { elementRef, onPointerMove, onPointerLeave } = useTilt();

  return (
    <article className={`arcana-card-frame ${focus ? 'arcana-card-frame--focus' : ''} ${isRevealed ? 'is-revealed' : 'is-hidden'}`}>
      {/* arcana-tilt is the 3D perspective wrapper; tilt hook sets transform on it */}
      <div className="arcana-tilt">
        <div
          ref={elementRef}
          className="arcana-card-plate"
          role="img"
          aria-label={`${name} - ${rarity} - ${finish} - ${orientation}`}
          onPointerMove={isRevealed ? onPointerMove : undefined}
          onPointerLeave={isRevealed ? onPointerLeave : undefined}
        >
          {isRevealed && data ? (
            <>
              <div
                className={`arcana-art arcana-card-art ${isReversed ? 'rotate-180' : ''}`}
                style={getArcanaCardSprite(data.atlas, data.atlasIndex)}
                aria-hidden="true"
              />
              <div className={`arcana-finish arcana-finish--${card.finish}`} aria-hidden="true" />
              <div className="arcana-glare" aria-hidden="true" />
            </>
          ) : (
            <div className="arcana-card-back" aria-hidden="true">
              <span />
            </div>
          )}
        </div>
      </div>

      <div className="arcana-card-caption">
        <strong>{isRevealed ? name : '...'}</strong>
        <span>{isRevealed ? `${orientation} · ${rarity} · ${finish}` : 'Đang mở màn'}</span>
      </div>
    </article>
  );
}

export default ArcanaCard;
