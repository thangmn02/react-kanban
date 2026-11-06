import { useState } from 'react';
import type { FormEvent } from 'react';
import { notify } from '../organisms/toast/notify';

import { DEFAULT_BOARD_TEMPLATE_ID } from '../../data/boardTemplates';
import type { OnboardingSetupValues } from '../../types/onboarding.type';
import BoardTemplatePicker from '../board/BoardTemplatePicker';
import Typography from '../atoms/Typography';
import OnboardingProgressList from './OnboardingProgressList';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [boardTitle, setBoardTitle] = useState('Personal Tasks');
  const [boardDescription, setBoardDescription] = useState('');
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
      notify.error(error instanceof Error ? error.message : 'Unable to finish onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main" className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-card">
          <Typography
            component="p"
            content={t('onboarding.workspaceSetup')}
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600"
          />
          <Typography
            component="h1"
            content={t('onboarding.setUpYourFirstBoard')}
            className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950"
          />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
            {t('onboarding.intro', { name: userName })}
          </p>

          <form className="mt-8 space-y-7" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('onboarding.workspaceName')}</span>
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder={t('onboarding.smallTeamSprint')}
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('onboarding.firstBoardTitle')}</span>
                <input
                  value={boardTitle}
                  onChange={(event) => setBoardTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder={t('onboarding.personalTasks')}
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t('onboarding.boardDescription')}</span>
              <textarea
                value={boardDescription}
                onChange={(event) => setBoardDescription(event.target.value)}
                className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder={t('onboarding.shortContextForThisBoard')}
              />
            </label>

            <div>
              <Typography
                component="p"
                content={t('onboarding.chooseAStarterTemplate')}
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
                className="cursor-pointer rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
              >
                {isSubmitting ? t('onboarding.creatingWorkspace') : t('onboarding.createWorkspaceAndBoard')}
              </button>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
              >
                {t('app.signOut')}
              </button>
            </div>
          </form>
        </section>

        <OnboardingProgressList />
      </div>
    </main>
  );
}
