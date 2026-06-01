interface CommandTriggerProps {
  onOpen: () => void;
  /** Keyboard hint shown on the right (e.g. "Ctrl K"). */
  shortcutHint?: string;
  placeholder?: string;
}

/**
 * Input-styled button that opens the Command Palette. Extracted from AppHeader
 * to standardize the search/command affordance (Linear/GitHub pro-tool control
 * rigor): consistent slate field styling, a clear focus-visible ring, and a
 * keyboard-shortcut chip. Behavior is unchanged — it just calls onOpen.
 */
export default function CommandTrigger({
  onOpen,
  shortcutHint = 'Ctrl K',
  placeholder = 'Search or command...',
}: CommandTriggerProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 sm:w-full sm:max-w-sm sm:justify-between sm:px-3"
      aria-label="Open command menu"
    >
      <span className="flex items-center gap-2">
        <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <span className="hidden text-sm font-medium sm:inline">{placeholder}</span>
      </span>
      <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 sm:inline">
        {shortcutHint}
      </kbd>
    </button>
  );
}
