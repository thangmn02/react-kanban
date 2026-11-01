import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import FloatingFocus, { type FloatingFocusProps } from '../../components/focus/FloatingFocus';
import dockCss from '../../components/focus/floatingFocus.css?inline';
import nativeDockCss from './nativeDock.css?inline';
import { useI18n } from '../../i18n';
import './nativeSurface.css';
import NativeUpdateDialog from './NativeUpdateDialog';
import { useCompanionSetup } from './use-companion-setup';
import {nativeCompanionPreviewEnabled} from './runtime';
import { check } from '@tauri-apps/plugin-updater';
import { requestNativeMusic } from './nativeMusic';
import UpdateNotice from '../updates/UpdateNotice';
import { APP_CHECK_DELAY_MS, APP_CHECK_EVERY_MS, COMPANION_CHECK_EVERY_MS, olderThan, usePeriodicCheck } from '../updates/update-notices';

// The version of an available Kora update ('' when current). The dialog downloads it; this only looks.
async function availableAppUpdate() {
  const next = await check({ timeout: 15_000 });
  const version = next?.version ?? '';
  await next?.close().catch(() => {});
  return version;
}
// Whether a connected browser runs an older Companion than the one this Kora installs.
async function companionOutdated() {
  const response = await requestNativeMusic('companion.status');
  const companions = response.companions as { version?: string | null; verified?: boolean }[] | undefined;
  return Boolean(companions?.some(peer => peer.verified && olderThan(peer.version ?? undefined, __KORA_COMPANION_VERSION__)));
}

async function updateNativeShape(rounded: boolean) {
  const radius = await invoke<number>('native_dock_shape', { rounded });
  if (Number.isFinite(radius)) document.documentElement.style.setProperty('--native-dock-radius', `${radius}px`);
}

function NativeDock({ props }: { props: FloatingFocusProps }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const shadow = node.shadowRoot || node.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `${dockCss}\n${nativeDockCss}`;
    const root = document.createElement('div');
    shadow.replaceChildren(style, root);
    setTarget(root);
    return () => { shadow.replaceChildren(); };
  }, []);
  useEffect(() => {
    // Fit Tabs once when opening; tab changes preserve the user's resized window.
    let active = true;
    const fit = async () => {
      const nativeWindow = getCurrentWindow();
      const monitor = await currentMonitor().catch(() => null);
      const maxWidth = monitor ? monitor.workArea.size.width / monitor.scaleFactor : 1100;
      const maxHeight = monitor ? monitor.workArea.size.height / monitor.scaleFactor : 900;
      if (!active) return;
      await nativeWindow.setMinSize(new LogicalSize(Math.min(320, maxWidth), Math.min(360, maxHeight)));
      if (await nativeWindow.isMaximized() || !active) return;
      await nativeWindow.setSize(new LogicalSize(Math.min(520, maxWidth), Math.min(580, maxHeight)));
    };
    void fit().catch(() => {});
    return () => { active = false; };
  }, []);
  return <div ref={attach} className="native-dock-host">{target && createPortal(<FloatingFocus {...props}
    isWidget />, target)}</div>;
}

