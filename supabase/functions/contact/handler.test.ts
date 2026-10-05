// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createContactHandler, type ContactConfig } from './handler';

const config: ContactConfig = { supabaseUrl: 'https://project.supabase.co', serviceKey: 'test-service', turnstileSecret: 'test-secret',
  ipHashSecret: 'a'.repeat(32), resendKey: 'test-resend', notificationTo: 'owner@example.test', notificationFrom: 'support@example.test',
  allowedOrigins: ['https://kora.example.test'] };
const body = { name: 'Reader', email: 'reader@example.test', subject: 'Bug report', message: 'Here is a useful bug report.', website: '', turnstileToken: 'proof' };
const request = (data: unknown = body, headers = {}) => new Request('https://project.supabase.co/functions/v1/contact', {
  method: 'POST', headers: { origin: config.allowedOrigins[0], 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10', ...headers }, body: JSON.stringify(data),
});
function fixture() {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true, action: 'contact', hostname: 'kora.example.test' }))
    .mockResolvedValueOnce(Response.json([{ message_id: 'message-1', retry_after: 0 }]))
    .mockResolvedValueOnce(Response.json({ id: 'notification-1' })).mockResolvedValueOnce(new Response(null, { status: 204 }));
  return { fetcher, handle: createContactHandler(config, fetcher) };
}
afterEach(() => vi.restoreAllMocks());

it('verifies Turnstile, stores privately, emails the configured recipient and records delivery', async () => {
  const { handle, fetcher } = fixture();
  const response = await handle(request());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ ok: true });
  const calls = fetcher.mock.calls;
  const save = JSON.parse(calls[1][1]!.body as string);
  expect(save.p_ip_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(save).not.toHaveProperty('ip');
  expect(save.p_email).toBe(body.email);
  expect(JSON.parse(calls[2][1]!.body as string)).toMatchObject({ to: [config.notificationTo], from: config.notificationFrom, reply_to: body.email });
  expect(calls[2][1]!.headers).toMatchObject({ 'Idempotency-Key': 'contact/message-1' });
  expect(calls[3][0]).toBe(`${config.supabaseUrl}/rest/v1/rpc/record_contact_notification`);
  expect(calls[3][1]!.method).toBe('POST');
  expect(JSON.parse(calls[3][1]!.body as string)).toEqual({ p_message_id: 'message-1', p_notification_id: 'notification-1' });
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(config.allowedOrigins[0]);
});

it.each([{ website: 'spam' }, { email: 'invalid' }, { subject: 'Injected\r\nheader' }, { name: ' ' }, { message: 'short' }, { turnstileToken: '' }])('rejects invalid input before contacting external services: %j', async (change) => {
  const { handle, fetcher } = fixture();
  expect((await handle(request({ ...body, ...change }))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([{ success: false }, { success: true, action: 'login', hostname: 'kora.example.test' }, { success: true, action: 'contact', hostname: 'evil.example' }])('rejects invalid/replayed or wrong-site Turnstile proof: %j', async (proof) => {
  const { handle, fetcher } = fixture();
  fetcher.mockReset().mockResolvedValue(Response.json(proof));
  expect((await handle(request())).status).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('rejects oversized bodies with and without Content-Length', async () => {
  const { handle, fetcher } = fixture();
  expect((await handle(request({ ...body, message: 'x'.repeat(33000) }))).status).toBe(413);
  expect((await handle(request(body, { 'content-length': '40000' }))).status).toBe(413);
  expect(fetcher).not.toHaveBeenCalled();
});

it('returns the database rate limit and does not send a notification', async () => {
  const { handle, fetcher } = fixture();
  fetcher.mockReset().mockResolvedValueOnce(Response.json({ success: true, action: 'contact', hostname: 'kora.example.test' }))
    .mockResolvedValueOnce(Response.json([{ message_id: null, retry_after: 1800 }]));
  const response = await handle(request());
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('1800');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('uses the appended gateway IP instead of spoofed forwarded prefixes or CF headers', async () => {
  const { handle, fetcher } = fixture();
  await handle(request(body, { 'x-forwarded-for': 'spoofed, 203.0.113.10', 'cf-connecting-ip': '198.51.100.1' }));
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).remoteip).toBe('203.0.113.10');
});

it('fails closed if client IP is unavailable or malformed', async () => {
  const { handle, fetcher } = fixture();
  expect((await handle(request(body, { 'x-forwarded-for': '' }))).status).toBe(503);
  expect((await handle(request(body, { 'x-forwarded-for': '999.2.3.4' }))).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});

it('preserves accepted messages when email delivery fails without leaking provider errors', async () => {
  const { handle, fetcher } = fixture();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fetcher.mockReset().mockResolvedValueOnce(Response.json({ success: true, action: 'contact', hostname: 'kora.example.test' }))
    .mockResolvedValueOnce(Response.json([{ message_id: 'message-1', retry_after: 0 }]))
    .mockResolvedValueOnce(Response.json({ error: 'private provider details' }, { status: 500 }));
  const response = await handle(request());
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ ok: true });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('does not attempt email or report success when storing the message fails', async () => {
  const { handle, fetcher } = fixture();
  fetcher.mockReset().mockResolvedValueOnce(Response.json({ success: true, action: 'contact', hostname: 'kora.example.test' }))
    .mockResolvedValueOnce(new Response(null, { status: 500 }));
  expect((await handle(request())).status).toBe(503);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('fails closed for missing config, unsupported origins and methods, but serves CORS preflight', async () => {
  const { handle, fetcher } = fixture();
  expect((await createContactHandler({ ...config, resendKey: '' }, fetcher)(request())).status).toBe(503);
  expect((await handle(request(body, { origin: 'https://evil.example' }))).status).toBe(403);
  expect((await handle(new Request('https://project.supabase.co', { headers: { origin: config.allowedOrigins[0] } }))).status).toBe(405);
  expect((await handle(new Request('https://project.supabase.co', { method: 'OPTIONS', headers: { origin: config.allowedOrigins[0] } }))).status).toBe(204);
  expect(fetcher).not.toHaveBeenCalled();
});
