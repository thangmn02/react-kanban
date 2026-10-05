import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useContext, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthContext } from '../contexts/AuthContext';
import { AuthProvider } from './AuthProvider';

const auth = vi.hoisted(() => ({
  getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
}));
vi.mock('../lib/supabase', () => ({ default: { auth }, authMode: 'supabase' }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it.each(['https://koraspace.online', 'http://localhost:5173', 'http://tauri.localhost'])('confirms signup on the public website when starting from %s', async origin => {
  vi.stubGlobal('location', { origin });
  const { result } = renderHook(() => useContext(AuthContext)!, {
    wrapper: ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>,
  });
  await waitFor(() => expect(result.current.isAuthLoading).toBe(false));
  let response;
  await act(async () => { response = await result.current.signUpWithPassword('reader@example.test', 'test-password', 'Reader'); });
  expect(auth.signUp).toHaveBeenCalledExactlyOnceWith({
    email: 'reader@example.test', password: 'test-password',
    options: { emailRedirectTo: 'https://koraspace.online/home', data: { full_name: 'Reader' } },
  });
  expect(response).toEqual({ requiresEmailConfirmation: true });
});
