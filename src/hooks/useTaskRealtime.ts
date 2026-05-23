import { useEffect, useEffectEvent, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import supabase, { requireSupabaseClient } from '../lib/supabase';
import type { BoardData } from '../types/task.type';
import type {
  ListRow,
  TaskChecklistItemRow,
  TaskLabelLinkRow,
  TaskLabelRow,
  TaskRow,
} from '../types/supabase.type';
import {
  applyRealtimeTaskMutation,
  removeTaskFromBoardData,
} from '../utils/boardRealtime';

interface UseTaskRealtimeParams {
  boardId: string | null;
  setBoardData: Dispatch<SetStateAction<BoardData>>;
  refreshBoardData: (options?: { boardId?: string | null; showErrorToast?: boolean }) => Promise<void>;
}

type TaskRealtimeSubscriptionStatus =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR';

const realtimeRefreshDebounceMs = 300;
const isRealtimeDebugEnabled = import.meta.env.DEV;

export function useTaskRealtime({
  boardId,
  setBoardData,
  refreshBoardData,
}: UseTaskRealtimeParams) {
  const hasCompletedInitialSubscriptionRef = useRef(false);
  const pendingRefreshTimeoutRef = useRef<number | null>(null);
  const refreshReasonRef = useRef<string | null>(null);

  const logRealtimeMessage = useEffectEvent((message: string, metadata?: Record<string, unknown>) => {
    if (!isRealtimeDebugEnabled) {
      return;
    }

    console.info('[TaskRealtime]', message, metadata ?? {});
  });

  const clearPendingRealtimeRefresh = useEffectEvent(() => {
    if (pendingRefreshTimeoutRef.current !== null) {
      window.clearTimeout(pendingRefreshTimeoutRef.current);
      pendingRefreshTimeoutRef.current = null;
      refreshReasonRef.current = null;
    }
  });

  const scheduleBoardRefresh = useEffectEvent((reason: string) => {
    if (pendingRefreshTimeoutRef.current !== null) {
      logRealtimeMessage('Skipped duplicate refresh schedule.', {
        boardId,
        reason,
        pendingReason: refreshReasonRef.current,
      });
      return;
    }

    refreshReasonRef.current = reason;
    logRealtimeMessage('Scheduled fallback board refresh.', {
      boardId,
      reason,
    });

    pendingRefreshTimeoutRef.current = window.setTimeout(() => {
      pendingRefreshTimeoutRef.current = null;
      const nextRefreshReason = refreshReasonRef.current;
      refreshReasonRef.current = null;

      logRealtimeMessage('Running fallback board refresh.', {
        boardId,
        reason: nextRefreshReason,
      });
      void refreshBoardData();
    }, realtimeRefreshDebounceMs);
  });

  const removeTaskFromBoardDataById = useEffectEvent((taskId: string) => {
    setBoardData((currentBoardData) => {
      return removeTaskFromBoardData(currentBoardData, taskId);
    });
  });

  const isTaskRealtimeRowComplete = (taskRow: Partial<TaskRow> | undefined): taskRow is TaskRow => (
    Boolean(
      taskRow
      && typeof taskRow.id === 'string'
      && typeof taskRow.board_id === 'string'
      && typeof taskRow.list_id === 'string'
      && typeof taskRow.title === 'string'
      && typeof taskRow.position === 'number'
      && typeof taskRow.is_done === 'boolean'
      && typeof taskRow.created_at === 'string'
    )
  );

  const handleTaskRealtimeEvent = useEffectEvent((payload: RealtimePostgresChangesPayload<TaskRow>) => {
    const matchingTaskRow = payload.eventType === 'DELETE'
      ? payload.old
      : payload.new;

    logRealtimeMessage('Received task realtime event.', {
      boardId,
      eventType: payload.eventType,
      taskId: matchingTaskRow?.id,
      payloadBoardId: matchingTaskRow?.board_id,
      listId: matchingTaskRow?.list_id,
      position: matchingTaskRow?.position,
      deletedAt: matchingTaskRow?.deleted_at,
    });

    if (matchingTaskRow?.board_id && matchingTaskRow.board_id !== boardId) {
      logRealtimeMessage('Detected board mismatch in realtime payload.', {
        boardId,
        payloadBoardId: matchingTaskRow.board_id,
        eventType: payload.eventType,
        taskId: matchingTaskRow.id,
      });
      scheduleBoardRefresh('board-mismatch');
      return;
    }

    if (payload.eventType === 'DELETE') {
      if (typeof payload.old.id === 'string') {
        removeTaskFromBoardDataById(payload.old.id);
        return;
      }

      scheduleBoardRefresh('delete-payload-missing-id');
      return;
    }

    if (!isTaskRealtimeRowComplete(payload.new)) {
      scheduleBoardRefresh('incomplete-update-payload');
      return;
    }

    if (
      payload.eventType === 'UPDATE'
      && (
        payload.old.list_id !== payload.new.list_id
        || payload.old.position !== payload.new.position
      )
    ) {
      logRealtimeMessage('Detected structural task update. Refreshing snapshot instead of incremental merge.', {
        boardId,
        taskId: payload.new.id,
        previousListId: payload.old.list_id,
        nextListId: payload.new.list_id,
        previousPosition: payload.old.position,
        nextPosition: payload.new.position,
      });
      scheduleBoardRefresh('task-structure-changed');
      return;
    }

    let shouldRefreshBoardSnapshot = false;

    setBoardData((currentBoardData) => {
      const realtimeTaskMutationResult = applyRealtimeTaskMutation(currentBoardData, payload.new);

      shouldRefreshBoardSnapshot = realtimeTaskMutationResult.shouldRefreshBoardSnapshot;
      return realtimeTaskMutationResult.nextBoardData;
    });

    if (shouldRefreshBoardSnapshot) {
      scheduleBoardRefresh('list-missing-in-local-state');
    }
  });

  const handleListRealtimeEvent = useEffectEvent((payload: RealtimePostgresChangesPayload<ListRow>) => {
    const matchingListRow = payload.eventType === 'DELETE'
      ? payload.old
      : payload.new;

    logRealtimeMessage('Received list realtime event.', {
      boardId,
      eventType: payload.eventType,
      listId: matchingListRow?.id,
      payloadBoardId: matchingListRow?.board_id,
      position: matchingListRow?.position,
      title: matchingListRow?.title,
    });

    if (matchingListRow?.board_id && matchingListRow.board_id !== boardId) {
      logRealtimeMessage('Detected board mismatch in list realtime payload.', {
        boardId,
        payloadBoardId: matchingListRow.board_id,
        eventType: payload.eventType,
        listId: matchingListRow.id,
      });
      scheduleBoardRefresh('list-board-mismatch');
      return;
    }

    scheduleBoardRefresh(`list-${payload.eventType.toLowerCase()}`);
  });

  const handleChecklistRealtimeEvent = useEffectEvent((payload: RealtimePostgresChangesPayload<TaskChecklistItemRow>) => {
    logRealtimeMessage('Received checklist realtime event.', {
      boardId,
      eventType: payload.eventType,
      checklistItemId: payload.eventType === 'DELETE' ? payload.old.id : payload.new.id,
      taskId: payload.eventType === 'DELETE' ? payload.old.task_id : payload.new.task_id,
    });
    scheduleBoardRefresh(`checklist-${payload.eventType.toLowerCase()}`);
  });

  const handleTaskLabelRealtimeEvent = useEffectEvent((payload: RealtimePostgresChangesPayload<TaskLabelRow>) => {
    const matchingTaskLabelRow = payload.eventType === 'DELETE'
      ? payload.old
      : payload.new;

    logRealtimeMessage('Received task label realtime event.', {
      boardId,
      eventType: payload.eventType,
      labelId: matchingTaskLabelRow?.id,
      payloadBoardId: matchingTaskLabelRow?.board_id,
    });

    if (matchingTaskLabelRow?.board_id && matchingTaskLabelRow.board_id !== boardId) {
      return;
    }

    scheduleBoardRefresh(`task-label-${payload.eventType.toLowerCase()}`);
  });

  const handleTaskLabelLinkRealtimeEvent = useEffectEvent((payload: RealtimePostgresChangesPayload<TaskLabelLinkRow>) => {
    logRealtimeMessage('Received task label link realtime event.', {
      boardId,
      eventType: payload.eventType,
      taskId: payload.eventType === 'DELETE' ? payload.old.task_id : payload.new.task_id,
      labelId: payload.eventType === 'DELETE' ? payload.old.label_id : payload.new.label_id,
    });
    scheduleBoardRefresh(`task-label-link-${payload.eventType.toLowerCase()}`);
  });

  const handleRealtimeSubscriptionStatusChange = useEffectEvent((status: TaskRealtimeSubscriptionStatus) => {
    logRealtimeMessage('Realtime channel status changed.', {
      boardId,
      status,
    });

    if (status !== 'SUBSCRIBED') {
      return;
    }

    if (!hasCompletedInitialSubscriptionRef.current) {
      hasCompletedInitialSubscriptionRef.current = true;
      logRealtimeMessage('Realtime channel subscribed.', {
        boardId,
      });
      return;
    }

    scheduleBoardRefresh('channel-resubscribed');
  });

  useEffect(() => {
    hasCompletedInitialSubscriptionRef.current = false;
    clearPendingRealtimeRefresh();

    if (!boardId || !supabase) {
      return;
    }

    const client = requireSupabaseClient();

    logRealtimeMessage('Subscribing to task realtime channel.', {
      boardId,
      filter: `board_id=eq.${boardId}`,
    });

    const taskRealtimeChannel = client
      .channel(`tasks-realtime-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `board_id=eq.${boardId}`,
        },
        handleTaskRealtimeEvent
      )
      .subscribe(handleRealtimeSubscriptionStatusChange);

    const listRealtimeChannel = client
      .channel(`lists-realtime-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
          filter: `board_id=eq.${boardId}`,
        },
        handleListRealtimeEvent
      )
      .subscribe(handleRealtimeSubscriptionStatusChange);

    const checklistRealtimeChannel = client
      .channel(`task-checklist-realtime-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_checklist_items',
        },
        handleChecklistRealtimeEvent
      )
      .subscribe(handleRealtimeSubscriptionStatusChange);

    const taskLabelRealtimeChannel = client
      .channel(`task-labels-realtime-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_labels',
          filter: `board_id=eq.${boardId}`,
        },
        handleTaskLabelRealtimeEvent
      )
      .subscribe(handleRealtimeSubscriptionStatusChange);

    const taskLabelLinkRealtimeChannel = client
      .channel(`task-label-links-realtime-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_label_links',
        },
        handleTaskLabelLinkRealtimeEvent
      )
      .subscribe(handleRealtimeSubscriptionStatusChange);

    return () => {
      logRealtimeMessage('Cleaning up task realtime channel.', {
        boardId,
      });
      clearPendingRealtimeRefresh();
      void client.removeChannel(taskRealtimeChannel);
      void client.removeChannel(listRealtimeChannel);
      void client.removeChannel(checklistRealtimeChannel);
      void client.removeChannel(taskLabelRealtimeChannel);
      void client.removeChannel(taskLabelLinkRealtimeChannel);
    };
  }, [boardId]);
}
