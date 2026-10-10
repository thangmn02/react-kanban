import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AppNavigation from './AppNavigation';
import { I18nProvider } from '../../i18n';

afterEach(cleanup);
it.each([false, true])('shows Focus as the only music/focus entry, including mobile=%s', mobile => {
  const navigate = vi.fn();
  render(<I18nProvider><AppNavigation activeView="beat-grid" onNavigate={navigate} mobile={mobile} /></I18nProvider>);
  expect(screen.queryByRole('button', { name: 'Music' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Beat grid' })).toBeNull();
  const focus = screen.getByRole('button', { name: 'Focus' });
  expect(focus).toHaveAttribute('aria-current', 'page');
  fireEvent.click(focus);
  expect(navigate).toHaveBeenCalledWith('focus');
});
