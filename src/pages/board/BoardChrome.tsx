import type { ReactNode } from 'react';

import BoardHeader from '../../components/board/BoardHeader';
import BoardToolbar from '../../components/board/BoardToolbar';
import ErrorState from '../../components/atoms/ErrorState';
import type { AppLayoutRouteContext } from '../../app/AppLayoutRouteContext';
import { resolveTaskWorkflow } from '../../features/task/model/task-workflow';
import { useI18n } from '../../i18n';

export default function BoardChrome({ context, children }: { context: AppLayoutRouteContext; children: ReactNode }) {
  const { t } = useI18n();
  const workflow = resolveTaskWorkflow(context.board.kanban.boardData.columns.map((id,position)=>({id,title:context.board.kanban.boardData.list[id].title,position})));
  return (
    <div className="min-h-screen bg-canvas">
      {context.header}
      <BoardHeader {...context.board.header} />
      {(context.isBoardLoading || context.isSavingBoard) && (
        <div role="status" className="border-b border-gray-200 bg-white px-4 py-2 text-sm text-gray-600">
          {t(context.isBoardLoading ? 'load.board' : 'load.saving')}
        </div>
      )}
      {context.boardErrorMessage && (
        <div className="px-4 py-3">
          <ErrorState
            title={t('load.boardError')}
            description={t('load.connectionHint')}
            details={context.boardErrorMessage}
            onRetry={context.onRetryBoard}
            isRetrying={context.isRetryingBoard}
            compact
          />
        </div>
      )}
      <BoardToolbar {...context.board.toolbar} />
      {workflow.mode === 'completion-only' && <p role="note" className="px-4 py-2 text-xs text-slate-600 sm:px-6">{t('board.noDoneList')}</p>}
      <div aria-busy={context.isBoardLoading} inert={context.isBoardLoading || Boolean(context.boardErrorMessage)}>{children}</div>
    </div>
  );
}
