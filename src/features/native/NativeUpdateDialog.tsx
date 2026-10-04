import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useI18n } from '../../i18n';

export default function NativeUpdateDialog({ onClose }: { onClose: () => void }) {
  const { language } = useI18n();
  const vi = language === 'vi';
  const dialog = useRef<HTMLDialogElement>(null);
  const update = useRef<Update | null>(null);
  const alive = useRef(true);
  const busy = useRef(false);
  const [phase, setPhase] = useState<'checking' | 'current' | 'available' | 'installing' | 'error'>('checking');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState<number | undefined>();

  const checkNow = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('checking');
    try {
      const next = await check({ timeout: 15_000 });
      if (!alive.current) { await next?.close(); return; }
      update.current = next;
      setVersion(next?.version ?? '');
      setPhase(next ? 'available' : 'current');
    } catch {
      if (alive.current) setPhase('error');
    } finally { busy.current = false; }
  };

  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    void checkNow();
    return () => {
      alive.current = false;
      void update.current?.close().catch(() => {});
      update.current = null;
    };
    // One check per opened dialog; language changes must not restart a download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = async () => {
    if (busy.current || !update.current) return;
    busy.current = true;
    setPhase('installing');
    setProgress(undefined);
    let received = 0;
    let total = 0;
    try {
      // Tauri verifies the signature before running the passive Windows installer.
      await update.current.downloadAndInstall((event) => {
        if (!alive.current) return;
        if (event.event === 'Started') total = event.data.contentLength ?? 0;
        if (event.event === 'Progress') received += event.data.chunkLength;
        if (event.event === 'Finished') setProgress(100);
        else if (total > 0) setProgress(Math.min(100, Math.round(received / total * 100)));
      }, { timeout: 120_000, restartAfterInstall: true });
    } catch {
      await update.current?.close().catch(() => {});
      update.current = null;
      if (alive.current) setPhase('error');
    } finally { busy.current = false; }
  };

  return createPortal(<dialog ref={dialog} className="native-update-dialog" aria-labelledby="native-update-title"
    onCancel={(event) => { event.preventDefault(); if (phase !== 'installing') onClose(); }}>
    <h2 id="native-update-title">{vi ? 'Cập nhật Kora' : 'Update Kora'}</h2>
    <p role="status" aria-live="polite">
      {phase === 'checking' && (vi ? 'Đang kiểm tra…' : 'Checking for updates…')}
      {phase === 'current' && (vi ? 'Bạn đang dùng phiên bản mới nhất.' : 'Kora is up to date.')}
      {phase === 'available' && `${vi ? 'Có phiên bản' : 'Version available:'} ${version}`}
      {phase === 'installing' && (vi ? 'Đang tải và cài đặt…' : 'Downloading and installing…')}
      {phase === 'error' && (vi ? 'Không thể cập nhật. Kiểm tra kết nối và thử lại.' : 'Update failed. Check your connection and try again.')}
    </p>
    {phase === 'available' && <p>{vi ? 'Lưu công việc trước khi cập nhật. Kora sẽ khởi động lại.' : 'Save your work first. Kora will restart.'}</p>}
    {phase === 'installing' && <progress aria-label={vi ? 'Tiến độ cập nhật' : 'Update progress'} max={100} value={progress} />}
    <div className="native-update-actions">
      <button type="button" disabled={phase === 'installing'} onClick={onClose}>{vi ? 'Đóng' : 'Close'}</button>
      {phase === 'available' && <button type="button" onClick={() => void install()}>{vi ? 'Cập nhật và khởi động lại' : 'Update and restart'}</button>}
      {phase === 'error' && <button type="button" onClick={() => void checkNow()}>{vi ? 'Thử lại' : 'Retry'}</button>}
    </div>
  </dialog>, document.body);
}
