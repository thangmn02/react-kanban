import type { BoardData } from '../types/task.type';
import {
  readScopedJSON,
  writeScopedJSON,
  writeGlobalJSON,
  type StorageScope,
} from '../shared/storage/storageAdapter';

export interface BoardCachePayload {
  boardId: string | null;
  boardData: BoardData;
  updatedAt?: string;
}

const BOARD_CACHE_FEATURE = 'board_cache';

/**
 * Reads the cached board snapshot from namespaced localStorage.
 * The key is scoped per user + workspace so switching accounts or
 * workspaces never leaks another context's cached board data.
 */
export function readBoardCache(scope: StorageScope): BoardCachePayload | null {
  return readScopedJSON<BoardCachePayload | null>(scope, BOARD_CACHE_FEATURE, null);
}

/**
 * Writes the board snapshot to namespaced localStorage.
 */
export function writeBoardCache(scope: StorageScope, cachePayload: BoardCachePayload): void {
  writeScopedJSON(scope, BOARD_CACHE_FEATURE, {
    ...cachePayload,
    updatedAt: new Date().toISOString(),
  });
  writeGlobalJSON('last_board_cache_at', cachePayload.updatedAt ?? new Date().toISOString());
}
