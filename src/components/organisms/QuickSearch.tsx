export const AVAILABLE_ASSIGNEES = [
  { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png' },
  { name: 'Roberta Casas', avatar: 'https://flowbite.com/application-ui/demo/images/users/roberta-casas.png' },
  { name: 'Michael Gough', fill: 'MG', avatar: 'https://flowbite.com/application-ui/demo/images/users/michael-gough.png' },
  { name: 'Jese Leos', avatar: 'https://flowbite.com/application-ui/demo/images/users/jese-leos.png' },
  { name: 'Leslie Livingston', avatar: 'https://flowbite.com/application-ui/demo/images/users/leslie-livingston.png' },
];

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
}: QuickSearchProps) {
  const hasActiveFilters = searchQuery !== '' || filterPriority !== '' || filterAssignee !== '' || filterDueDate !== '';

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between shadow-sm">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search tasks by title or description..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due Today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        {/* Assignee Filter (Avatar strip with selectable border) */}
        <div className="flex items-center space-x-2 border-l border-gray-200 pl-3 lg:pl-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1">Assignee:</label>
          <div className="flex items-center -space-x-1.5">
            {AVAILABLE_ASSIGNEES.map((member) => {
              const isSelected = filterAssignee === member.name;
              return (
                <button
                  key={member.name}
                  onClick={() => onFilterAssigneeChange(isSelected ? '' : member.name)}
                  className={`relative rounded-full transition-all duration-200 cursor-pointer ${
                    isSelected ? 'ring-2 ring-blue-600 scale-110 z-10' : 'hover:scale-105 hover:z-10'
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
                      <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
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
            className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 bg-blue-50 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
            </svg>
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
}
