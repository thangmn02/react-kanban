export interface BoardTemplateDefinition {
  id: string;
  name: string;
  description: string;
  lists: string[];
}

export const BOARD_TEMPLATES: BoardTemplateDefinition[] = [
  {
    id: 'simple-kanban',
    name: 'Simple Kanban',
    description: 'A lightweight board for personal tasks and straightforward delivery tracking.',
    lists: ['To-do', 'Doing', 'Done'],
  },
  {
    id: 'software-mini-project',
    name: 'Software Mini Project',
    description: 'A small product workflow for planning, building, reviewing, and shipping.',
    lists: ['Backlog', 'In Progress', 'Review', 'Done'],
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'A communication-focused flow from research to rehearsal and delivery.',
    lists: ['Research', 'Outline', 'Design Slides', 'Rehearse', 'Delivered'],
  },
];

export const DEFAULT_BOARD_TEMPLATE_ID = BOARD_TEMPLATES[0].id;

export function getBoardTemplateById(templateId: string) {
  return BOARD_TEMPLATES.find((template) => template.id === templateId) || BOARD_TEMPLATES[0];
}
