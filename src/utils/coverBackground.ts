/**
 * Cover & board-background utilities.
 *
 * Cover image URLs reuse the existing `tasks.image` column and sync to Supabase.
 * Cover type/color/size and board background are persisted locally (localStorage)
 * keyed by entity ID so they work immediately in both mock and live mode without
 * a schema migration. See `docs/sql/cover-background-migration.sql` for the
 * proposed minimal migration to move these to full Supabase persistence.
 */

// ---------------------------------------------------------------------------
// Task cover
// ---------------------------------------------------------------------------

export type TaskCoverType = 'none' | 'color' | 'image';
export type TaskCoverSize = 'header' | 'full';

export interface TaskCover {
  type: TaskCoverType;
  color: string | null;
  size: TaskCoverSize;
  imageUrl?: string | null;
}

export interface TaskCoverUpdateEventDetail {
  taskId: string;
  cover: TaskCover;
}

export const TASK_COVER_UPDATED_EVENT = 'kanban:task-cover-updated';

export const DEFAULT_TASK_COVER: TaskCover = {
  type: 'none',
  color: null,
  size: 'header',
  imageUrl: null,
};

export interface CoverColorPreset {
  id: string;
  label: string;
  value: string;
}

/**
 * Calm, Astryx-aligned color presets. Reuses the app's semantic hue families
 * (slate/sky/blue/emerald/amber/rose/violet) plus a few complementary tones so
 * the picker feels visual without introducing clashing new hues.
 */
export const COVER_COLOR_PRESETS: CoverColorPreset[] = [
  { id: 'slate', label: 'Slate', value: '#64748b' },
  { id: 'sky', label: 'Sky', value: '#0ea5e9' },
  { id: 'blue', label: 'Blue', value: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', value: '#6366f1' },
  { id: 'violet', label: 'Violet', value: '#8b5cf6' },
  { id: 'emerald', label: 'Emerald', value: '#10b981' },
  { id: 'teal', label: 'Teal', value: '#14b8a6' },
  { id: 'amber', label: 'Amber', value: '#f59e0b' },
  { id: 'orange', label: 'Orange', value: '#f97316' },
  { id: 'rose', label: 'Rose', value: '#f43f5e' },
  { id: 'lime', label: 'Lime', value: '#84cc16' },
  { id: 'fuchsia', label: 'Fuchsia', value: '#d946ef' },
];

const TASK_COVER_PREFIX = 'kanban_task_cover_';

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') {
      return fallback;
    }

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore — localStorage may be unavailable in sandboxed contexts
  }
}

function removeKey(key: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function dispatchTaskCoverUpdate(taskId: string, cover: TaskCover): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<TaskCoverUpdateEventDetail>(TASK_COVER_UPDATED_EVENT, {
    detail: { taskId, cover },
  }));
}

export function getTaskCover(taskId: string): TaskCover {
  return readJson<TaskCover>(`${TASK_COVER_PREFIX}${taskId}`, DEFAULT_TASK_COVER);
}

export function setTaskCover(taskId: string, cover: TaskCover): void {
  const key = `${TASK_COVER_PREFIX}${taskId}`;
  if (cover.type === 'none') {
    removeKey(key);
    dispatchTaskCoverUpdate(taskId, DEFAULT_TASK_COVER);
    return;
  }
  writeJson(key, cover);
  dispatchTaskCoverUpdate(taskId, cover);
}

/**
 * Resolve the effective cover for a task, combining local presentation settings
 * with the Supabase-persisted `image` field. The image URL itself stays in
 * `tasks.image`; localStorage only controls type/color/size.
 */
export function resolveTaskCover(
  taskId: string,
  imageUrl: string | undefined,
): TaskCover & { imageUrl: string | null } {
  const cover = getTaskCover(taskId);
  const persistedImageUrl = imageUrl || null;

  if (cover.type === 'image') {
    return { ...cover, imageUrl: persistedImageUrl };
  }

  if (cover.type === 'none' && persistedImageUrl) {
    return { type: 'image', color: null, size: cover.size, imageUrl: persistedImageUrl };
  }

  return { ...cover, imageUrl: null };
}

// ---------------------------------------------------------------------------
// Board background
// ---------------------------------------------------------------------------

export type BoardBackgroundType = 'default' | 'color' | 'gradient' | 'image';

export interface BoardBackground {
  type: BoardBackgroundType;
  value: string | null;
}

export interface BoardBackgroundUpdateEventDetail {
  boardId: string;
  background: BoardBackground;
}

export const BOARD_BACKGROUND_UPDATED_EVENT = 'kanban:board-background-updated';

export const DEFAULT_BOARD_BACKGROUND: BoardBackground = {
  type: 'default',
  value: null,
};

export interface BackgroundColorPreset {
  id: string;
  label: string;
  value: string;
}

