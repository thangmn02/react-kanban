import { addDays, format, subDays } from 'date-fns';

import type { BoardData } from './types/task.type';
export const data: BoardData = {
  columns: ['list1', 'list2', 'list3'],
  list: {
    list1: {
      id: 'list1',
      title: 'List 1',
      tasks: ['task1', 'task2'],
    },
    list2: {
      id: 'list2',
      title: 'List 2',
      tasks: ['task3'],
    },
    list3: {
      id: 'list3',
      title: 'List 3',
      tasks: [],
    },
  },
  task: {
    task1: {
      id: 'task1',
      title: 'Redesign tables card',
      description: 'In _variables.scss on line 672 you define $table_variants. Each instance of "color-level" needs to be changed to "shift-color".',
      assignees: [
        { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png', userId: 'mock-user' },
        { name: 'Roberta Casas', avatar: 'https://flowbite.com/application-ui/demo/images/users/roberta-casas.png' },
      ],
      priority: 'High',
      dueDate: format(addDays(new Date(), 4), 'yyyy-MM-dd'),
      image: 'https://flowbite.com/application-ui/demo/images/kanban/task-1-dark.jpg',
      labels: [
        { id: 'label-ux', name: 'UI', color: 'rose' },
        { id: 'label-design', name: 'Design', color: 'violet' },
      ],
      attachments: [
        { id: 'attachment-figma', name: 'Figma spec', url: 'https://www.figma.com', type: 'link' },
      ],
      checklistItems: [
        { id: 'check-1', text: 'Audit current table spacing', isDone: true },
        { id: 'check-2', text: 'Refresh card surface styles', isDone: false },
      ],
    },
    task2: {
      id: 'task2',
      title: 'Fix responsive issues',
      description: 'Resolve mobile view problems on the dashboard page.',
      assignees: [
        { name: 'Roberta Casas', avatar: 'https://flowbite.com/application-ui/demo/images/users/roberta-casas.png' },
      ],
      priority: 'Medium',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      labels: [
        { id: 'label-bug', name: 'Bugfix', color: 'amber' },
      ],
      attachments: [],
      checklistItems: [
        { id: 'check-3', text: 'Verify mobile breakpoints', isDone: false },
      ],
    },
    task3: {
      id: 'task3',
      title: 'Create Javascript elements',
      description: 'Complete the implementation of dynamic form elements.',
      assignees: [
        { name: 'Bonnie Green', avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png', userId: 'mock-user' },
      ],
      priority: 'Lowest',
      dueDate: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
      isDone: true,
      labels: [
        { id: 'label-dev', name: 'Frontend', color: 'sky' },
      ],
      attachments: [
        { id: 'attachment-doc', name: 'Implementation notes', url: 'https://developer.mozilla.org', type: 'link' },
      ],
      checklistItems: [
        { id: 'check-4', text: 'Create DOM factory helpers', isDone: true },
        { id: 'check-5', text: 'Integrate into form builder', isDone: true },
      ],
    },
  },
};
