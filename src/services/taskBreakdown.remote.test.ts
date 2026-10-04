import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ native: false, session: { access_token: 'test-user-token' } as { access_token: string } | null }));
vi.mock('../features/native/runtime', () => ({ isNativeWidget: () => state.native }));
vi.mock('../lib/supabase', () => ({ default: { auth: { getSession: async () => ({ data: { session: state.session }, error: null }) } } }));
import { generateTaskBreakdown } from './taskBreakdown.service';
const input = { workspaceId: 'workspace', language: 'en' as const, draftContext: { title: 'Read the book', description: '', existingSteps: [] } };
beforeEach(() => { state.native = false; state.session = { access_token: 'test-user-token' }; });
afterEach(() => vi.unstubAllGlobals());
it.each([false, true])('routes authenticated native=%s requests to the proper backend', async (native) => {
  state.native = native;
  const fetcher = vi.fn().mockResolvedValue(Response.json({ steps: ['Open the book', 'Read the first chapter', 'Write a summary'] }));
  vi.stubGlobal('fetch', fetcher);
  await generateTaskBreakdown(input, new AbortController().signal);
  expect(fetcher.mock.calls[0][0]).toBe(native ? 'https://kanthangboard.netlify.app/api/task-breakdown' : '/api/task-breakdown');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-user-token');
});
it('requires native sign-in before contacting the hosted API', async () => {
  state.native = true; state.session = null;
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(generateTaskBreakdown(input, new AbortController().signal)).rejects.toThrow('unauthorized');
  expect(fetcher).not.toHaveBeenCalled();
});
