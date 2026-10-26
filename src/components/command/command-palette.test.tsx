import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CommandPalette from './CommandPalette';

afterEach(cleanup);
it('runs the selected keyboard command and resets selection when filtering', async () => {
  const home = vi.fn(), today = vi.fn();
  const actions = [{ id: 'home', title: 'Home', description: 'Dashboard', keywords: [], run: home }, { id: 'today', title: 'Today', description: 'Daily plan', keywords: [], run: today }];
  const close = vi.fn();
  render(<CommandPalette isOpen actions={actions} onClose={close} />);
  const input = screen.getByRole('combobox', { name: 'Search commands' });
  await waitFor(() => expect(input).toHaveFocus());
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('option', { name: /Today/ })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(today).toHaveBeenCalledOnce(); expect(home).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'Home' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(home).toHaveBeenCalledOnce();
});
