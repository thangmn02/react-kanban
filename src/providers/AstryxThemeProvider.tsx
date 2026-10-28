import type { ReactNode } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

interface AstryxThemeProviderProps {
  children: ReactNode;
  /**
   * Color mode passed to the Astryx <Theme> provider. Defaults to "light" to
   * match the app's existing light canvas (#f8f9fa). Use "system" to follow the
   * OS preference once dark-mode support is desired.
   */
  mode?: 'light' | 'dark' | 'system';
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
  mode = 'light',
}: AstryxThemeProviderProps) {
  return (
    <Theme theme={neutralTheme} mode={mode}>
      {children}
    </Theme>
  );
}
