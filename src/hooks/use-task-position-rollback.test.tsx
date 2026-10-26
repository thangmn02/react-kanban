import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { data } from '../data';
import { transitionTaskWorkflow } from '../services/task-workflow.service';
import { useTaskOperations } from './useTaskOperations';

vi.mock('../services/task-workflow.service',()=>({transitionTaskWorkflow:vi.fn(),TASK_WORKFLOW_CHANGED:'workflow-changed'}));
afterEach(cleanup);
it('reconciles a failed drag without overwriting an unrelated concurrent edit', async () => {
  vi.mocked(transitionTaskWorkflow).mockRejectedValueOnce(new Error('Connection lost'));
  const cache = vi.fn();
  const { result } = renderHook(() => {
    const [boardData, setBoardData] = useState(data);
    const concurrent = {...data,task:{...data.task,task1:{...data.task.task1,title:'Concurrent title'}}};
    const actions = useTaskOperations({ boardData, setBoardData, syncBoardCache: cache, activeBoardId: 'board', activeWorkspaceId: 'workspace', userId: 'user',
      setIsSavingBoard: vi.fn(), deleteItem: null, setDeleteItem: vi.fn(), editingTask: null, activeListId: null, closeTaskDialog: vi.fn(), refreshBoardData: async()=>{setBoardData(concurrent);cache('board',concurrent);} });
    return { boardData, actions };
  }, { wrapper: I18nProvider });
  const [source, destination] = data.columns;
  const taskId = data.list[source].tasks[0];
  const next = { ...data, list: { ...data.list,
    [source]: { ...data.list[source], tasks: data.list[source].tasks.filter(id => id !== taskId) },
    [destination]: { ...data.list[destination], tasks: [...data.list[destination].tasks, taskId] } } };
  await act(async () => { await result.current.actions.handleBoardPositionChange(next, 'task',{taskId,description:'Move'}); });
  expect(transitionTaskWorkflow).toHaveBeenCalledOnce();
  expect(result.current.boardData.task.task1.title).toBe('Concurrent title');
  expect(result.current.boardData.list).toEqual(data.list);
});
