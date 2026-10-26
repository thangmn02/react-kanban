import TodayPage from '../../components/today/TodayPage';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function TodayRoute() {
  const { header, today } = useAppLayoutRouteContext();
  return <div className="min-h-screen bg-canvas">{header}<TodayPage key={`${today.currentUser.id}:${today.activeWorkspace?.id}`} {...today} /></div>;
}
