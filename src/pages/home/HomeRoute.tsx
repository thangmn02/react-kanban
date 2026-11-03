import HomeDashboard from '../../components/organisms/HomeDashboard';
import ErrorState from '../../components/atoms/ErrorState';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import { useI18n } from '../../i18n';

export default function HomeRoute() {
  const context = useAppLayoutRouteContext();
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-canvas">
      {context.header}
      {(context.isBoardLoading || context.isSavingBoard) && (
        <div role="status" className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {t(context.isBoardLoading ? 'load.home' : 'load.saving')}
        </div>
      )}
      {context.workspaceErrorMessage && (
        <div className="px-4 py-3">
          <ErrorState
            title={t('load.workspaceError')}
            description={t('load.connectionHint')}
            details={context.workspaceErrorMessage}
            onRetry={context.onRetryWorkspace}
            isRetrying={context.isRetryingWorkspace}
            compact
          />
        </div>
      )}
      <HomeDashboard {...context.home} refreshKey={context.isSavingBoard} taskRevision={context.board.kanban.boardData.task} />
    </div>
  );
}
