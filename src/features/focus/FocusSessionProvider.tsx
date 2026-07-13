import type { ReactNode } from 'react';

import type { FocusSessionValue } from './useFocusSessionController';
import { FocusSessionContext } from './focusSessionContext';

export function FocusSessionProvider({ value, children }: { value: FocusSessionValue; children: ReactNode }) {
  return <FocusSessionContext.Provider value={value}>{children}</FocusSessionContext.Provider>;
}
