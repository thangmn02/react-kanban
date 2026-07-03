import { toast, type Id, type ToastContent, type ToastOptions } from 'react-toastify';

type NotifyOptions = Omit<ToastOptions, 'autoClose' | 'theme' | 'type'>;

export const notify = {
  success(message: ToastContent, options?: NotifyOptions): Id {
    return toast.success(message, { ...options, autoClose: 2500 });
  },
  error(message: ToastContent, options?: NotifyOptions): Id {
    return toast.error(message, { ...options, autoClose: 5500 });
  },
  warning(message: ToastContent, options?: NotifyOptions): Id {
    return toast.warning(message, { ...options, autoClose: 4500 });
  },
  info(message: ToastContent, options?: NotifyOptions): Id {
    return toast.info(message, { ...options, autoClose: 3000 });
  },
};
