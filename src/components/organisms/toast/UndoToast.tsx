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
      <span className="text-sm font-medium text-slate-100">{message}</span>
      <button
        type="button"
        onClick={() => {
          onUndo();
          closeToast?.();
        }}
        className="cursor-pointer rounded-lg border border-slate-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        Undo
      </button>
    </div>
  );
}
