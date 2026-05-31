import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

interface AppleCardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean;
}

function AppleCard({
  interactive = false,
  className = '',
  children,
  ...props
}: AppleCardProps) {
  const prefersReducedMotion = useReducedMotion();
  // Reduce Motion: keep the card interactive but drop the scale/translate animation.
  const enableMotion = interactive && !prefersReducedMotion;

  return (
    <motion.div
      className={`rounded-[1.5rem] border border-white/80 bg-white/82 shadow-[0_12px_36px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.03] backdrop-blur-xl ${
        interactive ? 'transition-colors' : ''
      } ${className}`}
      whileHover={enableMotion ? {
        scale: 1.015,
        y: -2,
        boxShadow: '0 22px 60px rgba(15, 23, 42, 0.12)',
      } : undefined}
      whileTap={enableMotion ? { scale: 0.99 } : undefined}
      transition={enableMotion ? { type: 'spring', stiffness: 320, damping: 24 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default AppleCard;