/**
 * Solid board-background colors. Kept slightly muted so white column cards
 * remain readable on top (the app's column/card surfaces are opaque white with
 * `shadow-card`, so contrast is preserved regardless of the canvas background).
 */
export const BOARD_COLOR_PRESETS: BackgroundColorPreset[] = [
  { id: 'slate', label: 'Slate', value: '#e2e8f0' },
  { id: 'sky', label: 'Sky', value: '#dbeafe' },
  { id: 'blue', label: 'Blue', value: '#bfdbfe' },
  { id: 'indigo', label: 'Indigo', value: '#e0e7ff' },
  { id: 'violet', label: 'Violet', value: '#ede9fe' },
  { id: 'emerald', label: 'Emerald', value: '#d1fae5' },
  { id: 'teal', label: 'Teal', value: '#ccfbf1' },
  { id: 'amber', label: 'Amber', value: '#fef3c7' },
  { id: 'rose', label: 'Rose', value: '#ffe4e6' },
  { id: 'dark-slate', label: 'Dark', value: '#1e293b' },
  { id: 'dark-blue', label: 'Midnight', value: '#1e3a5f' },
  { id: 'dark-green', label: 'Forest', value: '#1a3c34' },
];

export interface GradientPreset {
  id: string;
  label: string;
  value: string;
}

/**
 * Subtle gradient presets. Built from the app's hue families so they feel
 * intentional, not like the generic "AI purple gradient" aesthetic. Each
 * gradient is a CSS `linear-gradient` string ready for inline style use.
 */
export const BOARD_GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'slate-sky', label: 'Horizon', value: 'linear-gradient(135deg, #e2e8f0 0%, #dbeafe 100%)' },
  { id: 'blue-indigo', label: 'Twilight', value: 'linear-gradient(135deg, #bfdbfe 0%, #e0e7ff 100%)' },
  { id: 'emerald-teal', label: 'Meadow', value: 'linear-gradient(135deg, #d1fae5 0%, #ccfbf1 100%)' },
  { id: 'amber-rose', label: 'Sunset', value: 'linear-gradient(135deg, #fef3c7 0%, #ffe4e6 100%)' },
  { id: 'violet-fuchsia', label: 'Bloom', value: 'linear-gradient(135deg, #ede9fe 0%, #fce7f3 100%)' },
  { id: 'dark-slate-blue', label: 'Deep Sea', value: 'linear-gradient(135deg, #1e293b 0%, #1e3a5f 100%)' },
  { id: 'dark-green-teal', label: 'Aurora', value: 'linear-gradient(135deg, #1a3c34 0%, #134e4a 100%)' },
  { id: 'dark-indigo-violet', label: 'Nebula', value: 'linear-gradient(135deg, #312e81 0%, #4c1d95 100%)' },
];

const BOARD_BG_PREFIX = 'kanban_board_bg_';

function dispatchBoardBackgroundUpdate(boardId: string, background: BoardBackground): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<BoardBackgroundUpdateEventDetail>(BOARD_BACKGROUND_UPDATED_EVENT, {
    detail: { boardId, background },
  }));
}

export function getBoardBackground(boardId: string): BoardBackground {
  return readJson<BoardBackground>(`${BOARD_BG_PREFIX}${boardId}`, DEFAULT_BOARD_BACKGROUND);
}

export function setBoardBackground(boardId: string, background: BoardBackground): void {
  const key = `${BOARD_BG_PREFIX}${boardId}`;
  if (background.type === 'default') {
    removeKey(key);
    dispatchBoardBackgroundUpdate(boardId, DEFAULT_BOARD_BACKGROUND);
    return;
  }
  writeJson(key, background);
  dispatchBoardBackgroundUpdate(boardId, background);
}

/**
 * Convert a BoardBackground into a CSS `background` value suitable for the
 * board canvas's inline style. Returns `null` for the default type so the
 * canvas keeps its `bg-canvas` Tailwind class.
 */
export function getBoardBackgroundStyle(background: BoardBackground): string | null {
  if (background.type === 'default' || !background.value) {
    return null;
  }

  if (background.type === 'color') {
    return background.value;
  }

  if (background.type === 'gradient') {
    return background.value;
  }

  if (background.type === 'image') {
    return `url(${background.value}) center center / cover no-repeat`;
  }

  return null;
}

/**
 * Determines whether a background is "dark" so consumers can adjust text/overlay
 * contrast. Conservative: only the explicitly dark presets are flagged.
 */
export function isDarkBackground(background: BoardBackground): boolean {
  if (background.type === 'color' && background.value) {
    return background.value.startsWith('#0') || background.value.startsWith('#1');
  }

  if (background.type === 'gradient' && background.value) {
    return background.value.includes('#1') && !background.value.includes('#e');
  }

  return false;
}