export default function NativeSurface({ dock, onToggle, focusProps, children }: {
  dock: boolean; onToggle?: () => void; focusProps: FloatingFocusProps; children: ReactNode;
}) {
  const { language } = useI18n();
  const vi = language === 'vi';
  const [error, setError] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const companion = useCompanionSetup();
  const appUpdate = usePeriodicCheck(true, availableAppUpdate, APP_CHECK_DELAY_MS, APP_CHECK_EVERY_MS);
  const companionOld = usePeriodicCheck(!nativeCompanionPreviewEnabled() && Boolean(__KORA_COMPANION_VERSION__), companionOutdated, 5_000, COMPANION_CHECK_EVERY_MS);
  // Updating from the note retires it for this session; the next check shows it again only if a browser is still behind.
  const [companionHandled, setCompanionHandled] = useState(false);
  const updateCompanion = () => { setCompanionHandled(true); void companion.run(); };
  const appBadge = Boolean(appUpdate);
  const updateLabel = appBadge ? (vi ? 'Có bản cập nhật Kora' : 'Kora update ready') : (vi ? 'Cập nhật Kora' : 'Update Kora');
  const notices = [
    ...(appUpdate ? [{ key: `app:${appUpdate}`, message: vi ? 'Đã có bản cập nhật Kora.' : 'A Kora update is ready.',
      action: vi ? 'Cập nhật' : 'Update', onAction: () => setUpdateOpen(true) }] : []),
    ...(companionOld && !companionHandled ? [{ key: `companion:${__KORA_COMPANION_VERSION__}`,
      message: vi ? 'Music Companion trong trình duyệt có bản mới.' : 'Your browser’s Music Companion has an update.',
      action: vi ? 'Cập nhật' : 'Update', onAction: updateCompanion }] : []),
  ];
  const notice = <UpdateNotice items={notices} laterLabel={vi ? 'Để sau' : 'Later'} />;
  const effectQueue = useRef(Promise.resolve());
  useEffect(() => {
    // Serialize surface changes so an older backdrop request cannot overwrite
    // the normal Tasks window after a rapid Dock → Tasks switch.
    effectQueue.current = effectQueue.current.then(async () => {
      // The native command owns both enabling and clearing the material. A
      // webview remount must not clear frost while its shape remains cached.
      await updateNativeShape(dock);
    }).catch(() => {}); // Unsupported effects retain the CSS glass fallback.
  }, [dock]);
  useEffect(() => {
    // Tasks is a normal app window; only the compact dock stays above other apps.
    void getCurrentWindow().setAlwaysOnTop(dock).catch(() =>
      setError(vi ? 'Không thể cập nhật cửa sổ.' : 'Window action failed.'));
  }, [dock, vi]);
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    const nativeWindow = getCurrentWindow();
    const update = async () => {
      const next = await nativeWindow.isMaximized();
      if (active) setMaximized(next);
    };
    void update().catch(() => {});
    void nativeWindow.onResized(() => {
      void update().catch(() => {});
      void updateNativeShape(dock).catch(() => {});
    }).then((stop) => {
      if (active) unlisten = stop; else stop();
    }).catch(() => {});
    return () => { active = false; unlisten?.(); };
  }, [dock]);
  useEffect(() => {
    document.documentElement.dataset.nativeSurface = dock ? 'dock' : 'workspace';
    if (!dock) {
      void getCurrentWindow().setMinSize(new LogicalSize(560, 540)).catch(() => {});
      void getCurrentWindow().setSize(new LogicalSize(1100, 780)).catch(() => {});
    }
    return () => { delete document.documentElement.dataset.nativeSurface;
      document.documentElement.style.removeProperty('--native-dock-radius'); };
  }, [dock]);
  const action = (fn: () => Promise<unknown>) => { void fn().catch(() => setError(vi ? 'Không thể cập nhật cửa sổ.' : 'Window action failed.')); };
  const toggleMaximize = () => action(async () => {
    await getCurrentWindow().toggleMaximize();
    setMaximized(await getCurrentWindow().isMaximized());
  });
  const switchSurface = () => action(async () => {
    // Return to a compact dock, not a monitor-sized transparent window.
    if (await getCurrentWindow().isMaximized()) await getCurrentWindow().unmaximize();
    onToggle?.();
  });
  const maximizeLabel = maximized ? (vi ? 'Khôi phục' : 'Restore') : (vi ? 'Phóng to' : 'Maximize');
  return <div className={`native-surface native-${dock ? 'dock' : 'workspace'}`}>
    {!dock && <div className="native-chrome">
      <span data-tauri-drag-region onPointerDown={(event) => {
        if (event.button === 0) action(() => getCurrentWindow().startDragging());
      }} onDoubleClick={toggleMaximize}>Kora</span>
      {onToggle && <button type="button" onClick={switchSurface}>Dock</button>}
      <button type="button" className={appBadge ? 'native-update-badge' : undefined} aria-label={updateLabel} title={updateLabel} onClick={() => setUpdateOpen(true)}>{vi ? 'Cập nhật' : 'Update'}</button>
      <button type="button" aria-label={vi ? 'Thu nhỏ' : 'Minimize'} onClick={() => action(() => getCurrentWindow().minimize())}>−</button>
      <button type="button" aria-label={maximizeLabel} title={maximizeLabel} onClick={toggleMaximize}>{maximized ? '❐' : '□'}</button>
      <button type="button" aria-label={vi ? 'Đóng ứng dụng' : 'Close app'} onClick={() => action(() => getCurrentWindow().close())}>×</button>
    </div>}
    {dock ? <>
      <div className="native-dock-scroll"><NativeDock props={{ ...focusProps, onReturnToTab: onToggle ? switchSurface : undefined,
        returnLabel: vi ? 'Công việc' : 'Tasks',
        onDragStart: () => action(() => getCurrentWindow().startDragging()),
        onMusicSetup: nativeCompanionPreviewEnabled()?undefined:() => void companion.run(),
        musicSetupPending: companion.updating,
        musicSetupMessage: companion.message,
        musicSetupFolder: companion.folder,
        nativeControls: <>
          <button className={`dock-icon-button${appBadge ? ' dock-update-badge' : ''}`} type="button" aria-label={updateLabel} title={updateLabel} onClick={() => setUpdateOpen(true)}>↓</button>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Thu nhỏ' : 'Minimize'} onClick={() => action(() => getCurrentWindow().minimize())}>−</button>
          <button className="dock-icon-button" type="button" aria-label={maximizeLabel} title={maximizeLabel} onClick={toggleMaximize}>{maximized ? '❐' : '□'}</button>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Đóng ứng dụng' : 'Close app'} onClick={() => action(() => getCurrentWindow().close())}>×</button>
        </>,
      }} /></div>
      {error && <p role="status" className="native-error">{error}</p>}
      {notice}
    </> : <><div className="native-workspace-content">{children}</div>{notice}</>}
    {updateOpen && <NativeUpdateDialog onClose={() => setUpdateOpen(false)} />}
  </div>;
}
