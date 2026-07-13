import NotFoundPage from '../../components/error/NotFoundPage';
import AppToastContainer from '../../components/organisms/toast/AppToastContainer';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function NotFoundRoute() {
  const { notFound } = useAppLayoutRouteContext();
  return <><NotFoundPage {...notFound} /><AppToastContainer /></>;
}
