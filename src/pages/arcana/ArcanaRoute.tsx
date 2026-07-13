import ArcanaBoothDialog from '../../features/arcana/ArcanaBoothDialog';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';

export default function ArcanaRoute() {
  const { header, arcana } = useAppLayoutRouteContext();
  return <div className="min-h-screen bg-canvas">{header}<ArcanaBoothDialog {...arcana} /></div>;
}
