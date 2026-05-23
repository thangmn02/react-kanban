import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

function readLocalStorageValue<T>(key: string, initialValue: T) {
  if (typeof window === 'undefined') {
    return initialValue;
  }

  const storedValue = window.localStorage.getItem(key);

  if (!storedValue) {
    return initialValue;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch {
    return initialValue;
  }
}

function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => readLocalStorageValue(key, initialValue));

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(storedValue));
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
