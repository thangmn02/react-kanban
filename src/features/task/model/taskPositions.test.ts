import { describe, expect, it } from 'vitest';

import type { BoardData } from '../../../types/task.type';

import {
  buildChangedListPositionPayload,
  buildChangedTaskPositionPayload,
} from './taskPositions';

function makeBoard(columns: string[], lists: Record<string, string[]>, tasks: Record<string, unknown> = {}): BoardData {
  return {
    columns,
    list: Object.fromEntries(
      columns.map((id) => [id, { id, title: id, tasks: lists[id] ?? [] }]),
    ),
    task: tasks as BoardData['task'],
  };
}

describe('buildChangedTaskPositionPayload', () => {
  it('returns an empty payload when nothing moved', () => {
    const board = makeBoard(['l1', 'l2'], { l1: ['t1', 't2'], l2: ['t3'] });
    expect(buildChangedTaskPositionPayload(board, board)).toEqual([]);
  });

  it('reports a task that changed list (and the position shifts it causes)', () => {
    const before = makeBoard(['l1', 'l2'], { l1: ['t1', 't2'], l2: ['t3'] });
    const after = makeBoard(['l1', 'l2'], { l1: ['t2'], l2: ['t1', 't3'] });
    const changed = buildChangedTaskPositionPayload(before, after);
    // t1 changed list (l1 -> l2); t2 and t3 shifted position as a result.
    expect(changed).toHaveLength(3);
    const t1 = changed.find((c) => c.id === 't1');
    expect(t1).toBeTruthy();
    expect(t1!.list_id).toBe('l2');
  });

  it('reports a task that only changed position within the same list', () => {
    const before = makeBoard(['l1'], { l1: ['t1', 't2'] });
    const after = makeBoard(['l1'], { l1: ['t2', 't1'] });
    const changed = buildChangedTaskPositionPayload(before, after);
    expect(changed.map((c) => c.id).sort()).toEqual(['t1', 't2']);
  });
});

describe('buildChangedListPositionPayload', () => {
  it('returns an empty payload when list order is unchanged', () => {
    const board = makeBoard(['l1', 'l2', 'l3'], { l1: [], l2: [], l3: [] });
    expect(buildChangedListPositionPayload(board, board)).toEqual([]);
  });

  it('reports lists whose order changed, scaled by LIST_POSITION_STEP', () => {
    const before = makeBoard(['l1', 'l2', 'l3'], { l1: [], l2: [], l3: [] });
    const after = makeBoard(['l3', 'l1', 'l2'], { l1: [], l2: [], l3: [] });
    const changed = buildChangedListPositionPayload(before, after);
    // l1: 0 -> 1*step, l2: 1 -> 2*step, l3: 2 -> 0
    expect(changed).toHaveLength(3);
    const byId = new Map(changed.map((c) => [c.id, c.position]));
    expect(byId.get('l1')).toBe(1 * 1000);
    expect(byId.get('l2')).toBe(2 * 1000);
    expect(byId.get('l3')).toBe(0 * 1000);
  });
});
