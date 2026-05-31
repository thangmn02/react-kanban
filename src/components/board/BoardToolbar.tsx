import type { WorkspaceMember } from '../../types/auth.type';
import QuickSearch from '../organisms/QuickSearch';

interface BoardToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (priority: string) => void;
  filterAssignee: string;
  onFilterAssigneeChange: (assigneeName: string) => void;
  filterDueDate: string;
  onFilterDueDateChange: (dueDateStatus: string) => void;
  onClearFilters: () => void;
  workspaceMembers: WorkspaceMember[];
}

export default function BoardToolbar(props: BoardToolbarProps) {
  return <QuickSearch {...props} />;
}
