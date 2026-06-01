import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  isChunkLoadError: boolean;
}

/**
 * Heuristic for dynamic import / chunk load failures. After a new deploy, an
 * old tab may request a hashed chunk that no longer exists; the import rejects
 * with a recognizable message. We surface "reload to get the new version" copy
 * for those instead of a generic crash message.
 */
function detectChunkLoadError(error: Error | null): boolean {
  if (!error) {
    return false;
  }

  const message = `${error.name} ${error.message}`.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('error loading dynamically imported module')
    || message.includes('importing a module script failed')
    || message.includes('chunkloaderror')
    || message.includes('loading chunk')
    || message.includes('loading css chunk')
  );
}

/**
 * App-level error boundary. Catches React render/runtime errors and shows a
 * friendly fallback instead of a blank page.
 *
 * - Does NOT touch auth/session/localStorage — recovery is a full reload or a
 *   hard navigation to the dashboard, both handled by the browser.
 * - Dev mode shows the error detail; production hides raw stack traces.
 * - Distinguishes chunk/dynamic-import load failures (stale deploy) from generic
 *   runtime crashes.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    isChunkLoadError: false,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      isChunkLoadError: detectChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Surface for diagnostics without exposing details to end users.
    console.error('[ErrorBoundary] Caught a rendering error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoDashboard = (): void => {
    window.location.assign('/home');
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, isChunkLoadError } = this.state;
    const isDev = import.meta.env.DEV;

    const title = isChunkLoadError ? 'A new version is available' : 'Something went wrong';
    const description = isChunkLoadError
      ? 'A new version is available or a file failed to load.'
      : 'The app ran into an unexpected problem. Reloading usually fixes it.';

    return (
      <main
        role="alert"
        className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-6 py-12"
      >
        <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-600">
            {isChunkLoadError ? 'Update' : 'Error'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>

          {isDev && error && (
            <pre className="mt-4 max-h-48 max-w-full overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-[11px] leading-4 text-slate-600">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              {isChunkLoadError ? 'Reload the app' : 'Reload app'}
            </button>
            <button
              type="button"
              onClick={this.handleGoDashboard}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }
}
