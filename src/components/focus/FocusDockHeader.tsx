interface FocusDockHeaderProps {
  taskCount: number;
  onCollapse: () => void;
}

function FocusDockHeader({ taskCount, onCollapse }: FocusDockHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-500">
          Focus Dock
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
          {taskCount} active task{taskCount === 1 ? '' : 's'}
        </h2>
      </div>

      <button
        type="button"
        onClick={onCollapse}
        className="cursor-pointer rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
        aria-label="Minimize Focus Dock"
      >
        Minimize
      </button>
    </div>
  );
}

export default FocusDockHeader;
