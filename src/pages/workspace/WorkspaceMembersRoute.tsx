import WorkspaceMembersDialog from '../../components/workspace/WorkspaceMembersDialog';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function WorkspaceMembersRoute() {
  const { header, members } = useAppLayoutRouteContext();
  return <div className="min-h-screen bg-canvas">{header}<main id="main"><WorkspaceMembersDialog {...members} /></main></div>;
}
