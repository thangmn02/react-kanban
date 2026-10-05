export interface ContactConfig {
  supabaseUrl: string;
  serviceKey: string;
  turnstileSecret: string;
  ipHashSecret: string;
  resendKey: string;
  notificationTo: string;
  notificationFrom: string;
  allowedOrigins: string[];
}

interface ContactBody {
  name: string;
  email: string;
  subject: string;
  message: string;
  turnstileToken: string;
}

type BodyReadResult = { body: Record<string, unknown> } | { errorStatus: 400 | 413 };

const MAX_BODY_BYTES = 32000;

function clientIp(request: Request): string | undefined {
  // Hosted gateway appends the peer IP. Never use a caller's leftmost entry,
  // custom CF header, or body value as the rate-limit identity.
  const raw = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  if (!raw) return;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw) && raw.split('.').every(part => Number(part) <= 255)) {
    return raw.split('.').map(Number).join('.');
  }
  if (/^[a-f\d:.]+$/i.test(raw) && raw.includes(':')) {
    try { return new URL(`http://[${raw}]`).hostname.slice(1, -1); } catch { /* Invalid IPv6. */ }
  }
}

async function hashIp(ip: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readBody(request: Request): Promise<BodyReadResult> {
  try {
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return { errorStatus: 413 };

    const reader = request.body?.getReader();
    if (!reader) return { errorStatus: 400 };

    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      size += value.length;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { errorStatus: 413 };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || Array.isArray(body) || typeof body !== 'object') return { errorStatus: 400 };
    return { body: body as Record<string, unknown> };
  } catch {
    return { errorStatus: 400 };
  }
}

function validText(value: unknown, min: number, max: number): value is string {
  if (typeof value !== 'string') return false;
  const length = value.trim().length;
  return length >= min && length <= max;
}

function parseContactBody(body: Record<string, unknown>): ContactBody | undefined {
  if (typeof body.website !== 'string' || body.website.length > 0) return;
  if (!validText(body.name, 1, 100)
    || !validText(body.email, 3, 254)
    || !validText(body.subject, 1, 150)
    || !validText(body.message, 10, 5000)
    || !validText(body.turnstileToken, 1, 2048)) return;

  const name = body.name.trim();
  const email = body.email.trim();
  const subject = body.subject.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  if (Array.from(body.name + body.email + body.subject).some(char => char.charCodeAt(0) < 32)) return;

  return {
    name,
    email,
    subject,
    message: body.message.trim(),
    turnstileToken: body.turnstileToken,
  };
}

export function createContactHandler(config: ContactConfig, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') || '';
    const allowedOrigin = config.allowedOrigins.includes(origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}),
    };
    const reply = (status: number, body: object, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
    if (!allowedOrigin) return reply(403, { error: 'origin' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'method' }, { Allow: 'POST, OPTIONS' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { error: 'invalid-input' });

    // Bound streaming input too; Content-Length can be missing or forged.
    const bodyResult = await readBody(request);
    if ('errorStatus' in bodyResult) return reply(bodyResult.errorStatus, { error: 'invalid-input' });

    const submission = parseContactBody(bodyResult.body);
    if (!submission) return reply(400, { error: 'invalid-input' });
    if (!config.supabaseUrl || !config.serviceKey || !config.turnstileSecret || config.ipHashSecret.length < 32
      || !config.resendKey || !config.notificationTo || !config.notificationFrom) return reply(503, { error: 'unavailable' });
    const ip = clientIp(request);
    if (!ip) return reply(503, { error: 'unavailable' });
    const { name, email, subject, message, turnstileToken } = submission;
    const timedFetch = (url: string, options: RequestInit) => fetcher(url, { ...options, signal: AbortSignal.timeout(10000) });
    const serviceHeaders = { 'Content-Type': 'application/json', apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
    try {
      const verification = await timedFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: config.turnstileSecret, response: turnstileToken, remoteip: ip }),
      });
      if (!verification.ok) return reply(503, { error: 'verification' });
      const proof = await verification.json();
      const hostnames = config.allowedOrigins.map(item => new URL(item).hostname);
      if (proof.success !== true || proof.action !== 'contact' || !hostnames.includes(proof.hostname)) return reply(400, { error: 'verification' });
      const saved = await timedFetch(`${config.supabaseUrl}/rest/v1/rpc/submit_contact_message`, {
        method: 'POST', headers: serviceHeaders,
        body: JSON.stringify({ p_ip_hash: await hashIp(ip, config.ipHashSecret), p_name: name, p_email: email, p_subject: subject, p_message: message }),
      });
      if (!saved.ok) return reply(503, { error: 'unavailable' });
      const result = (await saved.json())[0];
      if (!result?.message_id) {
        if (Number.isInteger(result?.retry_after) && result.retry_after > 0) return reply(429, { error: 'rate-limit' }, { 'Retry-After': String(result.retry_after) });
        return reply(503, { error: 'unavailable' });
      }
      // Never roll back a received message or invite duplicate submissions
      // because notification delivery fails. Pending rows remain reviewable.
      let notified = false;
      try {
        const notification = await timedFetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.resendKey}`,
            'Idempotency-Key': `contact/${result.message_id}` },
          body: JSON.stringify({ from: config.notificationFrom, to: [config.notificationTo], reply_to: email,
            subject: `Kora contact: ${subject}`, text: `From: ${name} <${email}>\n\n${message}\n\nMessage ID: ${result.message_id}` }),
        });
        if (notification.ok) {
          const delivered = await notification.json();
          if (typeof delivered.id === 'string') {
            const marked = await timedFetch(`${config.supabaseUrl}/rest/v1/rpc/record_contact_notification`, {
              method: 'POST', headers: serviceHeaders,
              body: JSON.stringify({ p_message_id: result.message_id, p_notification_id: delivered.id }),
            });
            notified = marked.ok;
          }
        }
      } catch { /* The stored message is still available for manual review. */ }
      if (!notified) console.warn('Contact notification pending; review private contact_messages.');
      return reply(202, { ok: true });
    } catch { return reply(503, { error: 'unavailable' }); }
  };
}
