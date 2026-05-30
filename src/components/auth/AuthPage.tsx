import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'react-toastify';

import { useAuth } from '../../hooks/useAuth';

interface AuthPageProps {
  onAuthenticated: () => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (authMode === 'sign-in') {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password, fullName);
        toast.info('Account created. Check email confirmation if your Supabase project requires it.', {
          theme: 'colored',
        });
      }

      onAuthenticated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Authentication failed.', {
        theme: 'colored',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#eef6ff,transparent_34%),#F8F9FA] px-6 py-10">
      <section className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">
          Focus-first Kanban
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {authMode === 'sign-in' ? 'Welcome back' : 'Create your workspace account'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Sign in with Supabase Auth to keep boards isolated by workspace and protected by RLS.
        </p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {authMode === 'sign-up' && (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Your name"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              placeholder="Minimum 6 characters"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Working...' : authMode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}
          className="mt-5 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {authMode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
}
