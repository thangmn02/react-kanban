import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { AppLayoutRouteContext } from './AppLayoutRouteContext';
import { authDestination } from './auth-routing';

export default function RequireAuth() {
  const { authMode, isAuthLoading, user } = useAuth();
  const location = useLocation();
  const routeContext = useOutletContext<AppLayoutRouteContext>();

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">Checking session...</div>;
  }

  if (authMode === 'supabase' && !user) {
    return <Navigate to={authDestination(location.pathname + location.search + location.hash)} replace />;
  }

  return <Outlet context={routeContext} />;
}
