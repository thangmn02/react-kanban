import type { ReactNode } from 'react';

import BoardHeader from '../../components/board/BoardHeader';
import BoardToolbar from '../../components/board/BoardToolbar';
import ErrorState from '../../components/atoms/ErrorState';
import type { AppLayoutRouteContext } from '../../app/AppLayoutRouteContext';

export default function BoardChrome({ context, children }: { context: AppLayoutRouteContext; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      {context.header}
      <BoardHeader {...context.board.header} />
      {(context.isBoardLoading || context.isSavingBoard) && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {context.isBoardLoading ? 'Loading board data from Supabase...' : 'Saving changes...'}
        </div>
      )}
      {context.boardErrorMessage && (
        <div className="px-4 py-3">
          <ErrorState
            title="Couldn't load this board"
            description="We couldn't load the board data. Check your connection and try again."
            details={context.boardErrorMessage}
            onRetry={context.onRetryBoard}
            isRetrying={context.isRetryingBoard}
            compact
          />
        </div>
      )}
      <BoardToolbar {...context.board.toolbar} />
      {children}
    </div>
  );
}
