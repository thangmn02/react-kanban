import type { BoardData, BoardListMap, BoardTaskItem } from '../types/task.type';
import type { TaskRow } from '../types/supabase.type';
import { mapTaskRowToTaskItem } from './boardDataMapper';

interface RealtimeTaskMutationResult {
  nextBoardData: BoardData;
  shouldRefreshBoardSnapshot: boolean;
}

function findListIdContainingTask(boardData: BoardData, taskId: string): string | null {
  const matchedListEntry = Object.entries(boardData.list).find(([, listItem]) => (
    listItem.tasks.includes(taskId)
  ));

  return matchedListEntry?.[0] ?? null;
}

function clampTaskPosition(position: number, maxIndex: number): number {
  return Math.max(0, Math.min(position, maxIndex));
}

function areTaskItemsEqual(currentTask: BoardTaskItem | undefined, nextTask: BoardTaskItem): boolean {
  if (!currentTask) {
    return false;
  }

  return JSON.stringify(currentTask) === JSON.stringify(nextTask);
}

function removeTaskIdFromTasks(taskIds: string[], taskId: string): string[] {
  return taskIds.filter((currentTaskId) => currentTaskId !== taskId);
}

export function removeTaskFromBoardData(boardData: BoardData, taskId: string): BoardData {
  const currentListId = findListIdContainingTask(boardData, taskId);
  const currentTask = boardData.task[taskId];

  if (!currentListId && !currentTask) {
    return boardData;
  }

  const nextTaskMap = { ...boardData.task };
  delete nextTaskMap[taskId];

  if (!currentListId) {
    return {
      ...boardData,
      task: nextTaskMap,
    };
  }

  return {
    ...boardData,
    list: {
      ...boardData.list,
      [currentListId]: {
        ...boardData.list[currentListId],
        tasks: removeTaskIdFromTasks(boardData.list[currentListId].tasks, taskId),
      },
    },
    task: nextTaskMap,
  };
}

function insertTaskIdAtPosition(taskIds: string[], taskId: string, position: number): string[] {
  const nextTaskIds = removeTaskIdFromTasks(taskIds, taskId);
  const nextIndex = clampTaskPosition(position, nextTaskIds.length);
  nextTaskIds.splice(nextIndex, 0, taskId);
  return nextTaskIds;
}

function buildNextListMapWithMovedTask(
  currentListMap: BoardListMap,
  sourceListId: string | null,
  destinationListId: string,
  taskId: string,
  destinationPosition: number
): BoardListMap {
  const nextListMap: BoardListMap = {
    ...currentListMap,
  };

  if (sourceListId && currentListMap[sourceListId]) {
    nextListMap[sourceListId] = {
      ...currentListMap[sourceListId],
      tasks: removeTaskIdFromTasks(currentListMap[sourceListId].tasks, taskId),
    };
  }

  const destinationTasks = sourceListId === destinationListId && nextListMap[destinationListId]
    ? nextListMap[destinationListId].tasks
    : currentListMap[destinationListId].tasks;

  nextListMap[destinationListId] = {
    ...currentListMap[destinationListId],
    tasks: insertTaskIdAtPosition(destinationTasks, taskId, destinationPosition),
  };

  return nextListMap;
}

export function applyRealtimeTaskMutation(boardData: BoardData, taskRow: TaskRow): RealtimeTaskMutationResult {
  if (taskRow.deleted_at) {
    return {
      nextBoardData: removeTaskFromBoardData(boardData, taskRow.id),
      shouldRefreshBoardSnapshot: false,
    };
  }

  const destinationList = boardData.list[taskRow.list_id];

  if (!destinationList) {
    return {
      nextBoardData: boardData,
      shouldRefreshBoardSnapshot: true,
    };
  }

  const nextTaskItem = mapTaskRowToTaskItem(taskRow);
  const currentTaskItem = boardData.task[taskRow.id];
  const currentListId = findListIdContainingTask(boardData, taskRow.id);
  const currentTaskPosition = currentListId ? boardData.list[currentListId].tasks.indexOf(taskRow.id) : -1;
  const normalizedTaskPosition = clampTaskPosition(taskRow.position, destinationList.tasks.length);
  const isTaskContentUnchanged = areTaskItemsEqual(currentTaskItem, nextTaskItem);
  const isTaskListUnchanged = currentListId === taskRow.list_id;
  const isTaskPositionUnchanged = currentTaskPosition === normalizedTaskPosition;

  if (isTaskContentUnchanged && isTaskListUnchanged && isTaskPositionUnchanged) {
    return {
      nextBoardData: boardData,
      shouldRefreshBoardSnapshot: false,
    };
  }

  return {
    nextBoardData: {
      ...boardData,
      list: buildNextListMapWithMovedTask(
        boardData.list,
        currentListId,
        taskRow.list_id,
        taskRow.id,
        taskRow.position
      ),
      task: {
        ...boardData.task,
        [taskRow.id]: nextTaskItem,
      },
    },
    shouldRefreshBoardSnapshot: false,
  };
}
