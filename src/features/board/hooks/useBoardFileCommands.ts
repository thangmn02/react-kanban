import { useCallback, useEffect } from 'react';

import { notify } from '../../../components/organisms/toast/notify';
import type { AppUser, WorkspaceMember } from '../../../types/auth.type';
import type { BoardData } from '../../../types/task.type';
import type { BoardRow } from '../../../types/supabase.type';
import { createTasks } from '../../../services/task.service';
import { buildTaskInsertPayload } from '../../../utils/boardDataMapper';
import { parseTaskLines } from '../../../utils/taskParser';
import { useI18n } from '../../../i18n';
import {
  downloadTextFile,
  normalizeCsvDueDate,
  normalizeCsvPriority,
  parseTasksCsv,
  tasksToCsv,
} from '../../../utils/csvTasks';

interface Params {
  activeView: string;
  boardData: BoardData;
  activeBoardId: string | null;
  activeBoardSummary: BoardRow | null;
  workspaceId: string | null;
  user: AppUser | null;
  workspaceMembers: WorkspaceMember[];
  setIsSavingBoard: (value: boolean) => void;
  refreshBoardData: (args?: { boardId?: string | null }) => Promise<void>;
  t: ReturnType<typeof useI18n>['t'];
}

export function useBoardFileCommands({
  activeView,
  boardData,
  activeBoardId,
  activeBoardSummary,
  workspaceId,
  user,
  workspaceMembers,
  setIsSavingBoard,
  refreshBoardData,
  t,
}: Params) {
  const handlePasteTasks = useCallback(async (text: string) => {
    if (!activeView.includes('/boards/') && activeView !== '/home' && activeView !== '/today') return;
    const firstListId = boardData.columns[0];
    if (!activeBoardId || !workspaceId || !firstListId || !user) return;

    const taskTitles = parseTaskLines(text);
    if (!taskTitles.length) return;

    setIsSavingBoard(true);
    try {
      const positionOffset = (boardData.list[firstListId]?.tasks.length || 0) * 65536;
      const tasksToCreate = taskTitles.map((title, index) => ({
        title,
        board_id: activeBoardId,
        list_id: firstListId,
        workspace_id: workspaceId,
        created_by: user.id,
        assignees: [user.id],
        position: positionOffset + ((index + 1) * 65536),
      }));
      await createTasks(tasksToCreate);
      await refreshBoardData({ boardId: activeBoardId });
      notify.success(t('toast.createdTasksFromPaste', { count: tasksToCreate.length }));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.failedCreatePastedTasks'));
    } finally {
      setIsSavingBoard(false);
    }
  }, [activeBoardId, activeView, boardData, refreshBoardData, setIsSavingBoard, t, user, workspaceId]);

  const handleExportCsv = useCallback(() => {
    try {
      const csv = tasksToCsv(boardData);
      const boardTitle = activeBoardSummary?.title || t('common.untitledBoard');
      const slug = boardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'board';
      downloadTextFile(`${slug}-tasks.csv`, csv);
      notify.success(t('toast.exportedCsv', { count: Object.values(boardData.task).filter(Boolean).length }));
    } catch {
      notify.error(t('toast.csvExportFailed'));
    }
  }, [activeBoardSummary?.title, boardData, t]);

  const handleImportCsv = useCallback(async (file: File) => {
    if (!activeView.includes('/boards/') && activeView !== '/home') return;
    const firstListId = boardData.columns[0];
    if (!activeBoardId || !workspaceId || !firstListId || !user) return;

    let fileText: string;
    try {
      fileText = await file.text();
    } catch {
      notify.error(t('toast.csvImportFailed'));
      return;
    }

    const parsedTasks = parseTasksCsv(fileText);
    if (!parsedTasks.length) {
      notify.info(t('toast.csvImportEmpty'));
      return;
    }

    const listIdByTitle = new Map<string, string>();
    boardData.columns.forEach((listId) => {
      const list = boardData.list[listId];
      if (list) listIdByTitle.set(list.title.trim().toLowerCase(), listId);
    });
    const assigneeByName = new Map<string, { name: string; avatar: string }>();
    workspaceMembers.forEach((member) => {
      assigneeByName.set(member.name.trim().toLowerCase(), { name: member.name, avatar: member.avatarUrl });
    });

    setIsSavingBoard(true);
    try {
      const positionOffset = (boardData.list[firstListId]?.tasks.length || 0) * 65536;
      const tasksToCreate = parsedTasks.map((row, index) => {
        const matchedAssignee = assigneeByName.get(row.assignee.trim().toLowerCase());
        return {
          ...buildTaskInsertPayload({
            boardId: activeBoardId,
            listId: listIdByTitle.get(row.status.trim().toLowerCase()) || firstListId,
            title: row.title,
            description: '',
            priority: normalizeCsvPriority(row.priority),
            dueDate: normalizeCsvDueDate(row.dueDate),
            position: positionOffset + (index + 1) * 65536,
            assignees: matchedAssignee ? [matchedAssignee] : [],
          }),
          workspace_id: workspaceId,
          created_by: user.id,
        };
      });
      await createTasks(tasksToCreate);
      await refreshBoardData({ boardId: activeBoardId });
      notify.success(t('toast.importedCsv', { count: tasksToCreate.length }));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t('toast.csvImportFailed'));
    } finally {
      setIsSavingBoard(false);
    }
  }, [activeBoardId, activeView, boardData, refreshBoardData, setIsSavingBoard, t, user, workspaceId, workspaceMembers]);

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeElement.getAttribute('contenteditable') === 'true') return;
      }
      const text = event.clipboardData?.getData('text');
      if (text) void handlePasteTasks(text);
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [handlePasteTasks]);

  return { handleExportCsv, handleImportCsv };
}
