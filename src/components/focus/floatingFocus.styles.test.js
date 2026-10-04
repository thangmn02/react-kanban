import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

it('holds five-row shapes with onset-driven flashes and no breathing loop', () => {
  const css = readFileSync('src/components/focus/floatingFocus.css', 'utf8');
  expect(css).toContain('3%, 90%');
  expect(css).toContain('square-wave 700ms');
  expect(css).toContain('repeat(5,minmax(0,1fr))');
  expect(css).toContain('.beat-square.melody-held');
  expect(css).toContain('shape-beat-flash 360ms');
  expect(css).not.toContain('melody-breathe');
});
