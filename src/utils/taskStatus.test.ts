import { describe, expect, it } from 'vitest';

import { columnStatusColor, statusColor } from './taskStatus';

const today = new Date(2026, 8, 28);

describe('statusColor', () => {
  it.each([
    [undefined, 'gray'],
    ['2026-10-04', 'blue'],
    ['2026-09-30', 'amber'],
    ['2026-09-20', 'amber'],
  ] as const)('maps due date %s to %s', (dueDate, expected) => {
    expect(statusColor({ dueDate }, false, today)).toBe(expected);
  });

  it('uses green for the final active column', () => {
    expect(statusColor({ dueDate: '2026-09-20' }, true, today)).toBe('green');
  });

  it('uses the most urgent task color for a column', () => {
    expect(columnStatusColor([
      { dueDate: '2026-10-04' },
      { dueDate: '2026-09-29' },
    ], false, today)).toBe('amber');
  });
});
