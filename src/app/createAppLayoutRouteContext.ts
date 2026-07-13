import type { ReactNode } from 'react';

import type { AppLayoutRouteContext } from './AppLayoutRouteContext';
import type { useAppRoutingController } from './useAppRoutingController';
import type { useBoardPageController } from '../features/board/hooks/useBoardPageController';
import type { useBoardDialogState } from '../features/board/hooks/useBoardDialogState';
import type { useTaskEditorState } from '../features/task-editor/useTaskEditorState';
import type { FocusSessionValue } from '../features/focus/useFocusSessionController';
import type { AppUser, WorkspaceInvite, WorkspaceMember, WorkspaceSummary } from '../types/auth.type';
import type { OnboardingSetupValues } from '../types/onboarding.type';
import type { TodayTaskSummary } from '../services/today.service';

interface Params {
  header: ReactNode;
  user: AppUser | null;
  activeWorkspace: WorkspaceSummary | null;
  activeWorkspaceId: string | null;
  workspaceMembers: WorkspaceMember[];
  workspaceInvites: WorkspaceInvite[];
  isLoadingMembers: boolean;
  memberErrorMessage: string | null;
  isWorkspaceLoading: boolean;
  workspaceErrorMessage: string | null;
  isRetryingWorkspace: boolean;
  onRetryWorkspace: () => void;
  reloadWorkspaces: () => Promise<unknown>;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  addMember: AppLayoutRouteContext['members']['onAddMember'];
  changeMemberRole: AppLayoutRouteContext['members']['onRoleChange'];
  removeMember: AppLayoutRouteContext['members']['onRemoveMember'];
  cancelInvite: AppLayoutRouteContext['members']['onCancelInvite'];
  reloadMembers: () => Promise<void> | void;
  signOut: () => Promise<void>;
  onCompleteOnboarding: (values: OnboardingSetupValues) => Promise<void>;
  board: ReturnType<typeof useBoardPageController>['route'];
  boardDialogs: ReturnType<typeof useBoardDialogState>;
  taskEditor: ReturnType<typeof useTaskEditorState>;
  focus: FocusSessionValue;
  routing: ReturnType<typeof useAppRoutingController>;
  handleOpenQuickPlan: () => void;
  handleOpenTaskFromToday: (task: TodayTaskSummary) => void;
  isSavingBoard: boolean;
  onOpenProgressReport: () => void;
}

