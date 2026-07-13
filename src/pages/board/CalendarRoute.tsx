import CalendarBoardView from '../../components/organisms/CalendarBoardView';
import { useAppLayoutRouteContext } from '../../app/useAppLayoutRouteContext';
import BoardChrome from './BoardChrome';

export default function CalendarRoute() {
  const context = useAppLayoutRouteContext();
  return <BoardChrome context={context}><CalendarBoardView {...context.board.calendar} /></BoardChrome>;
}
