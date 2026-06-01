import Typography from '../atoms/Typography';

const onboardingSteps = [
  'Create an isolated workspace under your account.',
  'Start from a board template instead of a blank screen.',
  'Load boards through workspace membership and RLS.',
];

export default function OnboardingProgressList() {
  return (
    <aside className="rounded-3xl border border-blue-100 bg-blue-50/80 p-8 shadow-[0_24px_70px_rgba(37,99,235,0.08)]">
      <Typography
        component="p"
        content="What happens next"
        className="text-sm font-semibold text-blue-700"
      />
      <div className="mt-5 space-y-4 text-sm leading-6 text-blue-950/70">
        {onboardingSteps.map((step, index) => (
          <div key={step} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600 shadow-sm">
              {index + 1}
            </span>
            <Typography component="p" content={step} />
          </div>
        ))}
      </div>
    </aside>
  );
}
