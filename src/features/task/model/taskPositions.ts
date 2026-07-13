import { LIST_POSITION_STEP } from '../../../constants';
import type { BoardData } from '../../../types/task.type';

/**
 * Pure board-position diffing helpers extracted from `useTaskOperations`
 * (remediation plan §6 — split orchestration into commands and move pure
 * model logic into `features/task/model`). Being free of React state/IO,
 * these are straightforward to unit-test directly.
 */

export interface TaskPositionEntry {
  id: string;
  list_id: string;
  position: number;
}

export interface ListPositionEntry {
  id: string;
  position: number;
}

/**
 * Shared diff core for position payloads. Builds a map of the previous
 * location for each entry id, derives the next entries, then keeps only the
 * entries that changed relative to their previous location.
 */
export function buildChangedPositions<
  PreviousLocation,
  Entry extends { id: string }
>(
  previousBoardData: BoardData,
  nextBoardData: BoardData,
  buildPreviousLocations: (board: BoardData) => Map<string, PreviousLocation>,
  buildNextEntries: (board: BoardData) => Entry[],
  hasChanged: (previousLocation: PreviousLocation | undefined, entry: Entry) => boolean,
): Entry[] {
  const previousLocations = buildPreviousLocations(previousBoardData);

  return buildNextEntries(nextBoardData).filter((entry) => (
    hasChanged(previousLocations.get(entry.id), entry)
  ));
}

/** Returns only the tasks whose list or position changed between two boards. */
export function buildChangedTaskPositionPayload(
  previousBoardData: BoardData,
  nextBoardData: BoardData,
): TaskPositionEntry[] {
  return buildChangedPositions<
    { listId: string; position: number },
    TaskPositionEntry
  >(
    previousBoardData,
    nextBoardData,
    (board) => {
      const previousTaskLocations = new Map<string, { listId: string; position: number }>();

      board.columns.forEach((listId) => {
        board.list[listId]?.tasks.forEach((taskId, position) => {
          previousTaskLocations.set(taskId, { listId, position });
        });
      });

      return previousTaskLocations;
    },
    (board) => board.columns.flatMap((listId) => (
      board.list[listId].tasks.map((taskId, position) => ({
        id: taskId,
        list_id: listId,
        position,
      }))
    )),
    (previousLocation, { list_id, position }) => (
      !previousLocation
      || previousLocation.listId !== list_id
      || previousLocation.position !== position
    ),
  );
}

/** Returns only the lists whose position changed between two boards. */
export function buildChangedListPositionPayload(
  previousBoardData: BoardData,
  nextBoardData: BoardData,
): ListPositionEntry[] {
  return buildChangedPositions<number, ListPositionEntry>(
    previousBoardData,
    nextBoardData,
    (board) => {
      const previousListPositions = new Map<string, number>();

      board.columns.forEach((listId, position) => {
        previousListPositions.set(listId, position * LIST_POSITION_STEP);
      });

      return previousListPositions;
    },
    (board) => board.columns.map((listId, position) => ({
      id: listId,
      position: position * LIST_POSITION_STEP,
    })),
    (previousPosition, { position }) => previousPosition !== position,
  );
}
