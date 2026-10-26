/** Finite UI feedback only. Beat/music timing owns its own motion contracts. */
export const uiEase = [0.22, 1, 0.36, 1] as const;
export const uiSpring = { type: 'spring' as const, stiffness: 360, damping: 32, mass: 0.8 };
export const uiFade = { duration: 0.16, ease: uiEase };
export const sortableTransition = { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
export const dropTransition = { duration: 240, easing: 'cubic-bezier(0.18, 0.89, 0.32, 1.18)' };
