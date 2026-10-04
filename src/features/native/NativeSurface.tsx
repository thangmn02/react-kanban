import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import FloatingFocus, { type FloatingFocusProps } from '../../components/focus/FloatingFocus';
import type { DockStyle } from '../../components/focus/useDockPreferences';
import dockCss from '../../components/focus/floatingFocus.css?inline';
import nativeDockCss from './nativeDock.css?inline';
import { useI18n } from '../../i18n';
import './nativeSurface.css';
import NativeUpdateDialog from './NativeUpdateDialog';

async function updateNativeShape(rounded: boolean) {
  const radius = await invoke<number>('native_dock_shape', { rounded });
  if (Number.isFinite(radius)) document.documentElement.style.setProperty('--native-dock-radius', `${radius}px`);
  // Older Windows versions do not expose compositor corner clipping.
  // Keep their rounded transparent CSS surface instead of a square backdrop.
  if (rounded && radius === 22) await getCurrentWindow().clearEffects();
}

function NativeDock({ props }: { props: FloatingFocusProps }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const maxSize = useRef({ width: 1100, height: 900 });
  const [layout, setLayout] = useState({ style: 'island' as DockStyle, expanded: false, hasMusic: false });
  const layoutChanged = useCallback((style: DockStyle, expanded: boolean, hasMusic = false) => setLayout((current) =>
    current.style === style && current.expanded === expanded && current.hasMusic === hasMusic ? current : { style, expanded, hasMusic }), []);
  useEffect(() => {
    void currentMonitor().then((monitor) => {
      if (monitor) maxSize.current = { width: monitor.workArea.size.width / monitor.scaleFactor,
        height: monitor.workArea.size.height / monitor.scaleFactor };
    }).catch(() => {});
  }, []);
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
    // Size changes do not remount FloatingFocus or its shared motion elements.
    const width = layout.style === 'split' ? 760 : layout.style === 'mixer' ? 640
      : layout.style === 'deck' && layout.expanded ? 820 : 520;
    const height = !layout.hasMusic ? 240 : layout.style === 'island' ? 460 : layout.style === 'tabs' ? 380 : 460;
    let active = true;
    const fit = async () => {
      const nativeWindow = getCurrentWindow();
      await nativeWindow.setMinSize(new LogicalSize(360, layout.hasMusic ? 320 : 200));
      if (await nativeWindow.isMaximized() || !active) return;
      await nativeWindow.setSize(new LogicalSize(Math.min(width, maxSize.current.width), Math.min(height, maxSize.current.height)));
    };
    void fit().catch(() => {});
    return () => { active = false; };
  }, [layout]);
  return <div ref={attach} className="native-dock-host">{target && createPortal(<FloatingFocus {...props}
    isWidget onLayoutChange={layoutChanged} />, target)}</div>;
}

export default function NativeSurface({ dock, onToggle, focusProps, children }: {
  dock: boolean; onToggle?: () => void; focusProps: FloatingFocusProps; children: ReactNode;
}) {
  const { language } = useI18n();
  const vi = language === 'vi';
  const [error, setError] = useState('');
  const [maximized, setMaximized] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const effectQueue = useRef(Promise.resolve());
  useEffect(() => {
    // Serialize surface changes so an older backdrop request cannot overwrite
    // the normal Tasks window after a rapid Dock → Tasks switch.
    effectQueue.current = effectQueue.current.then(async () => {
      const window = getCurrentWindow();
      // The native command owns modern DWM glass and its light tint. Remove
      // legacy accent effects first: they turn clear during native dragging.
      await window.clearEffects().catch(() => {});
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
      <button type="button" onClick={() => setUpdateOpen(true)}>{vi ? 'Cập nhật' : 'Update'}</button>
      <button type="button" aria-label={vi ? 'Thu nhỏ' : 'Minimize'} onClick={() => action(() => getCurrentWindow().minimize())}>−</button>
      <button type="button" aria-label={maximizeLabel} title={maximizeLabel} onClick={toggleMaximize}>{maximized ? '❐' : '□'}</button>
      <button type="button" aria-label={vi ? 'Đóng ứng dụng' : 'Close app'} onClick={() => action(() => getCurrentWindow().close())}>×</button>
    </div>}
    {dock ? <>
      <div className="native-dock-scroll"><NativeDock props={{ ...focusProps, onReturnToTab: onToggle ? switchSurface : undefined,
        returnLabel: vi ? 'Công việc' : 'Tasks',
        onDragStart: () => action(() => getCurrentWindow().startDragging()),
        nativeControls: <>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Cập nhật Kora' : 'Update Kora'} title={vi ? 'Cập nhật Kora' : 'Update Kora'} onClick={() => setUpdateOpen(true)}>↓</button>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Thu nhỏ' : 'Minimize'} onClick={() => action(() => getCurrentWindow().minimize())}>−</button>
          <button className="dock-icon-button" type="button" aria-label={maximizeLabel} title={maximizeLabel} onClick={toggleMaximize}>{maximized ? '❐' : '□'}</button>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Đóng ứng dụng' : 'Close app'} onClick={() => action(() => getCurrentWindow().close())}>×</button>
        </>,
      }} /></div>
      {error && <p role="status" className="native-error">{error}</p>}
    </> : <div className="native-workspace-content">{children}</div>}
    {updateOpen && <NativeUpdateDialog onClose={() => setUpdateOpen(false)} />}
  </div>;
}
