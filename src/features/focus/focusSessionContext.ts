import { createContext, useContext } from 'react';

import type { FocusSessionValue } from './useFocusSessionController';

export const FocusSessionContext = createContext<FocusSessionValue | null>(null);

export function useFocusSession() {
  const value = useContext(FocusSessionContext);
  if (!value) throw new Error('useFocusSession must be used within FocusSessionProvider');
  return value;
}
