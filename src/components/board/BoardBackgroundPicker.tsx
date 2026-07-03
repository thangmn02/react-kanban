import { useEffect, useState } from 'react';

import {
  BOARD_COLOR_PRESETS,
  BOARD_GRADIENT_PRESETS,
  DEFAULT_BOARD_BACKGROUND,
  getBoardBackground,
  setBoardBackground,
  type BoardBackground,
  type BoardBackgroundType,
} from '../../utils/coverBackground';
import { useI18n } from '../../i18n';

interface BoardBackgroundPickerProps {
  boardId: string;
}

/**
 * Visual board-background picker for the Board Options menu. Offers default,
 * solid color swatches, gradient swatches, and an image URL. Applies to the
 * board canvas only; column/card surfaces stay opaque white for readability.
 * Persists locally (localStorage) keyed by board ID.
 */
export default function BoardBackgroundPicker({ boardId }: BoardBackgroundPickerProps) {
  const { t } = useI18n();
  const [bg, setBg] = useState<BoardBackground>(DEFAULT_BOARD_BACKGROUND);

  useEffect(() => {
    setBg(getBoardBackground(boardId));
  }, [boardId]);

  const apply = (next: BoardBackground) => {
    setBg(next);
    setBoardBackground(boardId, next);
  };

  const handleTypeSelect = (type: BoardBackgroundType, value?: string) => {
    if (type === 'default') {
      apply(DEFAULT_BOARD_BACKGROUND);
      return;
    }
    apply({ type, value: value ?? null });
  };

  return (
    <div className="space-y-3">
      {/* Default + reset */}
      <button
        type="button"
        onClick={() => handleTypeSelect('default')}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
          bg.type === 'default'
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
        aria-pressed={bg.type === 'default'}
      >
        <span className="h-4 w-4 rounded border border-slate-200 bg-canvas" aria-hidden="true" />
        {t('board.bg.default' as never)}
      </button>

      {/* Solid colors */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {t('board.bg.color' as never)}
        </p>
        <div className="grid grid-cols-6 gap-2">
          {BOARD_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleTypeSelect('color', preset.value)}
              className={`h-8 cursor-pointer rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                bg.type === 'color' && bg.value === preset.value
                  ? 'border-slate-900 scale-110'
                  : 'border-white shadow-sm hover:scale-105'
              }`}
              style={{ backgroundColor: preset.value }}
              aria-label={preset.label}
              aria-pressed={bg.type === 'color' && bg.value === preset.value}
              title={preset.label}
            />
          ))}
        </div>
      </div>

      {/* Gradients */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {t('board.bg.gradient' as never)}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {BOARD_GRADIENT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleTypeSelect('gradient', preset.value)}
              className={`h-10 cursor-pointer rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                bg.type === 'gradient' && bg.value === preset.value
                  ? 'border-slate-900 scale-105'
                  : 'border-white shadow-sm hover:scale-105'
              }`}
              style={{ background: preset.value }}
              aria-label={preset.label}
              aria-pressed={bg.type === 'gradient' && bg.value === preset.value}
              title={preset.label}
            />
          ))}
        </div>
      </div>

      {/* Image URL */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {t('board.bg.image' as never)}
        </p>
        <input
          type="url"
          value={bg.type === 'image' ? (bg.value || '') : ''}
          onChange={(e) => {
            const url = e.target.value.trim();
            if (url) {
              apply({ type: 'image', value: url });
            } else if (bg.type === 'image') {
              apply(DEFAULT_BOARD_BACKGROUND);
            }
          }}
          placeholder={t('board.bg.imageUrlPlaceholder' as never)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
        />
      </div>
    </div>
  );
}
