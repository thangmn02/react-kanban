import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useId, useMemo, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/use-dialog-focus';
import { uiSpring } from '../../shared/motion';

import type { CommandPaletteAction } from '../../types/command.type';
import Typography from '../atoms/Typography';

interface CommandPaletteProps {
  isOpen: boolean;
  actions: CommandPaletteAction[];
  onClose: () => void;
}

function doesActionMatchQuery(action: CommandPaletteAction, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    action.title,
    action.description,
    ...action.keywords,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

export default function CommandPalette({ isOpen, actions, onClose }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const filteredActions = useMemo(() => (
    actions.filter((action) => doesActionMatchQuery(action, query)).slice(0, 8)
  ), [actions, query]);

  const closePalette = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  const runAction = (action: CommandPaletteAction) => {
    setQuery('');
    setSelectedIndex(0);
    action.run();
    onClose();
  };
  useDialogFocus(isOpen, dialogRef, closePalette, '#workspace-command-trigger');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/28 px-4 pt-24 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closePalette}
        >
          <motion.section
            ref={dialogRef} role="dialog" aria-modal="true" aria-label="Command palette" tabIndex={-1}
            className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/94 shadow-[0_30px_100px_rgba(15,23,42,0.24)] backdrop-blur-xl"
            initial={shouldReduceMotion ? false : { y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: 16, scale: 0.98, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : uiSpring}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <Typography
                component="p"
                content="Command palette"
                className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600"
              />
              <input
                role="combobox" aria-label="Search commands" aria-autocomplete="list" aria-expanded="true"
                aria-controls={listId} aria-activedescendant={filteredActions.length ? `${listId}-${Math.min(selectedIndex, filteredActions.length - 1)}` : undefined}
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    closePalette();
                  }
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const count = filteredActions.length;
                    if (count) setSelectedIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : count - 1)) % count);
                  }
                  if (event.key === 'Enter' && filteredActions[selectedIndex]) {
                    event.preventDefault(); runAction(filteredActions[selectedIndex]);
                  }
                }}
                placeholder="Search actions, pages, and quick tasks..."
                className="mt-3 w-full bg-transparent text-xl font-semibold text-slate-950 outline-none placeholder:text-slate-300"
              />
            </div>

            <div id={listId} role="listbox" aria-label="Commands" className="max-h-[min(440px,60dvh)] overflow-y-auto p-2">
              {filteredActions.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">
                  No matching commands.
                </div>
              ) : (
                filteredActions.map((action, index) => (
                  <button
                    key={action.id}
                    id={`${listId}-${index}`} role="option" aria-selected={index === selectedIndex}
                    type="button"
                    onClick={() => runAction(action)}
                    onFocus={() => setSelectedIndex(index)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${index === selectedIndex ? 'bg-slate-100' : ''}`}
                  >
                    <div>
                      <Typography
                        component="p"
                        content={action.title}
                        className="text-sm font-semibold text-slate-900"
                      />
                      <Typography
                        component="p"
                        content={action.description}
                        className="mt-1 text-xs text-slate-500"
                      />
                    </div>
                    {action.shortcut && (
                      <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-400">
                        {action.shortcut}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
