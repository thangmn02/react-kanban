import type { ToastContentProps } from 'react-toastify';

interface UndoToastBodyProps extends Partial<ToastContentProps> {
  message: string;
  onUndo: () => void;
}

/**
 * Toast body for an undoable action. Renders the status text plus a real
 * <button> Undo control so it is keyboard operable (Enter/Space) and exposes a
 * focus-visible ring. The surrounding react-toastify container provides the
 * aria-live announcement for the status text.
 */
export default function UndoToastBody({ message, onUndo, closeToast }: UndoToastBodyProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-[var(--app-text,#0f172a)]">{message}</span>
      <button
        type="button"
        onClick={() => {
          onUndo();
          closeToast?.();
        }}
        className="cursor-pointer rounded-lg border border-[var(--app-border,#e2e8f0)] px-3 py-1 text-xs font-semibold text-[var(--app-text,#0f172a)] transition-colors hover:bg-[var(--app-muted,#f1f5f9)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        Undo
      </button>
    </div>
  );
}
