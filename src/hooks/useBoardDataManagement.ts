import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { notify } from '../components/organisms/toast/notify';

import { data } from '../data';
import type { AuthMode } from '../types/auth.type';
import type { BoardData } from '../types/task.type';
import type { BoardRow } from '../types/supabase.type';
import { fetchBoardSnapshot, fetchBoards } from '../services/board.service';
import { readBoardCache, writeBoardCache } from '../utils/boardCache';
import type { StorageScope } from '../shared/storage/storageAdapter';
import { useTaskRealtime } from './useTaskRealtime';
import { useDueDateReminder } from './useDueDateReminder';
import { TASK_WORKFLOW_CHANGED } from '../services/task-workflow.service';

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
  refreshBoardData: (args?: { boardId?: string | null; showErrorToast?: boolean; signal?: AbortSignal }) => Promise<void>;
  refreshBoardList: () => Promise<BoardRow[]>;
  syncBoardCache: (boardId: string | null, boardData: BoardData) => void;
}

export function useBoardDataManagement({
  authMode,
  activeWorkspaceId,
  userId,
}: UseBoardDataManagementParams): UseBoardDataManagementResult {
  const storageScope: StorageScope = useMemo(() => ({
    userId: userId ?? 'mock-user',
    workspaceId: activeWorkspaceId,
  }), [userId, activeWorkspaceId]);
  const liveScope=useRef(storageScope);
  useLayoutEffect(()=>{liveScope.current=storageScope;},[storageScope]);
  const cachedBoard = useMemo(() => (
    authMode === 'mock' || userId ? readBoardCache(storageScope) : null
  ), [authMode, storageScope, userId]);
  const initialBoardId = cachedBoard?.boardId || null;
  const [boardData, setBoardData] = useState<BoardData>(() => (
    cachedBoard?.boardData || (authMode === 'mock' ? data : { columns: [], list: {}, task: {} })
  ));
  const [loadedScope, setLoadedScope] = useState<StorageScope | null>(null);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => initialBoardId);
  const [boardSummaries, setBoardSummaries] = useState<BoardRow[]>([]);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [savingState,setSavingState]=useState({scope:storageScope,value:false});
  const isSavingBoard=savingState.scope===storageScope&&savingState.value;
  const setIsSavingBoard=useCallback<Dispatch<SetStateAction<boolean>>>(value=>{
    if(liveScope.current!==storageScope)return;
    setSavingState(current=>({scope:storageScope,value:typeof value==='function'?value(current.scope===storageScope&&current.value):value}));
  },[storageScope]);
  const [boardErrorMessage, setBoardErrorMessage] = useState<string | null>(null);
  const activeBoardIdRef = useRef<string | null>(initialBoardId);
  const snapshotRequest = useRef(0);
  const listRequest = useRef(0);
  useEffect(() => () => { snapshotRequest.current += 1; listRequest.current += 1; }, [storageScope]);
  const activeBoardSummary = useMemo(() => (
    boardSummaries.find((boardSummary) => boardSummary.id === activeBoardId) || null
  ), [boardSummaries, activeBoardId]);

  const syncBoardCache = useCallback((nextBoardId: string | null, nextBoardData: BoardData) => {
    if(liveScope.current!==storageScope)return;
    writeBoardCache(storageScope, {
      boardId: nextBoardId,
      boardData: nextBoardData,
    });
  }, [storageScope]);

  const refreshBoardList = useCallback(async () => {
    if(liveScope.current!==storageScope)return [];
    const request = ++listRequest.current;
    const boardRows = await fetchBoards(activeWorkspaceId);
    if (request === listRequest.current&&liveScope.current===storageScope) setBoardSummaries(boardRows);
    return boardRows;
  }, [activeWorkspaceId,storageScope]);

  const refreshBoardData = useCallback(async ({
    boardId,
    showErrorToast = false,
    signal,
  }: {
    boardId?: string | null;
    showErrorToast?: boolean;
    signal?: AbortSignal;
  } = {}) => {
    if(liveScope.current!==storageScope)return;
    const request = ++snapshotRequest.current;
    const isCurrent = () => request === snapshotRequest.current && !signal?.aborted && liveScope.current===storageScope;
    setIsBoardLoading(true);
    try {
      if (authMode === 'supabase' && (!activeWorkspaceId || !userId)) {
        setIsBoardLoading(false);
        return;
      }

      const boardSnapshot = await fetchBoardSnapshot(
        boardId === undefined ? activeBoardIdRef.current : boardId,
        activeWorkspaceId,
        userId,
        { seedIfMissing: authMode === 'mock' },
      );
      if (!isCurrent()) return;

      activeBoardIdRef.current = boardSnapshot.boardId;
      setActiveBoardId(boardSnapshot.boardId);
      setBoardData(boardSnapshot.boardData);
      syncBoardCache(boardSnapshot.boardId, boardSnapshot.boardData);
      setBoardErrorMessage(null);
      setLoadedScope(storageScope);
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof Error ? error.message : 'Unable to fetch board data from Supabase.';

      setBoardErrorMessage(message);

      if (showErrorToast) {
        notify.error(message);
      }
    } finally {
      if (isCurrent()) setIsBoardLoading(false);
    }
  }, [activeWorkspaceId, authMode, storageScope, syncBoardCache, userId]);

  useEffect(() => {
    activeBoardIdRef.current = activeBoardId;
  }, [activeBoardId]);

  useEffect(() => {
    if (loadedScope===storageScope&&!isSavingBoard && !boardErrorMessage) syncBoardCache(activeBoardId, boardData);
  }, [activeBoardId, boardData, syncBoardCache, isSavingBoard, boardErrorMessage,loadedScope,storageScope]);

  useTaskRealtime({
    boardId: activeBoardId,
    setBoardData,
    refreshBoardData,
  });
  useEffect(() => {
    const reconcile = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.workspaceId === activeWorkspaceId && detail?.boardId === activeBoardIdRef.current) void refreshBoardData();
    };
    const storage = (event: StorageEvent) => { if (event.key?.endsWith(':board_store:v1')) void refreshBoardData(); };
    window.addEventListener(TASK_WORKFLOW_CHANGED, reconcile);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(TASK_WORKFLOW_CHANGED, reconcile); window.removeEventListener('storage', storage); };
  }, [activeWorkspaceId, refreshBoardData]);
  // Cached or demo tasks must not notify before this user's workspace loads.
  useDueDateReminder(boardData, loadedScope === storageScope && !isBoardLoading && !boardErrorMessage
    && (authMode === 'mock' || Boolean(userId && activeWorkspaceId)));

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
