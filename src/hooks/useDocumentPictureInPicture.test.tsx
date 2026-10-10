import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { copyPictureInPictureStyles, useDocumentPictureInPicture } from './useDocumentPictureInPicture';
import type { FloatingFocusProps } from '../components/focus/FloatingFocus';
import { sendMusicRequest } from '../features/music/mediaBridge';

vi.mock('../features/music/mediaBridge', async (importOriginal) => ({ ...await importOriginal<typeof import('../features/music/mediaBridge')>(), sendMusicRequest: vi.fn() }));

let popupDocument: Document;
let popupFrame: HTMLIFrameElement;
let hide: () => void;
const close = vi.fn();
const requestWindow = vi.fn();
const onPause = vi.fn();
const task = { id: 'task', title: '<img src=x onerror=alert(1)>', boardId: 'board', boardTitle: 'Project' };
const props: FloatingFocusProps = {
  activeTask: task, focusTasks: [task], cycleTotal: 4,
  timerState: { mode: 'focus', activeTaskId: 'task', isRunning: true, remainingSeconds: 90, endsAt: null, startedAt: 1, plannedSeconds: 1500 },
  remainingSeconds: 90, onStart: vi.fn(), onPause, onReset: vi.fn(), onActiveTaskChange: vi.fn(), onMarkDoneAndNext: vi.fn(),
};
function Harness({ seconds = 90 }: { seconds?: number }) {
  const pip = useDocumentPictureInPicture({ ...props, remainingSeconds: seconds });
  return <><button onClick={() => void pip.openPictureInPicture()}>Open popup</button>{pip.floatingFocusPortal}</>;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  localStorage.setItem('floatingDock.style', 'island');
  vi.mocked(sendMusicRequest).mockResolvedValue([{ id: 'track', title: 'Song', artist: '', source: 'youtube.com', paused: false }]);
  popupFrame = document.createElement('iframe');
  document.body.appendChild(popupFrame);
  popupDocument = popupFrame.contentDocument!;
  requestWindow.mockResolvedValue({ document: popupDocument, closed: false, focus: vi.fn(), close, addEventListener: (_type: string, callback: () => void) => { hide = callback; } });
  Object.defineProperty(window, 'documentPictureInPicture', { configurable: true, value: { requestWindow } });
});
afterEach(() => { cleanup(); popupFrame.remove(); delete window.documentPictureInPicture; });

it('renders timer and music together in the detached document, with shared timer callbacks', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Open popup')); });
  const host = popupDocument.getElementById('floating-focus-widget')!;
  const root = host.shadowRoot!.getElementById('floating-focus-root') as HTMLElement;
  const popup = within(root);
  expect(popup.getByText('01:30')).toBeInTheDocument();
  expect(requestWindow).toHaveBeenCalledWith({ width: 520, height: 580 });
  fireEvent.click(popup.getByRole('tab', { name: 'Music' }));
  expect(popup.getByRole('tabpanel', { name: 'Music' })).toBeInTheDocument();
  expect(screen.queryByRole('tabpanel', { name: 'Music' })).not.toBeInTheDocument();
  expect(popupDocument.querySelector('img')).toBeNull();
  fireEvent.click(popup.getByRole('button', { name: 'Pause' }));
  expect(onPause).toHaveBeenCalledOnce();
  const musicPanel = popup.getByRole('tabpanel', { name: 'Music' });
  view.rerender(<I18nProvider><Harness seconds={89} /></I18nProvider>);
  expect(popup.getByText('01:29')).toBeInTheDocument();
  expect(popup.getByRole('tabpanel', { name: 'Music' })).toBe(musicPanel);
  act(() => hide());
  expect(host.ownerDocument).toBe(document);
  expect(popup.getByRole('tabpanel', { name: 'Music' })).toBe(musicPanel);
  expect(popup.getByRole('button', { name: 'Pop out dock' }).hasAttribute('disabled')).toBe(false);
  expect(popupDocument.getElementById('floating-focus-widget')).toBeNull();
});

