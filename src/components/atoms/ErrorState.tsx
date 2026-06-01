import { useReducedMotion } from 'framer-motion';

interface ErrorStateProps {
  /** Human-readable headline, e.g. "Couldn't load this board". */
  title: string;
  /** Short, user-facing explanation. Keep it calm and non-technical. */
  description?: string;
  /** When provided, renders a keyboard-accessible Retry button. */
  onRetry?: () => void;
  /** Label for the retry control. Defaults to "Try again". */
  retryLabel?: string;
  /** While true, the retry button shows an in-progress state and is disabled. */
  isRetrying?: boolean;
  /**
   * Raw technical detail (e.g. the caught error message). Only rendered while
   * `import.meta.env.DEV` is true so end users never see internal errors.
   */
  details?: string | null;
  /** Compact variant trims padding for inline slots. */
  compact?: boolean;
  className?: string;
}

/**
 * Shared error surface for failed data loads. Mirrors the calm slate/rose
 * direction used across the app and centralizes the retry affordance so every
 * failure path gets a consistent, accessible control.
 *
 * - Retry is a real <button>: keyboard operable, with cursor-pointer, a visible
 *   hover state, and a focus-visible ring. While retrying it is disabled with
 *   cursor-not-allowed and reduced opacity.
 * - Technical details are dev-only.
 */
export default function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  isRetrying = false,
  details,
  compact = false,
  className = '',
}: ErrorStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const showDetails = Boolean(details) && import.meta.env.DEV;

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/80 text-center ${
        compact ? 'px-4 py-6' : 'px-6 py-8'
      } ${className}`}
    >
      <p className="text-sm font-semibold text-rose-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-5 text-rose-700/90">{description}</p>
      )}

      {showDetails && (
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap rounded-lg border border-rose-200/80 bg-white/70 px-3 py-2 text-left text-[11px] leading-4 text-rose-700">
          {details}
        </pre>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          aria-busy={isRetrying}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRetrying && (
            <span
              aria-hidden="true"
              className={`h-3.5 w-3.5 rounded-full border-2 border-rose-300 border-t-rose-600 ${
                prefersReducedMotion ? '' : 'animate-spin'
              }`}
            />
          )}
          {isRetrying ? 'Retrying…' : retryLabel}
        </button>
      )}
    </div>
  );
}
