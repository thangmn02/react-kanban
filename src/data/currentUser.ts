import type { TaskAssignee } from '../types/task.type';

export const CURRENT_USER: TaskAssignee = {
  name: 'Guest',
  avatar: '/logo.png',
  // Stable identity so local demo mode matches assignees by id rather than
  // display name (mirrors how real Supabase users are matched).
  userId: 'mock-user',
};
