import { useI18n } from '../../i18n';
import { LOCAL_MOCK_WORKSPACE_ID, LOCAL_SAMPLE_BOARD_ID, localCreateSampleBoard } from '../../infrastructure/local/localBoardStore';

interface Props { localPreview: boolean; onAddTask?: () => void; primaryButton: string; quietButton: string }

/** Empty-workspace Home. One primary action; the sample exists only if someone asks for it, and only locally. */
export default function FirstRunCard({ localPreview, onAddTask, primaryButton, quietButton }: Props) {
  const { t } = useI18n();
  const startSample = () => {
    localCreateSampleBoard();
    window.location.assign(`/workspaces/${LOCAL_MOCK_WORKSPACE_ID}/boards/${LOCAL_SAMPLE_BOARD_ID}`);
  };
  return <section aria-labelledby="first-run-title" className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
    <h2 id="first-run-title" className="text-xl font-semibold tracking-tight text-slate-950">{t('home.firstRun.title')}</h2>
    <p className="mt-2 max-w-prose text-sm leading-6 text-slate-600">{t(localPreview ? 'home.firstRun.localDescription' : 'home.firstRun.description')}</p>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {localPreview ? <>
        <button type="button" className={primaryButton} onClick={startSample}>{t('home.firstRun.sample')}</button>
        {onAddTask && <button type="button" className={quietButton} onClick={onAddTask}>{t('home.firstRun.addTask')}</button>}
      </> : onAddTask && <button type="button" className={primaryButton} onClick={onAddTask}>{t('home.firstRun.addTask')}</button>}
    </div>
  </section>;
}
