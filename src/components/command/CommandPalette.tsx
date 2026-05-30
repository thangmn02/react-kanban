import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const filteredActions = useMemo(() => (
    actions.filter((action) => doesActionMatchQuery(action, query)).slice(0, 8)
  ), [actions, query]);

  const closePalette = () => {
    setQuery('');
    onClose();
  };

  const runAction = (action: CommandPaletteAction) => {
    setQuery('');
    action.run();
    onClose();
  };

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
            className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/94 shadow-[0_30px_100px_rgba(15,23,42,0.24)] backdrop-blur-xl"
            initial={{ y: 20, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <Typography
                component="p"
                content="Command palette"
                className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    closePalette();
                  }

                  if (event.key === 'Enter' && filteredActions[0]) {
                    runAction(filteredActions[0]);
                  }
                }}
                placeholder="Search actions, pages, and quick tasks..."
                className="mt-3 w-full bg-transparent text-xl font-semibold text-slate-950 outline-none placeholder:text-slate-300"
              />
            </div>

            <div className="max-h-[440px] overflow-y-auto p-2">
              {filteredActions.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">
                  No matching commands.
                </div>
              ) : (
                filteredActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => runAction(action)}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
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