it('keeps only Tabs and preserves the selected panel and live DOM when returning and popping out again', async () => {
  render(<I18nProvider><Harness /></I18nProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Open popup')); });
  const host = popupDocument.getElementById('floating-focus-widget')!;
  const root = host.shadowRoot!.getElementById('floating-focus-root') as HTMLElement;
  const dock = within(root);
  const ring = root.querySelector('.dock-ring');
  const grid = root.querySelector('.music-pattern');
  fireEvent.click(dock.getByRole('tab', { name: 'Beat grid' }));
  fireEvent.click(dock.getByRole('button', { name: 'Return dock to tab' }));
  expect(close).toHaveBeenCalledOnce();
  expect(root.querySelector('.floating-focus')?.getAttribute('data-style')).toBe('tabs');
  expect(dock.getByRole('tab', { name: 'Beat grid' }).getAttribute('aria-selected')).toBe('true');
  expect(root.querySelector('.dock-ring')).toBe(ring);
  await act(async () => { fireEvent.click(dock.getByRole('button', { name: 'Pop out dock' })); });
  expect(requestWindow).toHaveBeenCalledTimes(2);
  expect(host.ownerDocument).toBe(popupDocument);
  expect(root.querySelector('.music-pattern')).toBe(grid);
  expect(root.querySelector('.dock-ring')).toBe(ring);
});

it('copies stylesheet rules and falls back to external links without losing base URLs', () => {
  const readable = { cssRules: [{ cssText: '.test { color: red; }' }], media: { mediaText: 'screen' } };
  const external = { get cssRules() { throw new DOMException('Cross origin', 'SecurityError'); }, href: 'https://example.com/font.css', media: { mediaText: 'all' } };
  const source = { baseURI: 'https://example.com/app/', styleSheets: [readable, external] } as unknown as Document;
  copyPictureInPictureStyles(source, popupDocument);
  expect(popupDocument.querySelector('base')).toHaveAttribute('href', source.baseURI);
  expect(popupDocument.querySelector('link[rel="stylesheet"]')).toHaveAttribute('href', external.href);
  expect(Array.from(popupDocument.querySelectorAll('style')).some((style) => style.textContent?.includes('.test'))).toBe(true);
});

it('keeps the returned dock intact when a new PiP request is denied', async () => {
  render(<I18nProvider><Harness /></I18nProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Open popup')); });
  const host = popupDocument.getElementById('floating-focus-widget')!;
  const root = host.shadowRoot!.getElementById('floating-focus-root') as HTMLElement;
  const dock = within(root);
  const ring = root.querySelector('.dock-ring');
  act(() => hide());
  requestWindow.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  await act(async () => { fireEvent.click(dock.getByRole('button', { name: 'Pop out dock' })); });
  expect(host.ownerDocument).toBe(document);
  expect(root.querySelector('.dock-ring')).toBe(ring);
  expect(dock.getByText('Could not open the widget. Try again from this tab.')).not.toBeNull();
});

it('closes the detached window on app unmount', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Open popup')); });
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
});

it('moves the explicit empty Focus page dock into one PiP window and back without remounting', async () => {
  function PageHarness() {
    const pip = useDocumentPictureInPicture({ ...props, activeTask: null, focusTasks: [],
      timerState: { ...props.timerState, activeTaskId: null } });
    return <><div data-testid="page-dock" ref={pip.attachFocusDock} />{pip.floatingFocusPortal}</>;
  }
  render(<I18nProvider><PageHarness /></I18nProvider>);
  const pageHost = screen.getByTestId('page-dock');
  const host = pageHost.querySelector('#floating-focus-widget')!;
  const root = host.shadowRoot!.getElementById('floating-focus-root') as HTMLElement;
  const dock = within(root);
  const ring = root.querySelector('.dock-ring');
  expect(requestWindow).not.toHaveBeenCalled();
  fireEvent.click(dock.getByRole('tab', { name: 'Music' }));
  const musicPanel = dock.getByRole('tabpanel', { name: 'Music' });
  await act(async () => { fireEvent.click(dock.getByRole('button', { name: 'Pop out dock' })); });
  expect(requestWindow).toHaveBeenCalledOnce();
  expect(popupDocument.getElementById('floating-focus-widget')).toBe(host);
  await act(async () => { fireEvent.click(dock.getByRole('button', { name: 'Return dock to tab' })); });
  expect(pageHost.querySelector('#floating-focus-widget')).toBe(host);
  expect(root.querySelector('.dock-ring')).toBe(ring);
  expect(dock.getByRole('tabpanel', { name: 'Music' })).toBe(musicPanel);
  expect(dock.getByRole('tab', { name: 'Music' })).toHaveAttribute('aria-selected', 'true');
});

it('does not open a floating window for a task-free incidental caller', async () => {
  const denied = vi.fn();
  function EmptyHarness() {
    const pip = useDocumentPictureInPicture({ ...props, activeTask: null, focusTasks: [],
      timerState: { ...props.timerState, activeTaskId: null } });
    return <><button onClick={() => { void pip.openPictureInPicture().catch(error => denied(error.message)); }}>Try empty popup</button>{pip.floatingFocusPortal}</>;
  }
  render(<I18nProvider><EmptyHarness /></I18nProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Try empty popup')); });
  expect(denied).toHaveBeenCalledWith('Pin a focus task before opening the floating timer.');
  expect(requestWindow).not.toHaveBeenCalled();
});

it('can dismiss an in-page dock and reopen it through navigation', () => {
  function NavigationHarness() {
    const [shown, setShown] = useState(true);
    const pip = useDocumentPictureInPicture({ ...props, onDismiss: () => setShown(false) });
    return <><button onClick={() => setShown(true)}>Focus page</button>
      {shown && <div data-testid="page-dock" ref={pip.attachFocusDock} />}{pip.floatingFocusPortal}</>;
  }
  render(<I18nProvider><NavigationHarness /></I18nProvider>);
  const host = screen.getByTestId('page-dock').querySelector('#floating-focus-widget')!;
  const root = host.shadowRoot!.getElementById('floating-focus-root') as HTMLElement;
  fireEvent.click(within(root).getByRole('button', { name: 'Close dock' }));
  expect(screen.queryByTestId('page-dock')).toBeNull();
  fireEvent.click(screen.getByText('Focus page'));
  expect(screen.getByTestId('page-dock').querySelector('#floating-focus-widget')).toBe(host);
  expect(host).not.toHaveAttribute('hidden');
  expect(root.querySelectorAll('.floating-focus')).toHaveLength(1);
});
