import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import FeatureRoute from './FeatureRoute';

const pageDock = vi.hoisted(() => ({ attach: vi.fn(), selectTab: vi.fn(), returnToPage: vi.fn(), native: false, isFloating: false,
  minimized: false, setMinimized: vi.fn(), openShutdown: vi.fn() }));
vi.mock('../../app/useAppLayoutRouteContext', () => ({ useAppLayoutRouteContext: () => ({ header: <header>Workspace</header>, focusDockPage: pageDock }) }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); pageDock.isFloating = false; });
afterEach(cleanup);

const open = (url: string) => render(<I18nProvider><MemoryRouter initialEntries={[url]}><Routes>
  <Route path="/focus" element={<FeatureRoute tab="focus" />} />
  <Route path="/music" element={<FeatureRoute tab="music" />} />
  <Route path="/beat-grid" element={<FeatureRoute tab="beat" />} />
</Routes></MemoryRouter></I18nProvider>);

it('attaches the shared dock to an explicit empty Focus page without creating another view', () => {
  open('/focus');
  expect(screen.getByTestId('focus-dock-page')).toBeInTheDocument();
  expect(pageDock.attach).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  expect(pageDock.selectTab).toHaveBeenCalledWith('focus');
});

it.each([['/music?view=app#resume', 'music'], ['/beat-grid?view=app', 'beat']] as const)('hands the compatible %s link to the correct Focus tab', async (url, tab) => {
  open(url);
  await waitFor(() => expect(pageDock.selectTab).toHaveBeenCalledWith(tab));
  expect(screen.getAllByTestId('focus-dock-page')).toHaveLength(1);
});

it('keeps the intended private Beat Grid debug entry and selects Beat', () => {
  open('/beat-grid?musicDebug=1&musicFourRows=1');
  expect(pageDock.selectTab).toHaveBeenCalledWith('beat');
});

it('shows an explicit return action while the shared dock is floating', () => {
  pageDock.isFloating = true;
  open('/focus?tab=music');
  expect(screen.getByRole('button', { name: 'Return dock to tab' })).toBeInTheDocument();
});
