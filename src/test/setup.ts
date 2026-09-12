// Test setup: registered for every Vitest run via vitest.config.ts
// `setupFiles`. Adds custom jest-dom matchers (`toBeInTheDocument`, etc.)
// so component tests can use them without per-file imports.
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    // Ignore if already defined
  }
}