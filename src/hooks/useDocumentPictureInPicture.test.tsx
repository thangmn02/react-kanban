import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { useDocumentPictureInPicture } from './useDocumentPictureInPicture';
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
  const popup = within(popupDocument.body);
  expect(popup.getByText('01:30')).toBeInTheDocument();
  expect(popup.getByRole('region', { name: 'Music' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
  expect(popupDocument.querySelector('img')).toBeNull();
  fireEvent.click(popup.getByRole('button', { name: 'Pause' }));
  expect(onPause).toHaveBeenCalledOnce();
  const musicPanel = popup.getByRole('region', { name: 'Music' });
  view.rerender(<I18nProvider><Harness seconds={89} /></I18nProvider>);
  expect(popup.getByText('01:29')).toBeInTheDocument();
  expect(popup.getByRole('region', { name: 'Music' })).toBe(musicPanel);
  act(() => hide());
  expect(popup.queryByRole('region', { name: 'Music' })).not.toBeInTheDocument();
});

it('closes the detached window on app unmount', async () => {
  const view = render(<I18nProvider><Harness /></I18nProvider>);
  await act(async () => { fireEvent.click(screen.getByText('Open popup')); });
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
});
