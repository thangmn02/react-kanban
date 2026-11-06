import { translateNow } from '../i18n/context';
export interface BoardTemplateDefinition {
  id: string;
  name: string;
  description: string;
  lists: string[];
}

export const BOARD_TEMPLATES: BoardTemplateDefinition[] = [
  {
    id: 'simple-kanban',
    get name() { return translateNow('board.simpleKora'); },
    get description() { return translateNow('board.aLightweightBoardForPersonalTasks'); },
    lists: ['To-do', 'Doing', 'Done'],
  },
  {
    id: 'software-mini-project',
    get name() { return translateNow('board.softwareMiniProject'); },
    get description() { return translateNow('board.aSmallProductWorkflowForPlanning'); },
    lists: ['Backlog', 'In Progress', 'Nearly done', 'Done'],
  },
  {
    id: 'presentation',
    get name() { return translateNow('board.presentation'); },
    get description() { return translateNow('board.aCommunicationFocusedFlowFromResearch'); },
    lists: ['Research', 'Outline', 'Design Slides', 'Rehearse', 'Delivered'],
  },
];

export const DEFAULT_BOARD_TEMPLATE_ID = BOARD_TEMPLATES[0].id;

export function findBoardTemplateById(templateId: string) {
  return BOARD_TEMPLATES.find((template) => template.id === templateId) || null;
}

export function getBoardTemplateById(templateId: string) {
  return findBoardTemplateById(templateId) || BOARD_TEMPLATES[0];
}
