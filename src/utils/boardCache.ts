import type { BoardData } from '../types/task.type';

const boardCacheKey = 'kanban_board_cache';

export interface BoardCachePayload {
  boardId: string | null;
  boardData: BoardData;
}

export function readBoardCache(): BoardCachePayload | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const cachedValue = window.localStorage.getItem(boardCacheKey);

  if (!cachedValue) {
    return null;
  }

  try {
    return JSON.parse(cachedValue) as BoardCachePayload;
  } catch {
    return null;
  }
}

export function writeBoardCache(cachePayload: BoardCachePayload) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(boardCacheKey, JSON.stringify(cachePayload));
}
