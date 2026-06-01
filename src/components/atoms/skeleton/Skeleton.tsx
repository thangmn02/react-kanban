import { useReducedMotion } from 'framer-motion';

interface SkeletonProps {
  /**
   * Tailwind utility classes that size the placeholder (e.g. `h-4 w-32`).
   * Sizes should mirror the real content to keep cumulative layout shift low.
   */
  className?: string;
  /** Override the default `rounded-md`. Pass an empty string for square edges. */
  rounded?: string;
}

/**
 * Base skeleton block. Presentation only.
 *
 * - Slate-based fill only (no new color hues), consistent with the design tokens.
 * - Marked `aria-hidden` so assistive tech does not announce placeholder noise;
 *   the surrounding Loading_Container carries `aria-busy` instead.
 * - Exactly one looping animation (`animate-pulse`, ~2s cycle). When the user
 *   prefers reduced motion we drop the animation entirely so the block is static.
 */
export default function Skeleton({ className = '', rounded = 'rounded-md' }: SkeletonProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <span
      aria-hidden="true"
      className={`block bg-slate-200/80 ${rounded} ${prefersReducedMotion ? '' : 'animate-pulse'} ${className}`}
    />
  );
}
