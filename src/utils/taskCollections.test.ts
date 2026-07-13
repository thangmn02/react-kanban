import { describe, it, expect } from 'vitest';

import {
  normalizeTaskAssignees,
  normalizeTaskLabelColor,
  normalizeTaskAttachments,
  getChecklistProgress,
} from './taskCollections';
import type { TaskChecklistItem } from '../types/task.type';

describe('normalizeTaskAssignees', () => {
  it('handles valid input', () => {
    const result = normalizeTaskAssignees([
      { name: 'Alice', avatar: 'a.png' },
      { name: 'Bob', avatar: 'b.png' },
    ]);

    expect(result).toEqual([
      { name: 'Alice', avatar: 'a.png' },
      { name: 'Bob', avatar: 'b.png' },
    ]);
  });

  it('handles invalid input by returning an empty array', () => {
    expect(normalizeTaskAssignees(null)).toEqual([]);
    expect(normalizeTaskAssignees(undefined)).toEqual([]);
    expect(normalizeTaskAssignees('not an array')).toEqual([]);
    expect(normalizeTaskAssignees({})).toEqual([]);
  });

  it('handles an empty array', () => {
    expect(normalizeTaskAssignees([])).toEqual([]);
  });

  it('drops entries missing required string fields', () => {
    const result = normalizeTaskAssignees([
      { name: 'Alice', avatar: 'a.png' },
      { name: 'Bob' }, // missing avatar
      { avatar: 'c.png' }, // missing name
      { name: 123, avatar: 'd.png' }, // wrong types
      null,
      'string entry',
    ]);

    expect(result).toEqual([{ name: 'Alice', avatar: 'a.png' }]);
  });

  it('preserves userId and workspaceMemberId fields when present', () => {
    const result = normalizeTaskAssignees([
      { name: 'Alice', avatar: 'a.png', userId: 'uid-1', workspaceMemberId: 'wm-1' },
      { name: 'Bob', avatar: 'b.png', userId: 'uid-2' },
      { name: 'Carol', avatar: 'c.png', workspaceMemberId: 'wm-2' },
    ]);

    expect(result).toEqual([
      { name: 'Alice', avatar: 'a.png', userId: 'uid-1', workspaceMemberId: 'wm-1' },
      { name: 'Bob', avatar: 'b.png', userId: 'uid-2' },
      { name: 'Carol', avatar: 'c.png', workspaceMemberId: 'wm-2' },
    ]);
  });

  it('omits userId/workspaceMemberId when they are not strings', () => {
    const result = normalizeTaskAssignees([
      { name: 'Alice', avatar: 'a.png', userId: 123, workspaceMemberId: null },
    ]);

    expect(result).toEqual([{ name: 'Alice', avatar: 'a.png' }]);
  });
});

describe('normalizeTaskLabelColor', () => {
  it('returns valid colors unchanged', () => {
    expect(normalizeTaskLabelColor('slate')).toBe('slate');
    expect(normalizeTaskLabelColor('sky')).toBe('sky');
    expect(normalizeTaskLabelColor('emerald')).toBe('emerald');
    expect(normalizeTaskLabelColor('amber')).toBe('amber');
    expect(normalizeTaskLabelColor('rose')).toBe('rose');
    expect(normalizeTaskLabelColor('violet')).toBe('violet');
  });

  it('returns the default "sky" for invalid or unknown colors', () => {
    expect(normalizeTaskLabelColor('indigo')).toBe('sky');
    expect(normalizeTaskLabelColor('')).toBe('sky');
    expect(normalizeTaskLabelColor(null)).toBe('sky');
    expect(normalizeTaskLabelColor(undefined)).toBe('sky');
    expect(normalizeTaskLabelColor(42)).toBe('sky');
  });
});

describe('normalizeTaskAttachments', () => {
  it('returns an empty array for non-array input', () => {
    expect(normalizeTaskAttachments(null)).toEqual([]);
    expect(normalizeTaskAttachments('string')).toEqual([]);
    expect(normalizeTaskAttachments({})).toEqual([]);
  });

  it('keeps valid attachments and drops invalid ones', () => {
    const result = normalizeTaskAttachments([
      { id: '1', name: 'Doc', url: 'https://example.com' },
      { id: '2', name: 'Missing url' }, // invalid
      null,
      'string',
      { id: '3', name: 'Link', url: 'https://other.com' },
    ]);

    expect(result).toEqual([
      { id: '1', name: 'Doc', url: 'https://example.com', type: 'link' as const },
      { id: '3', name: 'Link', url: 'https://other.com', type: 'link' as const },
    ]);
  });
});

describe('getChecklistProgress', () => {
  function item(id: string, isDone: boolean): TaskChecklistItem {
    return { id, text: id, isDone };
  }

  it('returns zero progress for an empty list', () => {
    expect(getChecklistProgress([])).toEqual({ total: 0, completed: 0, percent: 0 });
  });

  it('calculates percentage correctly', () => {
    const result = getChecklistProgress([
      item('1', true),
      item('2', true),
      item('3', false),
      item('4', false),
    ]);

    expect(result.total).toBe(4);
    expect(result.completed).toBe(2);
    expect(result.percent).toBe(50);
  });

  it('rounds to the nearest integer', () => {
    // 1 of 3 = 33.33 -> 33
    const result = getChecklistProgress([item('1', true), item('2', false), item('3', false)]);
    expect(result.percent).toBe(33);

    // 2 of 3 = 66.66 -> 67
    const result2 = getChecklistProgress([item('1', true), item('2', true), item('3', false)]);
    expect(result2.percent).toBe(67);
  });

  it('reports 100% when all done', () => {
    const result = getChecklistProgress([item('1', true), item('2', true)]);
    expect(result.percent).toBe(100);
  });
});
