import { createContext, useCallback, useContext, useState, type SetStateAction } from 'react';

export const ViewContext = createContext<{ cache: Map<string, unknown>; pathname: string } | null>(null);

/** Memory scoped to the mounted workspace; never writes product persistence. */
export function useRetainedViewState<T>(name: string, initial: () => T) {
  const context = useContext(ViewContext);
  const cache = context?.cache;
  const key = `${context?.pathname ?? 'standalone'}:${name}`;
  const [value, setValue] = useState<T>(() => cache?.has(key) ? cache.get(key) as T : initial());
  const update = useCallback((next: SetStateAction<T>) => {
    setValue(current => {
      const resolved = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      cache?.set(key, resolved);
      return resolved;
    });
  }, [cache, key]);
  return [value, update] as const;
}
