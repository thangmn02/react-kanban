/**
 * Namespaced, typed browser-storage adapter.
 *
 * Replaces ad-hoc `window.localStorage` calls scattered across features.
 * Every key follows the scheme:
 *
 *   kanban:{userId}:{workspaceId}:{feature}:v{schemaVersion}
 *
 * This guarantees that switching users or workspaces never leaks cached data
 * from one context into another, and that a schema bump can invalidate stale
 * payloads safely.
 */

export interface StorageScope {
  /** Authenticated user id, or "mock-user" in local demo mode. */
  userId: string | null;
  /** Active workspace id, or null for global preferences. */
  workspaceId: string | null;
}

const KEY_PREFIX = 'kanban';
const SCHEMA_VERSION = 1;
const GLOBAL_NAMESPACE = 'global';
const ANONYMOUS_USER = 'anon';

/** Builds a deterministic, namespaced storage key for a given feature. */
export function buildStorageKey(scope: StorageScope, feature: string): string {
  const userPart = scope.userId ?? ANONYMOUS_USER;
  const workspacePart = scope.workspaceId ?? GLOBAL_NAMESPACE;
  return `${KEY_PREFIX}:${userPart}:${workspacePart}:${feature}:v${SCHEMA_VERSION}`;
}

/** Reads and JSON-parses a scoped value, returning `fallback` on miss/error. */
export function readScopedJSON<T>(scope: StorageScope, feature: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(buildStorageKey(scope, feature));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** JSON-serializes and writes a scoped value. Silently ignores quota errors. */
export function writeScopedJSON<T>(scope: StorageScope, feature: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(scope, feature), JSON.stringify(value));
  } catch {
    // Quota exceeded or serialization failure — ignore to avoid crashing the UI.
  }
}

/** Removes a single scoped key. */
export function removeScopedKey(scope: StorageScope, feature: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(buildStorageKey(scope, feature));
  } catch {
    // ignore
  }
}

/**
 * Removes every namespaced key that belongs to `userId`.
 * Call this on sign-out / session expiry to prevent cross-account data leakage.
 */
export function clearUserData(userId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const prefix = `${KEY_PREFIX}:${userId}:`;
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}

/**
 * Reads and JSON-parses a **global** (non-scoped) preference value.
 * Use this only for preferences that are deliberately user-independent,
 * such as the selected UI language or the reduce-motion override.
 */
export function readGlobalJSON<T>(feature: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(`${KEY_PREFIX}:global:${feature}:v${SCHEMA_VERSION}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Writes a global (non-scoped) preference value. */
export function writeGlobalJSON<T>(feature: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${KEY_PREFIX}:global:${feature}:v${SCHEMA_VERSION}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}
