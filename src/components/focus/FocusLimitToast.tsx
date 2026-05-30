interface FocusLimitToastProps {
  message: string | null;
  onDismiss: () => void;
}

function FocusLimitToast({ message, onDismiss }: FocusLimitToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-[0_14px_40px_rgba(146,64,14,0.16)]">
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-3 rounded-full px-2 text-amber-700 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
        aria-label="Dismiss focus limit message"
      >
        ×
      </button>
    </div>
  );
}

export default FocusLimitToast;
