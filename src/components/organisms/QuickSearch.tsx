import type { TaskAssignee } from '../../types/task.type';
import { mapWorkspaceMembersToAssignees, mockWorkspaceMembers } from '../../utils/workspaceMembers';
import type { WorkspaceMember } from '../../types/auth.type';

interface QuickSearchProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (priority: string) => void;
  filterAssignee: string;
  onFilterAssigneeChange: (assigneeName: string) => void;
  filterDueDate: string;
  onFilterDueDateChange: (dueDateStatus: string) => void;
  onClearFilters: () => void;
  workspaceMembers?: WorkspaceMember[];
}

export default function QuickSearch({
  searchQuery,
  onSearchQueryChange,
  filterPriority,
  onFilterPriorityChange,
  filterAssignee,
  onFilterAssigneeChange,
  filterDueDate,
  onFilterDueDateChange,
  onClearFilters,
  workspaceMembers = mockWorkspaceMembers,
}: QuickSearchProps) {
  const hasActiveFilters = searchQuery !== '' || filterPriority !== '' || filterAssignee !== '' || filterDueDate !== '';
  const assigneeOptions: TaskAssignee[] = mapWorkspaceMembersToAssignees(workspaceMembers);

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200/70 bg-white/72 px-6 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.035)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search tasks by title, description, label, or attachment..."
          className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-inner outline-none transition focus:border-sky-200 focus:bg-white focus:ring-4 focus:ring-sky-100"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange('')}
            type="button"
            aria-label="Clear search"
            title="Clear search"
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:text-gray-700"
          >
            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 lg:gap-4">
        {/* Priority Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority:</label>
          <select
            value={filterPriority}
            onChange={(e) => onFilterPriorityChange(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:ring-4 focus:ring-sky-100"
          >
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Lowest">Lowest</option>
          </select>
        </div>

        {/* Due Date Status Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Due date:</label>
          <select
            value={filterDueDate}
            onChange={(e) => onFilterDueDateChange(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:ring-4 focus:ring-sky-100"
          >
            <option value="">All Deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        {/* Assignee Filter (Avatar strip with selectable border) */}
        <div className="flex items-center space-x-2 border-l border-slate-200 pl-3 lg:pl-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Assignee:</label>
          <div className="flex items-center -space-x-1.5">
            {assigneeOptions.map((member) => {
              const isSelected = filterAssignee === member.name;
              return (
                <button
                  key={member.name}
                  onClick={() => onFilterAssigneeChange(isSelected ? '' : member.name)}
                  className={`relative rounded-full transition-all duration-200 cursor-pointer ${
                    isSelected ? 'z-10 scale-110 ring-2 ring-sky-500' : 'hover:z-10 hover:scale-105'
                  }`}
                  title={`Filter by ${member.name}`}
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="h-8 w-8 rounded-full border border-white object-cover"
                  />
                  {isSelected && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-blue-600 text-white rounded-full p-0.5 ring-1 ring-white">
                      <svg className="h-2 w-2" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition-[background,border,transform] hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
            </svg>
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
