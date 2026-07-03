import {
  ToastContainer,
  type CloseButtonProps,
  type IconProps,
  type TypeOptions,
} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './app-toast.css';

const iconByType: Record<TypeOptions | 'default', string> = {
  success: '\u2713',
  error: '!',
  warning: '!',
  info: 'i',
  default: 'i',
};

function AppToastIcon({ type = 'default' }: IconProps) {
  return (
    <span className="app-toast__icon" aria-hidden="true">
      {iconByType[type]}
    </span>
  );
}

function AppToastCloseButton({ closeToast, ariaLabel = 'Dismiss notification' }: CloseButtonProps) {
  return (
    <button
      type="button"
      className="app-toast__close"
      aria-label={ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        closeToast(true);
      }}
    >
      <span aria-hidden="true">{'\u00d7'}</span>
    </button>
  );
}

export default function AppToastContainer() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      closeButton={AppToastCloseButton}
      closeOnClick={false}
      draggable={false}
      hideProgressBar={false}
      icon={AppToastIcon}
      limit={3}
      newestOnTop
      pauseOnFocusLoss={false}
      pauseOnHover
      role="status"
      theme="light"
      toastClassName={(context) => `app-toast app-toast--${context?.type || 'default'}`}
      progressClassName={(context) => `app-toast__progress app-toast__progress--${context?.type || 'default'}`}
      className="app-toast-viewport"
      aria-label="Notifications"
    />
  );
}
