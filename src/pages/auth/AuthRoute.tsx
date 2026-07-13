import AuthPage from '../../components/auth/AuthPage';
import AppToastContainer from '../../components/organisms/toast/AppToastContainer';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function AuthRoute() {
  const { auth } = useAppLayoutRouteContext();
  return <><AuthPage {...auth} /><AppToastContainer /></>;
}
