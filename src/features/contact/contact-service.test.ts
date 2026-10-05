import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { submitContact } from './contact-service';

const submission = { name: 'Reader', email: 'reader@example.test', subject: 'Idea', message: 'A useful suggestion', website: '', turnstileToken: 'proof' };
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key');
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'public-site');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('posts only sender fields and public credentials to the Edge Function', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 202 })); vi.stubGlobal('fetch', fetcher);
  await submitContact(submission);
  expect(fetcher).toHaveBeenCalledWith('https://project.supabase.co/functions/v1/contact', expect.objectContaining({ method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: 'public-key' }, body: JSON.stringify(submission) }));
});
it('reports rate limits without passing through server details', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'private details' }, { status: 429 })));
  await expect(submitContact(submission)).rejects.toMatchObject({ code: 'rate-limit' });
});
it('rejects malformed acknowledgments and connection failures', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ queued: true })).mockRejectedValueOnce(new Error('private detail'));
  vi.stubGlobal('fetch', fetcher);
  await expect(submitContact(submission)).rejects.toMatchObject({ code: 'unavailable' });
  await expect(submitContact(submission)).rejects.toMatchObject({ code: 'unavailable' });
});
