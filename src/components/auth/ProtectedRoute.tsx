import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';

interface ProtectedRouteProps {
  children: ReactNode;
  onRequireAuth: () => void;
}

export default function ProtectedRoute({ children, onRequireAuth }: ProtectedRouteProps) {
  const { t } = useI18n();
  const { authMode, isAuthLoading, user } = useAuth();

  useEffect(() => {
    if (authMode === 'supabase' && !isAuthLoading && !user) {
      onRequireAuth();
    }
  }, [authMode, isAuthLoading, onRequireAuth, user]);

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">
        {t('auth.checkingSession')}
      </div>
    );
  }

  if (authMode === 'supabase' && !user) {
    return null;
  }

  return children;
}
