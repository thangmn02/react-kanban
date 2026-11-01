import { useEffect, type ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { useAppearance } from '../features/appearance/appearance';

interface AstryxThemeProviderProps {
  children: ReactNode;
  /** Forces a color mode. Without it, the user's Appearance setting decides (System by default). */
  mode?: 'light' | 'dark';
}

/**
 * Thin wrapper around the Astryx <Theme> provider applying the neutral theme.
 *
 * The root <Theme> instance syncs `data-astryx-theme="neutral"` and `data-theme`
 * onto <html>, which activates the scoped Astryx tokens consumed by
 * `src/styles/astryx-bridge.css` (the --app-* variables). Because the attribute
 * is on <html>, the scoped CSS also reaches portals (toast fallback viewports,
 * floating timers, etc.).
 *
 * Use the prebuilt theme with the explicit reset/theme/component layer order
 * in index.css. Tailwind utilities retain the final override layer.
 */
export default function AstryxThemeProvider({
  children,
  mode,
}: AstryxThemeProviderProps) {
  const appearance = useAppearance();
  // System is resolved here, so <html data-theme> always names the mode in use; kora-appearance.css keys off it.
  const resolved = mode ?? appearance.resolved;
  useEffect(() => {
    const root = document.documentElement;
    if (appearance.accent === 'blue') root.removeAttribute('data-accent');
    else root.setAttribute('data-accent', appearance.accent);
  }, [appearance.accent]);
  return (
    <Theme theme={neutralTheme} mode={resolved}>
      {children}
    </Theme>
  );
}
