import TableView from '../../components/organisms/TableView';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import BoardChrome from './BoardChrome';

export default function TableRoute() {
  const context = useAppLayoutRouteContext();
  return <BoardChrome context={context}><TableView {...context.board.table} /></BoardChrome>;
}
