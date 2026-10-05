import { createContactHandler } from './handler.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const env = (name: string) => Deno.env.get(name) || '';
Deno.serve(createContactHandler({
  supabaseUrl: env('SUPABASE_URL'), serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  turnstileSecret: env('TURNSTILE_SECRET_KEY'), ipHashSecret: env('CONTACT_IP_HASH_SECRET'),
  resendKey: env('RESEND_API_KEY'), notificationTo: env('CONTACT_NOTIFICATION_TO'),
  notificationFrom: env('CONTACT_NOTIFICATION_FROM'),
  allowedOrigins: env('CONTACT_ALLOWED_ORIGINS').split(',').map(item => item.trim()).filter(Boolean),
}));
