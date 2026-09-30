// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { handleTaskBreakdown as Handler } from '../../server/taskBreakdown';

let handle: typeof Handler;
const config = { apiKey: 'test-secret', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' };
const steps = ['Read the brief', 'Draft an outline', 'Review the outline'];
const providerResponse = (value: unknown = { steps }) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const request = (body: object, authorized = false, origin = 'http://localhost:5173') => new Request('http://localhost:5173/api/task-breakdown', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(authorized ? { Authorization: 'Bearer user-token' } : {}) }, body: JSON.stringify({ language: 'en', workspaceId: 'workspace', ...body }) });
beforeEach(async () => { vi.resetModules(); handle = (await import('../../server/taskBreakdown')).handleTaskBreakdown; });
afterEach(() => vi.unstubAllGlobals());

it('rejects unauthenticated production calls before using Gemini, including a forged local context', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await handle(request({ draftContext: { title: 'Plan a launch' }, localContext: { title: 'Forged' } }), config);
  expect(response.status).toBe(401); expect(fetcher).not.toHaveBeenCalled();
});

it('denies an inaccessible workspace before generating a draft plan', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: 'user' })).mockResolvedValueOnce(Response.json([])); vi.stubGlobal('fetch', fetcher);
  const response = await handle(request({ draftContext: { title: 'Plan a launch' } }, true), config);
  expect(response.status).toBe(403); expect(fetcher).toHaveBeenCalledTimes(2);
});

it('loads task context with the user RLS token and returns only validated suggestions', async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ id: 'user' }))
    .mockResolvedValueOnce(Response.json([{ title: 'Real task', description: '<p>Real notes</p>', is_done: false }]))
    .mockResolvedValueOnce(Response.json([{ content: 'Existing work' }]))
    .mockResolvedValueOnce(providerResponse());
  vi.stubGlobal('fetch', fetcher);
  const response = await handle(request({ taskId: 'task', localContext: { title: 'Forged' } }, true), config);
  expect(await response.json()).toEqual({ steps });
  expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer user-token');
  expect(fetcher.mock.calls[1][0]).toContain('workspace_id=eq.workspace');
  const payload = JSON.parse(fetcher.mock.calls[3][1].body);
  expect(payload.contents[0].parts[0].text).toContain('Real task');
  expect(payload.contents[0].parts[0].text).not.toContain('Forged');
  expect(fetcher.mock.calls[3][1].headers['x-goog-api-key']).toBe('test-secret');
});

it('allows loopback demo drafts, rejects malformed model output and cross-origin demo requests', async () => {
  const fetcher = vi.fn().mockResolvedValue(providerResponse({ steps: ['same', 'same', 'same'] })); vi.stubGlobal('fetch', fetcher);
  const response = await handle(request({ draftContext: { title: 'Mission' } }), { ...config, allowLocalMock: true });
  expect(response.status).toBe(502); expect(await response.json()).toEqual({ error: 'invalid_response' });
  const foreign = await handle(request({ draftContext: { title: 'Mission' } }, false, 'https://foreign.example'), { ...config, allowLocalMock: true });
  expect(foreign.status).toBe(401); expect(fetcher).toHaveBeenCalledTimes(1);
});

it('limits per-user requests and never returns provider errors or secrets', async () => {
  const fetcher = vi.fn().mockImplementation(async () => providerResponse()); vi.stubGlobal('fetch', fetcher);
  for (let i = 0; i < 5; i++) expect((await handle(request({ draftContext: { title: 'Mission' } }), { ...config, allowLocalMock: true })).status).toBe(200);
  const limited = await handle(request({ draftContext: { title: 'Mission' } }), { ...config, allowLocalMock: true });
  expect(limited.status).toBe(429); expect(fetcher).toHaveBeenCalledTimes(5);
});

it('maps provider quota failures without exposing provider response bodies', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'sensitive provider diagnostic' }, { status: 429 })));
  const response = await handle(request({ draftContext: { title: 'Mission' } }), { ...config, allowLocalMock: true });
  expect(response.status).toBe(429); expect(await response.json()).toEqual({ error: 'rate_limited' });
});
