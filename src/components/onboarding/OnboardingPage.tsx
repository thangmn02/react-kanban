import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'react-toastify';

import { DEFAULT_BOARD_TEMPLATE_ID } from '../../data/boardTemplates';
import type { OnboardingSetupValues } from '../../types/onboarding.type';
import BoardTemplatePicker from '../board/BoardTemplatePicker';
import Typography from '../atoms/Typography';
import OnboardingProgressList from './OnboardingProgressList';

interface OnboardingPageProps {
  userName: string;
  onCompleteSetup: (setupValues: OnboardingSetupValues) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export default function OnboardingPage({
  userName,
  onCompleteSetup,
  onSignOut,
}: OnboardingPageProps) {
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [boardTitle, setBoardTitle] = useState('Personal Tasks');
  const [boardDescription, setBoardDescription] = useState('A focused board for today, this week, and done work.');
  const [templateId, setTemplateId] = useState(DEFAULT_BOARD_TEMPLATE_ID);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onCompleteSetup({
        workspaceName,
        boardTitle,
        boardDescription,
        templateId,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to finish onboarding.', {
        theme: 'colored',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="rounded-[36px] border border-white/80 bg-white p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <Typography
            component="p"
            content="Workspace setup"
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600"
          />
          <Typography
            component="h1"
            content="Set up your first board"
            className="mt-4 text-4xl font-semibold tracking-tight text-slate-950"
          />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
            Hi {userName}. Create a workspace and choose a starter board template.
            This avoids an empty dashboard and keeps production data scoped by workspace membership.
          </p>

          <form className="mt-8 space-y-7" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Workspace name</span>
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Small Team Sprint"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">First board title</span>
                <input
                  value={boardTitle}
                  onChange={(event) => setBoardTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Personal Tasks"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Board description</span>
              <textarea
                value={boardDescription}
                onChange={(event) => setBoardDescription(event.target.value)}
                className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Short context for this board"
              />
            </label>

            <div>
              <Typography
                component="p"
                content="Choose a starter template"
                className="mb-3 text-sm font-semibold text-slate-700"
              />
              <BoardTemplatePicker
                selectedTemplateId={templateId}
                onTemplateChange={setTemplateId}
                name="onboardingTemplateId"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating workspace...' : 'Create workspace and board'}
              </button>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          </form>
        </section>

        <OnboardingProgressList />
      </div>
    </main>
  );
}
