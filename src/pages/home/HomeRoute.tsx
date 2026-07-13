import HomeDashboard from '../../components/organisms/HomeDashboard';
import ErrorState from '../../components/atoms/ErrorState';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function HomeRoute() {
  const context = useAppLayoutRouteContext();
  return (
    <div className="min-h-screen bg-canvas">
      {context.header}
      {(context.isBoardLoading || context.isSavingBoard) && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {context.isBoardLoading ? 'Preparing board data...' : 'Saving changes...'}
        </div>
      )}
      {context.workspaceErrorMessage && (
        <div className="px-4 py-3">
          <ErrorState
            title="Couldn't load your workspace"
            description="We couldn't load your workspace data. Check your connection and try again."
            details={context.workspaceErrorMessage}
            onRetry={context.onRetryWorkspace}
            isRetrying={context.isRetryingWorkspace}
            compact
          />
        </div>
      )}
      <HomeDashboard {...context.home} />
    </div>
  );
}
