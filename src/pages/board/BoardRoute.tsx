import KanbanBoard from '../../components/organisms/KanbanBoard';
import BoardEmptyState from '../../components/board/BoardEmptyState';
import { SkeletonBoardColumn } from '../../components/atoms/skeleton';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import BoardChrome from './BoardChrome';

export default function BoardRoute() {
  const context = useAppLayoutRouteContext();
  const content = !context.board.hasActiveBoard
    ? <BoardEmptyState {...context.board.empty} />
    : context.isBoardLoading && context.board.kanban.boardData.columns.length === 0
      ? (
        <div className="bg-canvas p-6" aria-busy="true">
          <div className="flex items-start gap-5 overflow-x-auto pb-6 pt-1">
            {Array.from({ length: 3 }).map((_, index) => <SkeletonBoardColumn key={index} />)}
          </div>
        </div>
      )
      : <KanbanBoard {...context.board.kanban} />;
  return <BoardChrome context={context}>{content}</BoardChrome>;
}
