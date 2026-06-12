export const arcanaRewardStateStorageKey = 'app.arcana.rewardState';

const maxPromptsPerDay = 3;
const promptCooldownMs = 10 * 60 * 1000;

export interface ArcanaRewardState {
  date: string;
  completedCountToday: number;
  promptsShownToday: number;
  availableDraws: number;
  lastPromptAt: number | null;
}

export interface ArcanaRewardResult {
  state: ArcanaRewardState;
  shouldPrompt: boolean;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createInitialRewardState(): ArcanaRewardState {
  return {
    date: getLocalDateKey(),
    completedCountToday: 0,
    promptsShownToday: 0,
    availableDraws: 0,
    lastPromptAt: null,
  };
}

function normalizeRewardState(state: ArcanaRewardState): ArcanaRewardState {
  const today = getLocalDateKey();

  if (state.date !== today) {
    return createInitialRewardState();
  }

  return {
    date: state.date,
    completedCountToday: Number.isFinite(state.completedCountToday) ? state.completedCountToday : 0,
    promptsShownToday: Number.isFinite(state.promptsShownToday) ? state.promptsShownToday : 0,
    availableDraws: Number.isFinite(state.availableDraws) ? state.availableDraws : 0,
    lastPromptAt: Number.isFinite(state.lastPromptAt) ? state.lastPromptAt : null,
  };
}

export function readArcanaRewardState(): ArcanaRewardState {
  if (typeof window === 'undefined') {
    return createInitialRewardState();
  }

  try {
    const rawValue = window.localStorage.getItem(arcanaRewardStateStorageKey);
    if (!rawValue) return createInitialRewardState();
    return normalizeRewardState(JSON.parse(rawValue) as ArcanaRewardState);
  } catch (error) {
    console.warn('Unable to read Arcana reward state:', error);
    return createInitialRewardState();
  }
}

export function writeArcanaRewardState(state: ArcanaRewardState) {
  if (typeof window === 'undefined') return state;

  try {
    window.localStorage.setItem(arcanaRewardStateStorageKey, JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to save Arcana reward state:', error);
  }

  return state;
}

export function registerArcanaTaskCompletion(now = Date.now()): ArcanaRewardResult {
  const currentState = readArcanaRewardState();
  const completedCountToday = currentState.completedCountToday + 1;
  const isMilestone = completedCountToday === 1 || completedCountToday % 3 === 0;
  const isUnderDailyLimit = currentState.promptsShownToday < maxPromptsPerDay;
  const isPastCooldown = !currentState.lastPromptAt || now - currentState.lastPromptAt >= promptCooldownMs;
  const shouldPrompt = isMilestone && isUnderDailyLimit && isPastCooldown;

  const nextState = writeArcanaRewardState({
    ...currentState,
    completedCountToday,
    promptsShownToday: currentState.promptsShownToday + (shouldPrompt ? 1 : 0),
    availableDraws: currentState.availableDraws + (shouldPrompt ? 1 : 0),
    lastPromptAt: shouldPrompt ? now : currentState.lastPromptAt,
  });

  return {
    state: nextState,
    shouldPrompt,
  };
}

export function consumeArcanaRewardDraw() {
  const currentState = readArcanaRewardState();
  const nextState = writeArcanaRewardState({
    ...currentState,
    availableDraws: Math.max(0, currentState.availableDraws - 1),
  });

  return nextState;
}
