import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import FloatingFocus, { type FloatingFocusProps } from '../../components/focus/FloatingFocus';
import type { DockStyle } from '../../components/focus/useDockPreferences';
import dockCss from '../../components/focus/floatingFocus.css?inline';
import { enableNativeAudio } from './nativeMusic';
import { useI18n } from '../../i18n';
import './nativeSurface.css';

function NativeDock({ props }: { props: FloatingFocusProps }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const resize = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const maxSize = useRef({ width: 1100, height: 900 });
  const [layout, setLayout] = useState({ style: 'island' as DockStyle, expanded: false });
  const layoutChanged = useCallback((style: DockStyle, expanded: boolean) => setLayout((current) =>
    current.style === style && current.expanded === expanded ? current : { style, expanded }), []);
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
    style.textContent = `${dockCss}\n:host{display:block;width:100%}.floating-focus{box-shadow:none;max-width:none}.dock-style-name{user-select:none}`;
    const root = document.createElement('div');
    shadow.replaceChildren(style, root);
    setTarget(root);
    return () => { clearTimeout(resize.current); shadow.replaceChildren(); };
  }, []);
  useEffect(() => {
    // Size changes do not remount FloatingFocus or its shared motion elements.
    const width = layout.style === 'split' ? 760 : layout.style === 'mixer' ? 640
      : layout.style === 'deck' && layout.expanded ? 820 : 520;
    void getCurrentWindow().setMinSize(new LogicalSize(360, 180)).catch(() => {});
    void getCurrentWindow().setSize(new LogicalSize(Math.min(width, maxSize.current.width), window.innerHeight)).catch(() => {});
  }, [layout]);
  useEffect(() => {
    if (!target) return;
    const observer = new ResizeObserver(() => {
      clearTimeout(resize.current);
      resize.current = setTimeout(() => {
        const height = Math.max(180, Math.min(maxSize.current.height, Math.ceil(target.getBoundingClientRect().height + 32)));
        if (Math.abs(window.innerHeight - height) > 2) void getCurrentWindow().setSize(new LogicalSize(window.innerWidth, height)).catch(() => {});
      }, 400);
    });
    observer.observe(target);
    return () => { observer.disconnect(); clearTimeout(resize.current); };
  }, [target]);
  return <div ref={attach} className="native-dock-host">{target && createPortal(<FloatingFocus {...props}
    isWidget onLayoutChange={layoutChanged} />, target)}</div>;
}

export default function NativeSurface({ dock, onToggle, focusProps, children }: {
  dock: boolean; onToggle?: () => void; focusProps: FloatingFocusProps; children: ReactNode;
}) {
  const { language } = useI18n();
  const vi = language === 'vi';
  const [enabled, setEnabled] = useState(() => localStorage.getItem('native.systemAudio') === 'true');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void enableNativeAudio(enabled).catch(() => { if (active) setError(vi ? 'Không thể nghe âm thanh hệ thống.' : 'System audio is unavailable.'); });
    return () => { active = false; };
  }, [enabled, vi]);
  useEffect(() => {
    document.documentElement.dataset.nativeSurface = dock ? 'dock' : 'workspace';
    if (!dock) {
      void getCurrentWindow().setMinSize(new LogicalSize(560, 540)).catch(() => {});
      void getCurrentWindow().setSize(new LogicalSize(1100, 780)).catch(() => {});
    }
    return () => { delete document.documentElement.dataset.nativeSurface; };
  }, [dock]);
  const action = (fn: () => Promise<unknown>) => { void fn().catch(() => setError(vi ? 'Không thể cập nhật cửa sổ.' : 'Window action failed.')); };
  return <div className={`native-surface native-${dock ? 'dock' : 'workspace'}`}>
    {!dock && <div className="native-chrome">
      <span data-tauri-drag-region onPointerDown={(event) => {
        if (event.button === 0) action(() => getCurrentWindow().startDragging());
      }}>Kanban Focus</span>
      {onToggle && <button type="button" onClick={onToggle}>{dock ? (vi ? 'Công việc' : 'Tasks') : 'Dock'}</button>}
      <button type="button" aria-label={vi ? 'Thu nhỏ' : 'Minimize'} onClick={() => action(() => getCurrentWindow().minimize())}>−</button>
      <button type="button" aria-label={vi ? 'Đóng ứng dụng' : 'Close app'} onClick={() => action(() => getCurrentWindow().close())}>×</button>
    </div>}
    {dock ? <>
      <div className="native-dock-scroll"><NativeDock props={{ ...focusProps, onReturnToTab: onToggle,
        returnLabel: vi ? 'Công việc' : 'Tasks',
        onDragStart: () => action(() => getCurrentWindow().startDragging()),
        nativeControls: <>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Thu nhỏ' : 'Minimize'} onClick={() => action(() => getCurrentWindow().minimize())}>−</button>
          <button className="dock-icon-button" type="button" aria-label={vi ? 'Đóng ứng dụng' : 'Close app'} onClick={() => action(() => getCurrentWindow().close())}>×</button>
        </>,
      }} /></div>
      <label className="native-audio-switch" title={vi ? 'Nghe âm thanh từ mọi ứng dụng. Không lưu hoặc gửi âm thanh.' : 'Listens to all apps on your default output. Audio is not saved or sent.'}>
        <input type="checkbox" checked={enabled} onChange={(event) => {
          setError(''); setEnabled(event.target.checked); localStorage.setItem('native.systemAudio', String(event.target.checked));
        }} />{vi ? 'Nhịp từ âm thanh hệ thống' : 'System audio beats'}
      </label>
      {error && <p role="status" className="native-error">{error}</p>}
    </> : <div className="native-workspace-content">{children}</div>}
  </div>;
}
