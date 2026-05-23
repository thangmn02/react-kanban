import type { ITaskItem } from '../types/task.type';
import { getDueDateStatus } from './taskMetadata';
import { stripTaskHtml } from './taskCollections';

interface TaskFilterOptions {
  searchQuery: string;
  filterPriority: string;
  filterAssignee: string;
  filterDueDate: string;
}

export function doesTaskMatchFilters(task: ITaskItem, {
  searchQuery,
  filterPriority,
  filterAssignee,
  filterDueDate,
}: TaskFilterOptions) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (normalizedQuery) {
    const matchesTitle = task.title.toLowerCase().includes(normalizedQuery);
    const matchesDescription = stripTaskHtml(task.description).toLowerCase().includes(normalizedQuery);
    const matchesLabels = task.labels.some((label) => label.name.toLowerCase().includes(normalizedQuery));
    const matchesAttachments = task.attachments.some((attachment) => (
      attachment.name.toLowerCase().includes(normalizedQuery)
      || attachment.url.toLowerCase().includes(normalizedQuery)
    ));

    if (!matchesTitle && !matchesDescription && !matchesLabels && !matchesAttachments) {
      return false;
    }
  }

  if (filterPriority && task.priority !== filterPriority) {
    return false;
  }

  if (filterAssignee) {
    const hasMatchingAssignee = task.assignees.some((assignee) => assignee.name === filterAssignee);
    if (!hasMatchingAssignee) {
      return false;
    }
  }

  if (filterDueDate) {
    const dueStatus = getDueDateStatus(task.dueDate, task.isDone).status;
    if (dueStatus !== filterDueDate) {
      return false;
    }
  }

  return true;
}
