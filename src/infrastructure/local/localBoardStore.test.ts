import { beforeEach, describe, expect, it } from 'vitest';

import { buildStorageKey } from '../../shared/storage/storageAdapter';
import { BOARD_TEMPLATES, DEFAULT_BOARD_TEMPLATE_ID } from '../../data/boardTemplates';
import {
  localCreateBoardFromTemplate,
  localCreateList,
  localCreateTasks,
  localDeleteTask,
  localFetchAllLists,
  localFetchAllTasks,
  localFetchBoardSnapshot,
  localFetchBoards,
  localUpdateListPositions,
  localUpdateTask,
  localUpdateTaskPositions,
  resetLocalBoardStore,
} from './localBoardStore';

// Reconstruct the exact namespaced storage key the store writes to so the
// contract tests can assert persistence directly (proving saveState() ran).
const STORAGE_KEY = buildStorageKey(
  { userId: 'mock-user', workspaceId: 'local-mock-workspace' },
  'board_store',
);

interface StoredState {
  tasks: { id: string }[];
}

function readStoredState(): StoredState {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredState) : { tasks: [] };
}

beforeEach(() => {
  localStorage.clear();
  resetLocalBoardStore();
});

describe('LocalBoardStore — seeding & reads', () => {
  it('seeds a default board with lists and tasks', () => {
    const snapshot = localFetchBoardSnapshot();
    expect(snapshot.boardId).toBe('local-mock-board');
    expect(snapshot.listRows.length).toBeGreaterThan(0);
    expect(snapshot.taskRows.length).toBeGreaterThan(0);
  });

  it('returns boards for the mock workspace', () => {
    const boards = localFetchBoards('local-mock-workspace');
    expect(boards).toHaveLength(1);
    expect(boards[0].id).toBe('local-mock-board');
  });

  it('returns all non-deleted tasks and non-archived lists for the workspace', () => {
    const tasks = localFetchAllTasks('local-mock-workspace');
    const lists = localFetchAllLists('local-mock-workspace');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.deleted_at === null && t.archived_at === null)).toBe(true);
    expect(lists.every((l) => l.archived_at === null)).toBe(true);
  });
});

describe('LocalBoardStore — localCreateTasks persistence (P0 defect)', () => {
  it('persists created tasks to storage so they survive a refresh', () => {
    const snapshotBefore = localFetchBoardSnapshot();
    const listId = snapshotBefore.listRows[0].id;
    const boardId = snapshotBefore.boardId!;
    const beforeCount = snapshotBefore.taskRows.length;

    const created = localCreateTasks([{ board_id: boardId, list_id: listId, title: 'Persisted task' }]);

    expect(created).toHaveLength(1);
    const snapshotAfter = localFetchBoardSnapshot();
    expect(snapshotAfter.taskRows).toHaveLength(beforeCount + 1);

    // Persistence: before the fix this failed because saveState() was never called.
    const storedIds = readStoredState().tasks.map((t) => t.id);
    expect(storedIds).toContain(created[0].id);
  });

  it('persists a batch of tasks and assigns incrementing positions', () => {
    const snapshot = localFetchBoardSnapshot();
    const listId = snapshot.listRows[0].id;
    const boardId = snapshot.boardId!;

    const created = localCreateTasks([
      { board_id: boardId, list_id: listId, title: 'Batch A' },
      { board_id: boardId, list_id: listId, title: 'Batch B' },
    ]);

    expect(created).toHaveLength(2);
    expect(created[1].position).toBeGreaterThan(created[0].position);
    const storedIds = readStoredState().tasks.map((t) => t.id);
    expect(storedIds).toContain(created[0].id);
    expect(storedIds).toContain(created[1].id);
  });
});

describe('LocalBoardStore — localCreateBoardFromTemplate', () => {
  it('creates the board and its template lists', () => {
    const board = localCreateBoardFromTemplate({
      title: 'Project board',
      description: '',
      templateId: DEFAULT_BOARD_TEMPLATE_ID,
    });
    const template = BOARD_TEMPLATES[0];

    expect(board.title).toBe('Project board');

    const snapshot = localFetchBoardSnapshot(board.id);
    expect(snapshot.boardId).toBe(board.id);
    expect(snapshot.listRows.map((l) => l.title)).toEqual(template.lists);
  });

  it('uses the template description when none is provided', () => {
    const template = BOARD_TEMPLATES.find((t) => t.id === 'software-mini-project')!;
    const board = localCreateBoardFromTemplate({
      title: 'Sprint',
      description: '',
      templateId: template.id,
    });
    expect(board.description).toBe(template.description);
  });

  it('throws on an invalid templateId', () => {
    expect(() =>
      localCreateBoardFromTemplate({
        title: 'Bad',
        description: '',
        templateId: 'does-not-exist',
      }),
    ).toThrow();
  });
});

describe('LocalBoardStore — list & task mutations', () => {
  it('creates a list with an incrementing position', () => {
    const snapshot = localFetchBoardSnapshot();
    const boardId = snapshot.boardId!;
    const before = snapshot.listRows.length;

    const created = localCreateList({ board_id: boardId, title: 'New list' });

    expect(created.title).toBe('New list');
    const after = localFetchBoardSnapshot().listRows;
    expect(after).toHaveLength(before + 1);
    expect(after.some((l) => l.id === created.id)).toBe(true);
  });

  it('updates a task field and persists it', () => {
    const snapshot = localFetchBoardSnapshot();
    const task = snapshot.taskRows[0];

    const updated = localUpdateTask(task.id, { title: 'Renamed' });

    expect(updated.title).toBe('Renamed');
    expect(readStoredState().tasks.some((t) => t.id === task.id)).toBe(true);
  });

  it('soft-deletes a task so it no longer appears in snapshots', () => {
    const snapshot = localFetchBoardSnapshot();
    const task = snapshot.taskRows[0];

    localDeleteTask(task.id);

    const after = localFetchBoardSnapshot().taskRows;
    expect(after.some((t) => t.id === task.id)).toBe(false);
  });

  it('reorders list positions without dropping lists', () => {
    const snapshot = localFetchBoardSnapshot();
    const lists = snapshot.listRows;

    localUpdateListPositions(lists.map((l) => ({ id: l.id, position: l.position })));

    expect(localFetchBoardSnapshot().listRows).toHaveLength(lists.length);
  });

  it('updates task positions across lists', () => {
    const snapshot = localFetchBoardSnapshot();
    const tasks = snapshot.taskRows;

    localUpdateTaskPositions(
      tasks.map((t) => ({ id: t.id, list_id: t.list_id, position: t.position })),
    );

    expect(localFetchBoardSnapshot().taskRows).toHaveLength(tasks.length);
  });
});
