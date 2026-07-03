import { createElement } from 'react';
import { toast, type ToastContentProps } from 'react-toastify';

import UndoToastBody from './UndoToast';

/** Duration the undo affordance stays available, in milliseconds. */
export const UNDO_TOAST_DURATION_MS = 7000;

/**
 * Show a 7-second toast with an Undo action. Invokes `onUndo` when the user
 * activates the control. The toast auto-dismisses after the window elapses; if
 * the user never activates Undo, nothing else happens (the action stays done).
 */
export function showUndoToast(message: string, onUndo: () => void): void {
  toast(
    (props: ToastContentProps) => createElement(UndoToastBody, {
      message,
      onUndo,
      closeToast: props.closeToast,
    }),
    {
      type: 'info',
      autoClose: UNDO_TOAST_DURATION_MS,
      closeOnClick: false,
      draggable: false,
      pauseOnHover: true,
      pauseOnFocusLoss: false,
    },
  );
}
