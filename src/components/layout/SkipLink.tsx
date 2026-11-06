import type { MouseEvent } from 'react';
import { useI18n } from '../../i18n';

/** First focusable element on every route. Moves focus to the route's <main id="main"> without changing the URL. */
export default function SkipLink() {
  const { t } = useI18n();
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById('main');
    if (!main) return;
    event.preventDefault();
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  };
  return <a href="#main" onClick={skip} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-slate-950 focus:shadow-lg focus:outline-2 focus:outline-blue-600">{t('app.skipToContent')}</a>;
}
