import AcceptInvitePage from '../../components/invite/AcceptInvitePage';
import AuthPage from '../../components/auth/AuthPage';
import AppToastContainer from '../../components/organisms/toast/AppToastContainer';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import { useAuth } from '../../hooks/useAuth';

export default function InviteRoute() {
  const { invite } = useAppLayoutRouteContext();
  const { authMode, user } = useAuth();
  if (authMode === 'supabase' && !user) {
    return <><AuthPage onAuthenticated={() => undefined} /><AppToastContainer /></>;
  }
  return <><AcceptInvitePage {...invite} /><AppToastContainer /></>;
}
