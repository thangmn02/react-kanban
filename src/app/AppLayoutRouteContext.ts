import type { ComponentProps, ReactNode } from 'react';

import AuthPage from '../components/auth/AuthPage';
import BoardEmptyState from '../components/board/BoardEmptyState';
import BoardHeader from '../components/board/BoardHeader';
import BoardToolbar from '../components/board/BoardToolbar';
import KanbanBoard from '../components/organisms/KanbanBoard';
import CalendarBoardView from '../components/organisms/CalendarBoardView';
import TableView from '../components/organisms/TableView';
import HomeDashboard from '../components/organisms/HomeDashboard';
import TodayPage from '../components/today/TodayPage';
import OnboardingPage from '../components/onboarding/OnboardingPage';
import AcceptInvitePage from '../components/invite/AcceptInvitePage';
import NotFoundPage from '../components/error/NotFoundPage';
import WorkspaceMembersDialog from '../components/workspace/WorkspaceMembersDialog';
import ArcanaBoothDialog from '../features/arcana/ArcanaBoothDialog';

export interface AppLayoutRouteContext {
  header: ReactNode;
  isBoardLoading: boolean;
  isSavingBoard: boolean;
  workspaceErrorMessage: string | null;
  boardErrorMessage: string | null;
  isRetryingWorkspace: boolean;
  isRetryingBoard: boolean;
  onRetryWorkspace: () => void;
  onRetryBoard: () => void;
  auth: ComponentProps<typeof AuthPage>;
  onboarding: ComponentProps<typeof OnboardingPage>;
  invite: ComponentProps<typeof AcceptInvitePage>;
  notFound: ComponentProps<typeof NotFoundPage>;
  members: ComponentProps<typeof WorkspaceMembersDialog>;
  arcana: ComponentProps<typeof ArcanaBoothDialog>;
  home: ComponentProps<typeof HomeDashboard>;
  today: ComponentProps<typeof TodayPage>;
  board: {
    hasActiveBoard: boolean;
    workspaceName?: string;
    header: ComponentProps<typeof BoardHeader>;
    toolbar: ComponentProps<typeof BoardToolbar>;
    kanban: ComponentProps<typeof KanbanBoard>;
    calendar: ComponentProps<typeof CalendarBoardView>;
    table: ComponentProps<typeof TableView>;
    empty: ComponentProps<typeof BoardEmptyState>;
  };
}
