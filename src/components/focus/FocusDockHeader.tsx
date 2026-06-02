interface FocusDockHeaderProps {
  taskCount: number;
  onCollapse: () => void;
}

function FocusDockHeader({ taskCount, onCollapse }: FocusDockHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          Focus Dock
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
          {taskCount} active task{taskCount === 1 ? '' : 's'}
        </h2>
      </div>

      <button
        type="button"
        onClick={onCollapse}
        className="cursor-pointer rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        aria-label="Minimize Focus Dock"
      >
        Minimize
      </button>
    </div>
  );
}

export default FocusDockHeader;
