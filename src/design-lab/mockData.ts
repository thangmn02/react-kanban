// Static mock data for the Quiet Velocity design lab.
// Preview-only: no Supabase, no auth, no mutations. Safe to delete with the lab.

export interface MockTask {
  id: string;
  title: string;
  boardTitle: string;
  listTitle: string;
  priority: 'High' | 'Medium' | 'Low' | 'Lowest' | null;
  dueDate: string | null;
  isDone: boolean;
  assignees: { name: string; avatar: string }[];
  checklist: { done: number; total: number } | null;
  attachments: number;
}

export const MOCK_USER = {
  name: 'Avery Quinn',
  workspace: 'Northwind Studio',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Avery%20Quinn',
};

function avatar(seed: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export const MOCK_FOCUS_TASKS: MockTask[] = [
  {
    id: 't-1',
    title: 'Draft the Q3 onboarding flow',
    boardTitle: 'Product',
    listTitle: 'In progress',
    priority: 'High',
    dueDate: new Date().toISOString().slice(0, 10),
    isDone: false,
    assignees: [{ name: 'Avery Quinn', avatar: avatar('Avery Quinn') }],
    checklist: { done: 2, total: 5 },
    attachments: 1,
  },
  {
    id: 't-2',
    title: 'Review the API pull request',
    boardTitle: 'Engineering',
    listTitle: 'Review',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    isDone: false,
    assignees: [{ name: 'Sam Rivera', avatar: avatar('Sam Rivera') }],
    checklist: null,
    attachments: 0,
  },
  {
    id: 't-3',
    title: 'Write release notes for v2.4',
    boardTitle: 'Product',
    listTitle: 'Todo',
    priority: 'Low',
    dueDate: null,
    isDone: false,
    assignees: [{ name: 'Avery Quinn', avatar: avatar('Avery Quinn') }],
    checklist: { done: 0, total: 3 },
    attachments: 2,
  },
];

export const MOCK_OVERDUE_TASKS: MockTask[] = [
  {
    id: 'o-1',
    title: 'Send sponsor follow-up email',
    boardTitle: 'Marketing',
    listTitle: 'Todo',
    priority: 'High',
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    isDone: false,
    assignees: [{ name: 'Avery Quinn', avatar: avatar('Avery Quinn') }],
    checklist: null,
    attachments: 0,
  },
];

export const MOCK_RECENT_BOARDS = [
  { id: 'b-1', title: 'Product', taskCount: 18, updatedLabel: 'Today' },
  { id: 'b-2', title: 'Engineering', taskCount: 24, updatedLabel: 'Yesterday' },
  { id: 'b-3', title: 'Marketing', taskCount: 9, updatedLabel: '2 days ago' },
];

export const MOCK_FOCUS_STATS = {
  completedSessions: 3,
  focusedMinutes: 75,
  interruptedSessions: 1,
  topTaskTitle: 'Draft the Q3 onboarding flow',
};

export interface MockColumn {
  id: string;
  title: string;
  tasks: MockTask[];
}

export const MOCK_BOARD_COLUMNS: MockColumn[] = [
  {
    id: 'c-1',
    title: 'Todo',
    tasks: [MOCK_FOCUS_TASKS[2], MOCK_OVERDUE_TASKS[0]],
  },
  {
    id: 'c-2',
    title: 'In progress',
    tasks: [MOCK_FOCUS_TASKS[0]],
  },
  {
    id: 'c-3',
    title: 'Review',
    tasks: [MOCK_FOCUS_TASKS[1]],
  },
  {
    id: 'c-4',
    title: 'Done',
    tasks: [
      {
        id: 'd-1',
        title: 'Ship dark-mode token audit',
        boardTitle: 'Product',
        listTitle: 'Done',
        priority: 'Medium',
        dueDate: null,
        isDone: true,
        assignees: [{ name: 'Sam Rivera', avatar: avatar('Sam Rivera') }],
        checklist: { done: 4, total: 4 },
        attachments: 0,
      },
    ],
  },
];

export const MOCK_COMPLETED_SESSION = {
  taskTitle: 'Draft the Q3 onboarding flow',
  durationLabel: '25:00',
  mode: 'Focus' as const,
  completedAtLabel: 'just now',
};