export function useAppLayoutRouteContextValue(params: Params): AppLayoutRouteContext {
  const { board, focus, routing } = params;
  const returnTo = typeof routing.location.state === 'object'
    && routing.location.state
    && 'returnTo' in routing.location.state
    ? String(routing.location.state.returnTo)
    : '/home';

  return {
    header: params.header,
    isBoardLoading: board.isBoardLoading,
    isSavingBoard: params.isSavingBoard,
    workspaceErrorMessage: params.workspaceErrorMessage,
    boardErrorMessage: board.boardErrorMessage,
    isRetryingWorkspace: params.isRetryingWorkspace,
    isRetryingBoard: board.isRetryingBoard,
    onRetryWorkspace: params.onRetryWorkspace,
    onRetryBoard: board.handleRetryBoard,
    auth: { onAuthenticated: () => routing.navigate(returnTo, { replace: true }) },
    onboarding: {
      userName: params.user?.name || '',
      onCompleteSetup: params.onCompleteOnboarding,
      onSignOut: params.signOut,
    },
    invite: {
      token: routing.activeInviteToken,
      currentUser: params.user!,
      onAccepted: async (workspaceId) => {
        await params.reloadWorkspaces();
        params.setActiveWorkspaceId(workspaceId);
        routing.navigate('/home');
      },
      onGoHome: () => routing.navigate('/home'),
      onSignOut: params.signOut,
    },
    notFound: {
      onGoDashboard: () => routing.navigate('/home'),
      onGoToday: () => routing.navigate('/today'),
    },
    members: {
      isOpen: true,
      workspace: params.activeWorkspace,
      currentUser: params.user!,
      members: params.workspaceMembers,
      invites: params.workspaceInvites,
      isLoading: params.isLoadingMembers,
      errorMessage: params.memberErrorMessage,
      onClose: () => routing.navigate('/home'),
      onAddMember: params.addMember,
      onRoleChange: params.changeMemberRole,
      onRemoveMember: params.removeMember,
      onCancelInvite: params.cancelInvite,
      onRetry: params.reloadMembers,
    },
    arcana: { isOpen: true, onClose: () => routing.navigate('/home') },
    home: {
      onOpenTask: board.handleOpenTaskFromHome,
      onOpenBoard: board.handleOpenBoardFromHome,
      onToggleFocusTask: focus.handleToggleFocusTaskFromHome,
      onStartFocusTask: focus.handleStartFocusTaskFromHome,
      isFocusTask: focus.isFocusTask,
      currentUser: params.user!,
      activeWorkspace: params.activeWorkspace,
      onCreateBoard: params.boardDialogs.openCreateBoardDialog,
      onCreateTask: board.handleQuickAddTask,
      onOpenQuickPlan: params.handleOpenQuickPlan,
      onOpenToday: () => routing.navigate('/today'),
      focusTaskCount: focus.focusTasks.length,
      focusSessionsToday: focus.dailyFocusStats.completedSessions,
      hasTeamMembers: params.workspaceMembers.length > 1,
    },
    today: {
      currentUser: params.user!,
      activeWorkspace: params.activeWorkspace,
      focusTasks: focus.focusTasks,
      dailyFocusStats: focus.dailyFocusStats,
      isFocusTask: focus.isFocusTask,
      onOpenTask: params.handleOpenTaskFromToday,
      onStartFocus: focus.handleStartFocusTaskFromToday,
      onToggleTodayFocus: focus.handleToggleFocusTaskFromToday,
      onQuickCreateTask: board.handleQuickAddTask,
    },
    board: {
      hasActiveBoard: Boolean(board.activeBoardId),
      workspaceName: params.activeWorkspace?.name,
      header: {
        activeBoardId: board.activeBoardId,
        activeBoardSummary: board.activeBoardSummary,
        boardSummaries: board.boardSummaries,
        activeTab: routing.activeView === 'calendar' ? 'calendar' : routing.activeView === 'table' ? 'table' : 'board',
        workspaceMembers: params.workspaceMembers,
        onBoardChange: (boardId) => {
          board.setIsBoardLoading(true);
          void board.refreshBoardData({ boardId, showErrorToast: true }).then(() => {
            if (boardId && params.activeWorkspaceId) routing.navigate(`/workspaces/${params.activeWorkspaceId}/boards/${boardId}`);
          });
        },
        onTabChange: (tab) => {
          if (!params.activeWorkspaceId || !board.activeBoardId) return;
          const suffix = tab === 'calendar' ? '/calendar' : tab === 'table' ? '/table' : '';
          routing.navigate(`/workspaces/${params.activeWorkspaceId}/boards/${board.activeBoardId}${suffix}`);
        },
        onOpenMembers: () => {
          if (params.activeWorkspaceId) routing.navigate(`/workspaces/${params.activeWorkspaceId}/members`);
        },
        onOpenActivity: params.boardDialogs.openActivityDialog,
        onQuickAddTask: board.handleQuickAddTask,
        onOpenQuickPlan: params.handleOpenQuickPlan,
        onOpenProgressReport: params.onOpenProgressReport,
        onExportCsv: board.handleExportCsv,
        onImportCsv: board.handleImportCsv,
      },
      toolbar: {
        searchQuery: board.searchQuery,
        onSearchQueryChange: board.setSearchQuery,
        filterPriority: board.filterPriority,
        onFilterPriorityChange: board.setFilterPriority,
        filterAssignee: board.filterAssignee,
        onFilterAssigneeChange: board.setFilterAssignee,
        filterDueDate: board.filterDueDate,
        onFilterDueDateChange: board.setFilterDueDate,
        onClearFilters: board.clearBoardFilters,
        workspaceMembers: params.workspaceMembers,
      },
      kanban: {
        boardData: board.boardData,
        filters: { searchQuery: board.searchQuery, priority: board.filterPriority, assignee: board.filterAssignee, dueDate: board.filterDueDate },
        ui: { openMenuId: board.openMenuId, toggleMenu: board.toggleMenu },
        handlers: {
          onEditTask: params.taskEditor.openEditTaskDialog,
          onDeleteItem: board.setDeleteItem,
          onOpenAddTask: params.taskEditor.openCreateTaskDialog,
          onOpenAddGroup: params.boardDialogs.openGroupDialog,
          onBoardPositionChange: board.handleBoardPositionChange,
          onUpdateTask: board.handleUpdateTask,
          onToggleFocusTask: focus.handleStartFocusTask,
        },
        isFocusTask: focus.isFocusTask,
        workspaceMembers: params.workspaceMembers,
        activeBoardId: board.activeBoardId,
      },
      calendar: { boardData: board.boardData, searchQuery: board.searchQuery, filterPriority: board.filterPriority, filterAssignee: board.filterAssignee, filterDueDate: board.filterDueDate, onOpenTask: params.taskEditor.openEditTaskDialog },
      table: { boardData: board.boardData, searchQuery: board.searchQuery, filterPriority: board.filterPriority, filterAssignee: board.filterAssignee, filterDueDate: board.filterDueDate, onOpenTask: params.taskEditor.openEditTaskDialog },
      empty: { workspaceName: params.activeWorkspace?.name, onCreateBoard: params.boardDialogs.openCreateBoardDialog },
    },
  };
}
