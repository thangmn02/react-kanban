/**
 * Board dialog state as a discriminated union (remediation plan §5.2).
 *
 * A single mutually-exclusive state is safer than a collection of independent
 * booleans (which can enter impossible combinations, e.g. "create-task" and
 * "board-settings" open at once). The owning page controller transitions
 * between these variants.
 */
export type BoardDialogState =
  | { type: 'closed' }
  | { type: 'create-task'; listId: string }
  | { type: 'edit-task'; taskId: string }
  | { type: 'create-list' }
  | { type: 'create-board' }
  | { type: 'board-settings' };

export const CLOSED_BOARD_DIALOG: BoardDialogState = { type: 'closed' };

export function isBoardDialogOpen(state: BoardDialogState): boolean {
  return state.type !== 'closed';
}
