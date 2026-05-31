import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '../../hooks/useAuth';

type AuthFormMode = 'sign-in' | 'sign-up';

interface AuthPageProps {
  onAuthenticated: () => void;
}

function getSubmitButtonLabel(mode: AuthFormMode, isSubmitting: boolean) {
  if (isSubmitting) {
    return mode === 'sign-in' ? 'Signing in...' : 'Creating account...';
  }

  return mode === 'sign-in' ? 'Sign in' : 'Create account';
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const {
    authMode,
    user,
    signInWithPassword,
    signUpWithPassword,
  } = useAuth();
  const [formMode, setFormMode] = useState<AuthFormMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authMode === 'supabase' && user) {
      onAuthenticated();
    }
  }, [authMode, onAuthenticated, user]);

  const resetFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (nextMode: AuthFormMode) => {
    setFormMode(nextMode);
    resetFeedback();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFullName = fullName.trim();

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (formMode === 'sign-in') {
        await signInWithPassword(trimmedEmail, password);
        setSuccessMessage('Signed in. Loading your workspace...');
        onAuthenticated();
        return;
      }

      const result = await signUpWithPassword(trimmedEmail, password, trimmedFullName);

      if (result.requiresEmailConfirmation) {
        setSuccessMessage('Account created. Check your email to confirm your account before signing in.');
        setFormMode('sign-in');
        setPassword('');
        return;
      }

      setSuccessMessage('Account created. Preparing your first workspace...');
      onAuthenticated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#eef6ff,transparent_34%),#F8F9FA] px-5 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-white/80 bg-white/92 shadow-[0_28px_90px_rgba(15,23,42,0.13)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden bg-[linear-gradient(145deg,#eff6ff,#ffffff_48%,#f8fafc)] p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-semibold text-white shadow-[0_14px_36px_rgba(37,99,235,0.28)]">
              K
            </div>
            <h1 className="mt-8 text-4xl font-semibold tracking-[-0.04em] text-slate-950">
              Kanban Workspace
            </h1>
            <p className="mt-4 max-w-sm text-base leading-7 text-slate-600">
              Focus-first Kanban for personal work and small teams.
            </p>
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
              Workspace-isolated boards protected by Supabase RLS.
            </div>
            <div className="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
              Realtime Kanban, Focus Dock, Pomodoro, and lightweight team flow.
            </div>
          </div>
        </aside>

        <div className="p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">
            Secure access
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
            {formMode === 'sign-in' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {formMode === 'sign-in'
              ? 'Sign in to continue to your private workspace.'
              : 'Start with a workspace, starter board, and focused task rhythm.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleModeChange('sign-in')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                formMode === 'sign-in'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('sign-up')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                formMode === 'sign-up'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Create account
            </button>
          </div>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            {formMode === 'sign-up' && (
              <label className="block" htmlFor="auth-full-name">
                <span className="text-sm font-medium text-slate-700">Full name</span>
                <input
                  id="auth-full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Your name"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="block" htmlFor="auth-email">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="block" htmlFor="auth-password">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Minimum 6 characters"
                autoComplete={formMode === 'sign-in' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            {errorMessage && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
            >
              {getSubmitButtonLabel(formMode, isSubmitting)}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            {formMode === 'sign-in'
              ? 'New here? Create an account to set up your first workspace.'
              : 'Already have an account? Switch back to sign in.'}
          </p>
        </div>
      </section>
    </main>
  );
}
