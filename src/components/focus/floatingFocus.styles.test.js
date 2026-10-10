import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

it('sizes the shared grid from its explicit row count and retains private note flashes', () => {
  const css = readFileSync('src/components/focus/floatingFocus.css', 'utf8');
  expect(css).toContain('3%, 90%');
  expect(css).toContain('square-wave 700ms');
  expect(css).toContain('repeat(var(--beat-rows,4),minmax(0,1fr))');
  expect(css).not.toContain('.beat-square.melody-held');
  expect(css).toContain('.melody-beat-flash');
  expect(css).toContain('shape-beat-flash 360ms');
  expect(css).not.toContain('melody-breathe');
});
