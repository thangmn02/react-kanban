import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { ContactError, submitContact } from './contact-service';
import ContactForm from './contact-form';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Reader', email: 'reader@example.test' } }) }));
vi.mock('./contact-service', async original => ({ ...await original<typeof import('./contact-service')>(), submitContact: vi.fn() }));
let widgetOptions: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'public-test-site');
  window.turnstile = { render: vi.fn((_element, options) => { widgetOptions = options; return 'widget-1'; }), remove: vi.fn() };
});
afterEach(() => { cleanup(); delete window.turnstile; vi.unstubAllEnvs(); });
async function renderReady() {
  render(<I18nProvider><ContactForm /></I18nProvider>);
  await act(async () => {});
  act(() => (widgetOptions.callback as (token: string) => void)('verified-token'));
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'A useful idea' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Please add this useful feature.' } });
}

it('submits the verified form once, clears its message on success, and renews the single-use token', async () => {
  vi.mocked(submitContact).mockResolvedValue();
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByText(/Message received/);
  expect(submitContact).toHaveBeenCalledExactlyOnceWith({ name: 'Reader', email: 'reader@example.test', subject: 'A useful idea',
    message: 'Please add this useful feature.', website: '', turnstileToken: 'verified-token' });
  expect(screen.getByLabelText('Message')).toHaveValue('');
  expect(screen.getByLabelText('Email for a reply')).toHaveValue('reader@example.test');
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await waitFor(() => expect(window.turnstile?.remove).toHaveBeenCalledWith('widget-1'));
});

it.each(['rate-limit', 'verification', 'unavailable'] as const)('keeps the message and gives useful feedback for %s', async code => {
  vi.mocked(submitContact).mockRejectedValue(new ContactError(code));
  await renderReady();
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Message')).toHaveValue('Please add this useful feature.');
  expect(screen.queryByText(/Message received/)).not.toBeInTheDocument();
});

it('blocks duplicate submissions while the first request is pending', async () => {
  let complete!: () => void;
  vi.mocked(submitContact).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  await renderReady();
  const form = screen.getByRole('form', { name: 'Contact form' });
  fireEvent.submit(form); fireEvent.submit(form);
  expect(submitContact).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await act(async () => complete());
});

it('blocks sending without a verified token and recovers from verification failure', async () => {
  render(<I18nProvider><ContactForm /></I18nProvider>);
  await act(async () => {});
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  act(() => (widgetOptions['error-callback'] as () => void)());
  expect(screen.getByRole('alert')).toHaveTextContent('security check');
  fireEvent.click(screen.getByRole('button', { name: 'Retry security check' }));
  await act(async () => {});
  act(() => (widgetOptions.callback as (token: string) => void)('new-proof'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
});

it('does not report fake delivery or load Turnstile when contact is unconfigured', async () => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
  render(<I18nProvider><ContactForm /></I18nProvider>);
  expect(screen.getByText(/Contact is temporarily unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(window.turnstile?.render).not.toHaveBeenCalled();
  expect(submitContact).not.toHaveBeenCalled();
});

it('expires verification tokens and removes its widget on unmount', async () => {
  const view = render(<I18nProvider><ContactForm /></I18nProvider>);
  await act(async () => {});
  act(() => (widgetOptions.callback as (token: string) => void)('proof'));
  act(() => (widgetOptions['expired-callback'] as () => void)());
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  view.unmount();
  expect(window.turnstile?.remove).toHaveBeenCalledWith('widget-1');
});
