export interface ContactSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
  turnstileToken: string;
}

type ContactErrorCode = 'rate-limit' | 'verification' | 'invalid-input' | 'unavailable';

export class ContactError extends Error {
  readonly code: ContactErrorCode;

  constructor(code: ContactError['code']) {
    super(code);
    this.code = code;
  }
}

export const contactConfigured = () => Boolean(
  import.meta.env.VITE_SUPABASE_URL
  && import.meta.env.VITE_SUPABASE_ANON_KEY
  && import.meta.env.VITE_TURNSTILE_SITE_KEY,
);

function responseError(status: number, error: unknown): ContactErrorCode {
  if (status === 429) return 'rate-limit';
  if (error === 'verification') return 'verification';
  if (error === 'invalid-input') return 'invalid-input';
  return 'unavailable';
}

export async function submitContact(submission: ContactSubmission): Promise<void> {
  if (!contactConfigured()) throw new ContactError('unavailable');

  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(submission),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json();

    if (response.ok && result?.ok === true) return;
    throw new ContactError(responseError(response.status, result?.error));
  } catch (error) {
    if (error instanceof ContactError) throw error;
    throw new ContactError('unavailable');
  }
}
