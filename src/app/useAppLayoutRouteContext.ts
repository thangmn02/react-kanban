import { useOutletContext } from 'react-router-dom';

import type { AppLayoutRouteContext } from './AppLayoutRouteContext';

export function useAppLayoutRouteContext() {
  return useOutletContext<AppLayoutRouteContext>();
}
