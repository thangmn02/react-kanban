import Typography from '../atoms/Typography';

interface BoardEmptyStateProps {
  workspaceName?: string;
  onCreateBoard: () => void;
}

export default function BoardEmptyState({ workspaceName, onCreateBoard }: BoardEmptyStateProps) {
  return (
    <section className="flex min-h-[520px] items-center justify-center bg-[#F8F9FA] px-6 py-12">
      <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <Typography
          component="p"
          content={workspaceName ? workspaceName : 'Workspace'}
          className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600"
        />
        <Typography
          component="h2"
          content="Create your first board"
          className="mt-3 text-3xl font-semibold tracking-tight text-slate-950"
        />
        <Typography
          component="p"
          content="Start from a lightweight template so your workspace has useful lists immediately."
          className="mt-3 text-sm leading-6 text-slate-500"
        />
        <button
          type="button"
          onClick={onCreateBoard}
          className="mt-6 cursor-pointer rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        >
          Create board
        </button>
      </div>
    </section>
  );
}
