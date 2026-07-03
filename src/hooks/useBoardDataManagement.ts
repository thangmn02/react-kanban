import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { notify } from '../components/organisms/toast/notify';

import { data } from '../data';
import type { AuthMode } from '../types/auth.type';
import type { BoardData } from '../types/task.type';
import type { BoardRow } from '../types/supabase.type';
import { fetchBoardSnapshot, fetchBoards } from '../services/board.service';
import { readBoardCache, writeBoardCache } from '../utils/boardCache';
import { useTaskRealtime } from './useTaskRealtime';
import { useDueDateReminder } from './useDueDateReminder';

export interface UseBoardDataManagementParams {
  authMode: AuthMode;
  activeWorkspaceId: string | null;
  userId: string | undefined;
}

export interface UseBoardDataManagementResult {
  boardData: BoardData;
  setBoardData: Dispatch<SetStateAction<BoardData>>;
  activeBoardId: string | null;
  setActiveBoardId: Dispatch<SetStateAction<string | null>>;
  activeBoardIdRef: MutableRefObject<string | null>;
  boardSummaries: BoardRow[];
  setBoardSummaries: Dispatch<SetStateAction<BoardRow[]>>;
  activeBoardSummary: BoardRow | null;
  isBoardLoading: boolean;
  setIsBoardLoading: Dispatch<SetStateAction<boolean>>;
  isSavingBoard: boolean;
  setIsSavingBoard: Dispatch<SetStateAction<boolean>>;
  boardErrorMessage: string | null;
  initialBoardId: string | null;
  refreshBoardData: (args?: { boardId?: string | null; showErrorToast?: boolean }) => Promise<void>;
  refreshBoardList: () => Promise<BoardRow[]>;
  syncBoardCache: (boardId: string | null, boardData: BoardData) => void;
}

export function useBoardDataManagement({
  authMode,
  activeWorkspaceId,
  userId,
}: UseBoardDataManagementParams): UseBoardDataManagementResult {
  const cachedBoard = useMemo(() => readBoardCache(), []);
  const initialBoardId = cachedBoard?.boardId || null;
  const [boardData, setBoardData] = useState<BoardData>(() => cachedBoard?.boardData || data);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => initialBoardId);
  const [boardSummaries, setBoardSummaries] = useState<BoardRow[]>([]);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [boardErrorMessage, setBoardErrorMessage] = useState<string | null>(null);
  const activeBoardIdRef = useRef<string | null>(initialBoardId);
  const activeBoardSummary = useMemo(() => (
    boardSummaries.find((boardSummary) => boardSummary.id === activeBoardId) || null
  ), [boardSummaries, activeBoardId]);

  const syncBoardCache = useCallback((nextBoardId: string | null, nextBoardData: BoardData) => {
    writeBoardCache({
      boardId: nextBoardId,
      boardData: nextBoardData,
    });
  }, []);

  const refreshBoardList = useCallback(async () => {
    const boardRows = await fetchBoards(activeWorkspaceId);
    setBoardSummaries(boardRows);
    return boardRows;
  }, [activeWorkspaceId]);

  const refreshBoardData = useCallback(async ({
    boardId,
    showErrorToast = false,
  }: {
    boardId?: string | null;
    showErrorToast?: boolean;
  } = {}) => {
    try {
      if (authMode === 'supabase' && !activeWorkspaceId) {
        setIsBoardLoading(false);
        return;
      }

      const boardSnapshot = await fetchBoardSnapshot(
        boardId === undefined ? activeBoardIdRef.current : boardId,
        activeWorkspaceId,
        userId,
        { seedIfMissing: authMode === 'mock' },
      );

      activeBoardIdRef.current = boardSnapshot.boardId;
      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
      setBoardErrorMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch board data from Supabase.';

      setBoardErrorMessage(message);

      if (showErrorToast) {
        notify.error(message);
      }
    } finally {
      setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, authMode, syncBoardCache, userId]);

  useEffect(() => {
    activeBoardIdRef.current = activeBoardId;
  }, [activeBoardId]);

  useEffect(() => {
    syncBoardCache(activeBoardId, boardData);
  }, [activeBoardId, boardData, syncBoardCache]);

  useTaskRealtime({
    boardId: activeBoardId,
    setBoardData,
    refreshBoardData,
  });
  useDueDateReminder(boardData);

  return {
    boardData,
    setBoardData,
    activeBoardId,
    setActiveBoardId,
    activeBoardIdRef,
    boardSummaries,
    setBoardSummaries,
    activeBoardSummary,
    isBoardLoading,
    setIsBoardLoading,
    isSavingBoard,
    setIsSavingBoard,
    boardErrorMessage,
    initialBoardId,
    refreshBoardData,
    refreshBoardList,
    syncBoardCache,
  };
}
