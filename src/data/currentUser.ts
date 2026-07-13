import type { TaskAssignee } from '../types/task.type';

export const CURRENT_USER: TaskAssignee = {
  name: 'Bonnie Green',
  avatar: 'https://flowbite.com/application-ui/demo/images/users/bonnie-green.png',
  // Stable identity so local demo mode matches assignees by id rather than
  // display name (mirrors how real Supabase users are matched).
  userId: 'mock-user',
};
