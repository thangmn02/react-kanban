import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { contactConfigured, ContactError, submitContact } from './contact-service';
import TurnstileWidget from './turnstile-widget';

export default function ContactForm() {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [feedback, setFeedback] = useState<'success' | ContactError['code'] | ''>('');
  const configured = contactConfigured();
  const onToken = useCallback((value: string) => { setToken(value); if (value) setVerificationFailed(false); }, []);
  const onError = useCallback(() => setVerificationFailed(true), []);
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:opacity-60';
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || !configured || !token) return;
    if (!name.trim() || !subject.trim() || message.trim().length < 10) { setFeedback('invalid-input'); return; }
    submitting.current = true;
    setBusy(true); setFeedback('');
    try {
      await submitContact({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), website, turnstileToken: token });
      setSubject(''); setMessage(''); setFeedback('success');
    } catch (error) { setFeedback(error instanceof ContactError ? error.code : 'unavailable'); }
    finally { submitting.current = false; setBusy(false); setToken(''); setResetKey(value => value + 1); }
  };
  return <section className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{t('contact.eyebrow')}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{t('contact.title')}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">{t('contact.description')}</p>
    <form onSubmit={event => void send(event)} className="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-label={t('contact.form')}>
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium text-slate-700" htmlFor="contact-name">
            <span>{t('contact.name')}</span><input id="contact-name" name="name" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} className={inputClass} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700" htmlFor="contact-email">
            <span>{t('contact.email')}</span><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-medium text-slate-700" htmlFor="contact-subject">
          <span>{t('contact.subject')}</span><input id="contact-subject" name="subject" required maxLength={150} value={subject} onChange={event => setSubject(event.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-2 text-sm font-medium text-slate-700" htmlFor="contact-message">
          <span>{t('contact.message')}</span><textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={6} value={message} onChange={event => setMessage(event.target.value)} className={`${inputClass} resize-y`} placeholder={t('contact.messagePlaceholder')} aria-describedby="contact-privacy" />
        </label>
        <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} />
        </div>
      </fieldset>
      <p id="contact-privacy" className="text-xs leading-5 text-slate-500">{t('contact.privacy')}</p>
      {configured ? <TurnstileWidget siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} language={language} resetKey={resetKey} onToken={onToken} onError={onError} />
        : <p role="status" className="text-sm text-slate-600">{t('contact.unavailable')}</p>}
      {configured && !token && !verificationFailed && <p role="status" className="text-xs text-slate-500">{t('contact.verifying')}</p>}
      {verificationFailed && <div role="alert" className="space-y-2 text-sm text-rose-700">
        <p>{t('contact.verification')}</p><button type="button" onClick={() => { setVerificationFailed(false); setResetKey(value => value + 1); }} className="cursor-pointer underline">{t('contact.retry')}</button>
      </div>}
      {feedback && <p role={feedback === 'success' ? 'status' : 'alert'} className={`rounded-xl px-4 py-3 text-sm ${feedback === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
        {t(feedback === 'success' ? 'contact.success' : feedback === 'rate-limit' ? 'contact.rateLimit'
          : feedback === 'verification' ? 'contact.verification' : feedback === 'invalid-input' ? 'contact.invalidInput' : 'contact.failed')}
      </p>}
      <button type="submit" disabled={busy || !configured || !token} className="min-h-11 w-full cursor-pointer rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        {t(busy ? 'contact.sending' : 'contact.send')}
      </button>
    </form>
  </section>;
}
